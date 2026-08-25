import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';
import {
  DOFLOW_AUTOMATION_PERFORMANCE_QUEUE,
  PERFORMANCE_EVENT_JOB,
  type PerformanceEventJobData,
} from './tenant-automation-performance.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Policy = { id: string; version: number; formula: Record<string, number> };

@Injectable()
export class TenantDoflowPerformanceRuntimeService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(DOFLOW_AUTOMATION_PERFORMANCE_QUEUE) private readonly queue: Queue,
  ) {}

  private schema(value: string) {
    const schema = safeSchema(value, 'TenantDoflowPerformanceRuntimeService');
    if (!isDoflowTenant(schema)) throw new Error('Performance runtime is doflow-only');
    return schema;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  async enqueueEvent(data: PerformanceEventJobData) {
    const schema = this.schema(data.schema);
    const jobId = `pe-${this.hash(`${schema}:${data.sourceTable}:${data.sourceId}`).slice(0, 48)}`;
    await this.queue.add(PERFORMANCE_EVENT_JOB, { ...data, schema }, {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 500,
      removeOnFail: 500,
    });
    return jobId;
  }

  private async policy(manager: EntityManager, schema: string): Promise<Policy> {
    const rows = await manager.query(
      `SELECT p.id, p.current_version AS version, v.formula
       FROM "${schema}".point_policies p
       JOIN "${schema}".point_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
       WHERE p.status='active' AND p.event_type='default'
         AND p.valid_from <= now() AND (p.valid_to IS NULL OR p.valid_to > now())
       ORDER BY p.valid_from DESC LIMIT 1`,
    );
    if (!rows[0]) throw new Error('Policy punti attiva non disponibile');
    return { id: rows[0].id, version: Number(rows[0].version), formula: rows[0].formula || {} };
  }

  private async ledger(
    manager: EntityManager,
    schema: string,
    policy: Policy,
    input: {
      userId: string;
      eventType: string;
      recordType: string;
      recordId?: string | null;
      operationId: string;
      amount: number;
      state: 'provisional' | 'approved' | 'compensation' | 'adjustment';
      effectiveAt: Date | string;
      actorId?: string | null;
      reason: string;
      compensates?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!UUID_RE.test(input.userId) || !Number.isFinite(input.amount) || input.amount === 0) return null;
    const rows = await manager.query(
      `INSERT INTO "${schema}".point_ledger
        (user_id,policy_id,policy_version,event_type,source_record_type,source_record_id,
         operation_id,amount,state,effective_at,actor_user_id,reason,compensates_entry_id,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (operation_id,event_type,user_id) DO NOTHING RETURNING *`,
      [input.userId, policy.id, policy.version, input.eventType, input.recordType,
        input.recordId && UUID_RE.test(input.recordId) ? input.recordId : null, input.operationId,
        input.amount, input.state, input.effectiveAt, input.actorId && UUID_RE.test(input.actorId) ? input.actorId : null,
        input.reason, input.compensates || null, JSON.stringify(input.metadata || {})],
    );
    return rows[0] || null;
  }

  private async commerceEvent(manager: EntityManager, schema: string, source: Record<string, any>, policy: Policy) {
    if (!['commerce_payment_recorded', 'commerce_payment_updated', 'commerce_refund_recorded'].includes(String(source.event_type))) {
      return { ignored: true, reason: 'Evento Commerce senza policy punti' };
    }
    const payments = await manager.query(
      `SELECT p.*, COALESCE(s.salesperson_id, p.created_by) AS beneficiary_id
       FROM "${schema}".payments p
       LEFT JOIN "${schema}".orders o ON o.id=p.order_id
       LEFT JOIN "${schema}".sales s ON s.id=o.sale_id
       WHERE p.id=$1 AND p.deleted_at IS NULL`,
      [source.aggregate_id],
    );
    const payment = payments[0];
    if (!payment || payment.status !== 'confirmed') return { ignored: true, reason: 'Movimento non confermato' };
    const euros = Math.abs(Number(payment.amount || 0));
    const unit = Number(policy.formula.collected_per_hundred_euro || 0);
    const points = Math.max(0, Math.floor(euros / 100) * unit);
    if (!points) return { ignored: true, reason: 'Importo sotto la soglia policy' };
    const refund = payment.payment_type === 'refund';
    let compensates: string | null = null;
    if (refund && payment.original_payment_id) {
      const originals = await manager.query(
        `SELECT id FROM "${schema}".point_ledger
         WHERE source_record_type='payment' AND source_record_id=$1 AND amount > 0
         ORDER BY created_at LIMIT 1`,
        [payment.original_payment_id],
      );
      compensates = originals[0]?.id || null;
    }
    const entry = await this.ledger(manager, schema, policy, {
      userId: String(payment.beneficiary_id || ''),
      eventType: refund ? 'refund' : 'sale_collected',
      recordType: refund ? 'refund' : 'payment',
      recordId: payment.id,
      operationId: source.operation_id,
      amount: refund ? -points : points,
      state: refund ? 'compensation' : 'approved',
      effectiveAt: payment.payment_date || payment.created_at,
      actorId: payment.created_by,
      reason: refund ? 'Rimborso confermato: compensazione del punteggio economico' : 'Pagamento confermato',
      compensates,
      metadata: { euros, order_id: payment.order_id, metric: refund ? 'refunds' : 'net_collected' },
    });
    return { ignored: !entry, entryId: entry?.id || null };
  }

  private async deliveryEvent(manager: EntityManager, schema: string, source: Record<string, any>, policy: Policy) {
    const events = await manager.query(
      `SELECT e.*, t.assignee_id, t.due_at, t.completed_at, p.owner_id, p.due_date, p.delivered_at
       FROM "${schema}".project_workflow_events e
       LEFT JOIN "${schema}".tasks t ON t.id=e.task_id
       LEFT JOIN "${schema}".projects p ON p.id=e.project_id
       WHERE e.operation_id=$1 AND e.event_type=$2 AND e.project_id=$3 LIMIT 1`,
      [source.operation_id, source.topic, source.aggregate_id],
    );
    const event = events[0];
    if (!event) return { ignored: true, reason: 'Evento Delivery non trovato' };
    const eventType = String(event.event_type);
    const beneficiary = String(event.assignee_id || event.owner_id || event.actor_user_id || '');
    let amount = 0;
    let rule = eventType;
    let state: 'provisional' | 'approved' | 'compensation' = 'approved';
    let compensates: string | null = null;
    const metadata: Record<string, unknown> = { project_id: event.project_id, task_id: event.task_id || null };
    if (eventType === 'task_completed') {
      const due = event.due_at ? new Date(event.due_at) : null;
      const completed = event.completed_at ? new Date(event.completed_at) : new Date(event.created_at);
      const days = due ? Math.trunc((due.getTime() - completed.getTime()) / 86_400_000) : 0;
      if (days > 0) {
        rule = 'early';
        amount = Number(policy.formula.on_time || 0) + Math.min(Number(policy.formula.early_maximum || 0), days * Number(policy.formula.early_per_day || 0));
      } else if (days < 0) {
        rule = 'late';
        amount = Number(policy.formula.on_time || 0) - Math.min(Number(policy.formula.late_maximum || 0), Math.abs(days) * Number(policy.formula.late_per_day || 0));
      } else {
        rule = 'on_time';
        amount = Number(policy.formula.on_time || 0);
      }
      state = 'provisional';
      metadata.days_from_due = days;
    } else if (eventType === 'qa_approved') {
      rule = 'qa_first_pass';
      amount = Number(policy.formula.qa_first_pass || 0);
    } else if (eventType === 'qa_changes_requested') {
      rule = 'qa_rejected';
      amount = Number(policy.formula.qa_rejected || 0);
      state = 'compensation';
    } else if (eventType === 'task_reopened') {
      rule = 'reopened';
      amount = Number(policy.formula.reopened || 0);
      state = 'compensation';
      const originals = await manager.query(
        `SELECT id FROM "${schema}".point_ledger
         WHERE source_record_type='task' AND source_record_id=$1 AND amount > 0
         ORDER BY created_at DESC LIMIT 1`,
        [event.task_id],
      );
      compensates = originals[0]?.id || null;
    } else if (eventType === 'project_delivered') {
      rule = 'project_delivered';
      amount = Number(policy.formula.project_delivered || 0);
      metadata.on_time = !event.due_date || String(event.delivered_at || event.created_at).slice(0, 10) <= String(event.due_date).slice(0, 10);
    } else {
      return { ignored: true, reason: 'Evento Delivery senza policy punti' };
    }
    const entry = await this.ledger(manager, schema, policy, {
      userId: beneficiary,
      eventType: rule,
      recordType: event.task_id ? 'task' : 'project',
      recordId: event.task_id || event.project_id,
      operationId: event.operation_id,
      amount,
      state,
      effectiveAt: event.created_at,
      actorId: event.actor_user_id,
      reason: `Evento Delivery ${eventType}`,
      compensates,
      metadata,
    });
    return { ignored: !entry, entryId: entry?.id || null };
  }

  async processBusinessEvent(data: PerformanceEventJobData) {
    const schema = this.schema(data.schema);
    if (!UUID_RE.test(data.sourceId)) throw new Error('sourceId performance non valido');
    await ensureDoflowAutomationPerformanceTables(this.dataSource, schema);
    return this.dataSource.transaction(async (manager) => {
      const claimed = await manager.query(
        `SELECT result FROM "${schema}".performance_event_registry WHERE source_table=$1 AND source_id=$2 FOR UPDATE`,
        [data.sourceTable, data.sourceId],
      );
      if (claimed[0]) return { ...claimed[0].result, existing: true };
      const rows = await manager.query(`SELECT * FROM "${schema}"."${data.sourceTable}" WHERE id=$1`, [data.sourceId]);
      const source = rows[0];
      if (!source) throw new Error('Evento outbox non trovato');
      const policy = await this.policy(manager, schema);
      const result = data.sourceTable === 'commerce_outbox'
        ? await this.commerceEvent(manager, schema, source, policy)
        : await this.deliveryEvent(manager, schema, source, policy);
      await manager.query(
        `INSERT INTO "${schema}".performance_event_registry (source_table,source_id,operation_id,result)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [data.sourceTable, data.sourceId, source.operation_id, JSON.stringify(result)],
      );
      return result;
    });
  }
}
