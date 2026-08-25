import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';
import {
  AUTOMATION_RUN_JOB,
  DOFLOW_AUTOMATION_PERFORMANCE_QUEUE,
  type AutomationRunJobData,
} from './tenant-automation-performance.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONDITION_OPERATORS = new Set(['equals', 'not_equals', 'contains', 'in', 'greater_than', 'less_than', 'exists', 'changed_from', 'changed_to']);
const ACTIONS = new Set(['create_notification', 'create_task', 'create_commercial_activity', 'add_activity_log', 'invoke_adapter', 'noop']);

type Actor = { id: string; role: string; email?: string };
type EnqueueInput = {
  triggerSource: 'manual' | 'event' | 'scheduled' | 'retry';
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  operationId?: string;
  correlationId?: string;
  retryOf?: string;
  force?: boolean;
};

@Injectable()
export class TenantAutomationEngineService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(DOFLOW_AUTOMATION_PERFORMANCE_QUEUE) private readonly queue: Queue,
  ) {}

  private schema(value: string) {
    const schema = safeSchema(value, 'TenantAutomationEngineService');
    if (!isDoflowTenant(schema)) throw new BadRequestException('Motore Phase 4B disponibile soltanto per Doflow');
    return schema;
  }

  private uuid(value: unknown, label: string) {
    const id = String(value || '');
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private redactError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore esecuzione automazione';
    return message.replace(/(password|secret|token|authorization|cookie)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]').slice(0, 1_000);
  }

  private ruleConfig(rule: Record<string, any>) {
    return {
      name: rule.name,
      description: rule.description,
      category: rule.category,
      trigger_type: rule.trigger_type,
      trigger_config: rule.trigger_config || {},
      conditions: rule.conditions || [],
      actions: rule.actions || [],
      schedule_config: rule.schedule_config || null,
      run_mode: rule.run_mode,
      priority: rule.priority,
      cooldown_minutes: rule.cooldown_minutes,
      max_runs_per_day: rule.max_runs_per_day,
    };
  }

  private async ensureVersion(manager: EntityManager, schema: string, rule: Record<string, any>, actorId: string | null) {
    if (rule.current_version_id) {
      const rows = await manager.query(`SELECT * FROM "${schema}".automation_rule_versions WHERE id = $1`, [rule.current_version_id]);
      if (rows[0]) return rows[0];
    }
    const current = await manager.query(
      `SELECT * FROM "${schema}".automation_rule_versions WHERE rule_id = $1 ORDER BY version DESC LIMIT 1`,
      [rule.id],
    );
    if (current[0]) {
      await manager.query(`UPDATE "${schema}".automation_rules SET current_version_id = $2 WHERE id = $1`, [rule.id, current[0].id]);
      return current[0];
    }
    const inserted = await manager.query(
      `INSERT INTO "${schema}".automation_rule_versions (rule_id, version, config, change_reason, created_by)
       VALUES ($1, 1, $2::jsonb, 'Baseline importata dalla regola esistente', $3) RETURNING *`,
      [rule.id, JSON.stringify(this.ruleConfig(rule)), actorId],
    );
    await manager.query(
      `UPDATE "${schema}".automation_rules SET current_version_id = $2, optimistic_version = GREATEST(optimistic_version, 1) WHERE id = $1`,
      [rule.id, inserted[0].id],
    );
    return inserted[0];
  }

  async enqueueRule(schemaValue: string, ruleIdValue: string, actor: Actor, input: EnqueueInput) {
    const schema = this.schema(schemaValue);
    const ruleId = this.uuid(ruleIdValue, 'ruleId');
    await ensureDoflowAutomationPerformanceTables(this.dataSource, schema);
    const operationId = UUID_RE.test(String(input.operationId || '')) ? String(input.operationId) : randomUUID();
    const correlationId = UUID_RE.test(String(input.correlationId || '')) ? String(input.correlationId) : randomUUID();
    const requestKey = String(input.idempotencyKey || operationId).trim();
    if (!requestKey || requestKey.length > 240) throw new BadRequestException('Idempotency-Key non valida');
    const executionKey = this.hash(`${schema}:${ruleId}:${input.triggerSource}:${requestKey}`);

    const result = await this.dataSource.transaction(async (manager) => {
      const rules = await manager.query(
        `SELECT * FROM "${schema}".automation_rules WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [ruleId],
      );
      const rule = rules[0];
      if (!rule) throw new NotFoundException('Regola automazione non trovata');
      if (!rule.is_enabled && !input.force) throw new ConflictException('La regola non è attiva');
      if (rule.lifecycle_status === 'archived' || rule.archived_at) throw new ConflictException('La regola è archiviata');
      const existing = await manager.query(
        `SELECT r.* FROM "${schema}".automation_execution_registry e
         JOIN "${schema}".automation_runs r ON r.id = e.run_id
         WHERE e.execution_type = 'run' AND e.execution_key = $1`,
        [executionKey],
      );
      if (existing[0]) return { run: existing[0], existing: true, outboxId: null as string | null };
      const version = await this.ensureVersion(manager, schema, rule, UUID_RE.test(actor.id) ? actor.id : null);
      const rootRunId = input.retryOf ? this.uuid(input.retryOf, 'retryOf') : null;
      const runRows = await manager.query(
        `INSERT INTO "${schema}".automation_runs
          (rule_id, trigger_type, trigger_source, status, input_payload, actor_user_id,
           execution_key, operation_id, correlation_id, rule_version_id, attempt, retry_of, root_run_id)
         VALUES ($1,$2,$3,'queued',$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [ruleId, rule.trigger_type, input.triggerSource, JSON.stringify(input.payload || {}), UUID_RE.test(actor.id) ? actor.id : null,
          executionKey, operationId, correlationId, version.id, input.retryOf ? 2 : 1, rootRunId, rootRunId],
      );
      const run = runRows[0];
      await manager.query(
        `INSERT INTO "${schema}".automation_execution_registry
          (execution_type, execution_key, rule_id, run_id, operation_id, correlation_id)
         VALUES ('run',$1,$2,$3,$4,$5)`,
        [executionKey, ruleId, run.id, operationId, correlationId],
      );
      const outbox = await manager.query(
        `INSERT INTO "${schema}".automation_outbox (run_id, operation_id, correlation_id, topic, payload)
         VALUES ($1,$2,$3,'automation.run',$4::jsonb) RETURNING id`,
        [run.id, operationId, correlationId, JSON.stringify({ rule_id: ruleId, rule_version_id: version.id })],
      );
      await manager.query(
        `INSERT INTO "${schema}".automation_activity (action, rule_id, actor_user_id, metadata)
         VALUES ('run_queued',$1,$2,$3::jsonb)`,
        [ruleId, UUID_RE.test(actor.id) ? actor.id : null, JSON.stringify({ run_id: run.id, operation_id: operationId, correlation_id: correlationId })],
      );
      return { run, existing: false, outboxId: outbox[0].id as string };
    });
    if (!result.existing && result.outboxId) await this.enqueueOutbox(schema, result.run.id, result.outboxId);
    return { ...result.run, existing: result.existing };
  }

  async enqueueOutbox(schemaValue: string, runIdValue: string, outboxIdValue: string) {
    const schema = this.schema(schemaValue);
    const runId = this.uuid(runIdValue, 'runId');
    const outboxId = this.uuid(outboxIdValue, 'outboxId');
    const jobId = `ar-${this.hash(`${schema}:${runId}`).slice(0, 48)}`;
    const data: AutomationRunJobData = { schema, runId, outboxId };
    await this.queue.add(AUTOMATION_RUN_JOB, data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    await this.dataSource.query(
      `UPDATE "${schema}".automation_outbox SET enqueued_at = COALESCE(enqueued_at, now()), attempts = attempts + 1 WHERE id = $1`,
      [outboxId],
    );
    await this.dataSource.query(`UPDATE "${schema}".automation_runs SET queue_job_id = $2 WHERE id = $1`, [runId, jobId]);
    return jobId;
  }

  async retryRun(schemaValue: string, runIdValue: string, actor: Actor, idempotencyKey?: string) {
    const schema = this.schema(schemaValue);
    const runId = this.uuid(runIdValue, 'runId');
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".automation_runs WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run) throw new NotFoundException('Run non trovato');
    if (!['failed', 'dead_letter'].includes(String(run.status))) throw new ConflictException('Il run non è riprovabile');
    return this.enqueueRule(schema, run.rule_id, actor, {
      triggerSource: 'retry',
      payload: run.input_payload || {},
      idempotencyKey: idempotencyKey || `retry:${runId}:${randomUUID()}`,
      retryOf: run.root_run_id || run.id,
      force: true,
    });
  }

  async enqueueTrigger(schemaValue: string, triggerType: string, actor: Actor, payload: Record<string, unknown>, idempotencyKey?: string) {
    const schema = this.schema(schemaValue);
    if (!/^[a-z0-9_]{1,100}$/.test(triggerType)) throw new BadRequestException('triggerType non valido');
    await ensureDoflowAutomationPerformanceTables(this.dataSource, schema);
    const rules = await this.dataSource.query(
      `SELECT id FROM "${schema}".automation_rules
       WHERE deleted_at IS NULL AND archived_at IS NULL AND is_enabled=true
         AND trigger_type=$1 AND run_mode IN ('event','hybrid','scheduled')
       ORDER BY priority DESC,created_at LIMIT 50`,
      [triggerType],
    );
    const requestKey = String(idempotencyKey || payload.operation_id || randomUUID());
    const runs = [];
    for (const rule of rules) {
      runs.push(await this.enqueueRule(schema, rule.id, actor, {
        triggerSource: 'event', payload,
        idempotencyKey: `${requestKey}:${rule.id}`,
        operationId: UUID_RE.test(String(payload.operation_id || '')) ? String(payload.operation_id) : undefined,
        correlationId: UUID_RE.test(String(payload.correlation_id || '')) ? String(payload.correlation_id) : undefined,
      }));
    }
    return { triggerType, rulesRun: runs.length, runs };
  }

  async enqueueDue(schemaValue: string, actor: Actor) {
    const schema = this.schema(schemaValue);
    await ensureDoflowAutomationPerformanceTables(this.dataSource, schema);
    const rules = await this.dataSource.query(
      `SELECT id,next_run_at FROM "${schema}".automation_rules
       WHERE deleted_at IS NULL AND archived_at IS NULL AND is_enabled=true
         AND run_mode IN ('scheduled','hybrid') AND next_run_at IS NOT NULL AND next_run_at<=now()
       ORDER BY next_run_at LIMIT 50`,
    );
    const runs = [];
    for (const rule of rules) {
      runs.push(await this.enqueueRule(schema, rule.id, actor, {
        triggerSource: 'scheduled', payload: { scheduled_at: rule.next_run_at },
        idempotencyKey: `scheduled:${rule.id}:${new Date(rule.next_run_at).toISOString()}`,
      }));
      await this.dataSource.query(
        `UPDATE "${schema}".automation_rules SET next_run_at=CASE
          WHEN COALESCE(schedule_config->>'frequency','daily')='hourly' THEN now()+interval '1 hour'
          WHEN COALESCE(schedule_config->>'frequency','daily')='weekly' THEN now()+interval '7 days'
          ELSE now()+interval '1 day' END WHERE id=$1`,
        [rule.id],
      );
    }
    return { rulesRun: runs.length, runs };
  }

  private valueAt(payload: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, payload);
  }

  private matchesConditions(conditions: unknown, payload: Record<string, unknown>) {
    if (!conditions || (Array.isArray(conditions) && !conditions.length)) return true;
    if (!Array.isArray(conditions)) return true; // Legacy keyed conditions are evaluated by their source match query.
    return conditions.every((condition) => {
      if (!condition || typeof condition !== 'object') return false;
      const item = condition as Record<string, unknown>;
      const field = String(item.field || '');
      const operator = String(item.operator || '');
      if (!/^[a-zA-Z0-9_.]{1,100}$/.test(field) || !CONDITION_OPERATORS.has(operator)) return false;
      const current = this.valueAt(payload, field);
      const expected = item.value;
      if (operator === 'exists') return current !== undefined && current !== null;
      if (operator === 'equals') return current === expected;
      if (operator === 'not_equals') return current !== expected;
      if (operator === 'contains') return String(current ?? '').includes(String(expected ?? ''));
      if (operator === 'in') return Array.isArray(expected) && expected.includes(current);
      if (operator === 'greater_than') return Number(current) > Number(expected);
      if (operator === 'less_than') return Number(current) < Number(expected);
      if (operator === 'changed_from') return this.valueAt(payload, `before.${field}`) === expected;
      return this.valueAt(payload, `after.${field}`) === expected;
    });
  }

  private async claimAction(schema: string, key: string, run: Record<string, any>, actionIndex: number) {
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".automation_execution_registry
        (execution_type, execution_key, rule_id, run_id, operation_id, correlation_id, status)
       VALUES ('action',$1,$2,$3,$4,$5,'processing')
       ON CONFLICT (execution_type, execution_key) DO UPDATE
         SET status='processing', completed_at=NULL
         WHERE automation_execution_registry.status <> 'completed'
       RETURNING id`,
      [key, run.rule_id, run.id, run.operation_id, run.correlation_id],
    );
    return Boolean(rows[0]) || actionIndex < 0;
  }

  private async executeAction(schema: string, run: Record<string, any>, action: Record<string, unknown>, index: number) {
    const type = String(action.type || '');
    if (!ACTIONS.has(type)) throw new Error(`Azione worker non allowlisted: ${type}`);
    const root = run.root_run_id || run.retry_of || run.id;
    const actionKey = this.hash(`${root}:${index}:${type}`);
    const existing = await this.dataSource.query(
      `SELECT 1 FROM "${schema}".automation_execution_registry WHERE execution_type = 'action' AND execution_key = $1 AND status = 'completed'`,
      [actionKey],
    );
    if (existing[0]) return { status: 'skipped', message: 'Azione già completata nel run radice', actionKey };
    const claimed = await this.claimAction(schema, actionKey, run, index);
    if (!claimed) return { status: 'skipped', message: 'Azione già completata', actionKey };
    const payload = (run.input_payload || {}) as Record<string, unknown>;
    if (type === 'invoke_adapter') {
      const adapterName = String(action.adapter || '');
      const adapters = await this.dataSource.query(`SELECT * FROM "${schema}".automation_adapters WHERE name = $1`, [adapterName]);
      const adapter = adapters[0];
      if (!adapter) throw new Error(`Adapter non registrato: ${adapterName}`);
      if (!adapter.enabled || !adapter.configured) throw new Error(`Adapter ${adapterName} disabilitato o non configurato`);
      if (!adapter.synthetic) throw new Error(`Adapter esterno ${adapterName} non eseguibile senza provider configurato`);
      if (process.env.AUTOMATION_ACCEPTANCE_SYNTHETIC_ADAPTER !== 'true') throw new Error('Adapter sintetico consentito soltanto nello stack acceptance');
    } else if (type === 'create_notification') {
      const recipient = String(action.recipient_user_id || payload.recipient_user_id || run.actor_user_id || '');
      if (!UUID_RE.test(recipient)) throw new Error('Destinatario notifica non valido');
      await this.dataSource.query(
        `INSERT INTO "${schema}".notifications
          (recipient_user_id, title, body, type, priority, entity_type, entity_id, link_url, fingerprint, metadata, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,'automation',$4,$5,$6,$7,$8,$9::jsonb,$10,now(),now()) ON CONFLICT DO NOTHING`,
        [recipient, String(action.title || 'Automazione eseguita').slice(0, 200), String(action.body || payload.message || '').slice(0, 2_000),
          String(action.priority || 'normal'), String(payload.record_type || 'automation'), UUID_RE.test(String(payload.record_id || '')) ? payload.record_id : null,
          String(action.link_url || '/dashboard/automazioni'), `automation:${actionKey}:${recipient}`, JSON.stringify({ run_id: run.id, operation_id: run.operation_id }), run.actor_user_id],
      );
    } else if (type === 'create_task') {
      const projectId = String(action.project_id || payload.project_id || payload.record_id || '');
      if (!UUID_RE.test(projectId)) throw new Error('project_id obbligatorio per create_task');
      await this.dataSource.query(
        `INSERT INTO "${schema}".tasks (project_id, title, description, status, priority, assignee_id, created_by, updated_by, created_at, updated_at)
         VALUES ($1,$2,$3,'backlog',$4,$5,$6,$6,now(),now())`,
        [projectId, String(action.title || 'Attività da automazione').slice(0, 500), String(action.description || '').slice(0, 2_000), String(action.priority || 'medium'),
          UUID_RE.test(String(action.assignee_id || '')) ? action.assignee_id : null, run.actor_user_id],
      );
    } else if (type === 'create_commercial_activity') {
      const companyId = String(action.company_id || payload.company_id || '');
      await this.dataSource.query(
        `INSERT INTO "${schema}".activities (company_id, title, description, type, status, priority, assigned_to, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,'task','planned',$4,$5,$6,now(),now())`,
        [UUID_RE.test(companyId) ? companyId : null, String(action.title || 'Follow-up automatico').slice(0, 500), String(action.description || '').slice(0, 2_000),
          String(action.priority || 'medium'), UUID_RE.test(String(action.assignee_id || run.actor_user_id || '')) ? (action.assignee_id || run.actor_user_id) : null, run.actor_user_id],
      );
    } else if (type === 'add_activity_log') {
      await this.dataSource.query(
        `INSERT INTO "${schema}".automation_activity (action, rule_id, actor_user_id, metadata)
         VALUES ('business_activity',$1,$2,$3::jsonb)`,
        [run.rule_id, run.actor_user_id, JSON.stringify({ run_id: run.id, message: String(action.message || '') })],
      );
    }
    await this.dataSource.query(
      `UPDATE "${schema}".automation_execution_registry SET status='completed', completed_at=now()
       WHERE execution_type='action' AND execution_key=$1`,
      [actionKey],
    );
    return { status: 'success', message: type === 'noop' ? 'Noop diagnostico completato' : 'Azione completata', actionKey };
  }

  async processRun(data: AutomationRunJobData, attemptsMade: number, maxAttempts: number, workerId: string) {
    const schema = this.schema(data.schema);
    const runId = this.uuid(data.runId, 'runId');
    const runs = await this.dataSource.query(`SELECT * FROM "${schema}".automation_runs WHERE id = $1`, [runId]);
    const run = runs[0];
    if (!run) throw new Error('Run non trovato dal worker');
    if (run.status === 'success') return run;
    const versions = await this.dataSource.query(`SELECT * FROM "${schema}".automation_rule_versions WHERE id = $1`, [run.rule_version_id]);
    const version = versions[0];
    if (!version) throw new Error('Versione regola non trovata');
    const config = version.config || {};
    await this.dataSource.query(
      `UPDATE "${schema}".automation_runs SET status = 'running', started_at = COALESCE(started_at, now()), attempt = $2, worker_id = $3 WHERE id = $1`,
      [runId, attemptsMade + 1, workerId],
    );
    try {
      if (!this.matchesConditions(config.conditions, run.input_payload || {})) {
        await this.dataSource.query(
          `UPDATE "${schema}".automation_runs SET status='skipped', skipped_reason='Condizioni non soddisfatte', finished_at=now(), duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000 WHERE id=$1`,
          [runId],
        );
        await this.dataSource.query(`UPDATE "${schema}".automation_outbox SET status='processed', processed_at=now() WHERE id=$1`, [data.outboxId]);
        return { ...run, status: 'skipped' };
      }
      const actions = Array.isArray(config.actions) ? config.actions : [];
      let succeeded = 0;
      let skipped = 0;
      for (let index = 0; index < actions.length; index += 1) {
        const action = actions[index] as Record<string, unknown>;
        try {
          const result = await this.executeAction(schema, run, action, index);
          if (result.status === 'success') succeeded += 1; else skipped += 1;
          await this.dataSource.query(
            `INSERT INTO "${schema}".automation_action_logs
              (run_id, rule_id, action_type, status, dedupe_key, message, payload, operation_id, correlation_id, attempt)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
            [runId, run.rule_id, action.type, result.status, result.actionKey, result.message, JSON.stringify({ index }), run.operation_id, run.correlation_id, attemptsMade + 1],
          );
        } catch (error) {
          const message = this.redactError(error);
          await this.dataSource.query(
            `INSERT INTO "${schema}".automation_action_logs
              (run_id, rule_id, action_type, status, error_message, payload, operation_id, correlation_id, attempt)
             VALUES ($1,$2,$3,'failed',$4,$5::jsonb,$6,$7,$8)`,
            [runId, run.rule_id, String(action.type || ''), message, JSON.stringify({ index }), run.operation_id, run.correlation_id, attemptsMade + 1],
          );
          throw error;
        }
      }
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE "${schema}".automation_runs SET status='success', finished_at=now(),
             duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000, matched_count=1,
             actions_count=$2, actions_success_count=$3, actions_failed_count=0,
             result_payload=$4::jsonb WHERE id=$1`,
          [runId, actions.length, succeeded, JSON.stringify({ succeeded, skipped })],
        );
        await manager.query(
          `UPDATE "${schema}".automation_rules SET last_run_at=now(), last_success_at=now(), last_error_message=NULL WHERE id=$1`,
          [run.rule_id],
        );
        await manager.query(`UPDATE "${schema}".automation_outbox SET status='processed', processed_at=now(), last_error=NULL WHERE id=$1`, [data.outboxId]);
        await manager.query(
          `UPDATE "${schema}".automation_execution_registry SET status='completed', completed_at=now(), result=$2::jsonb
           WHERE execution_type='run' AND run_id=$1`,
          [runId, JSON.stringify({ status: 'success' })],
        );
      });
      return { ...run, status: 'success' };
    } catch (error) {
      const message = this.redactError(error);
      const finalAttempt = attemptsMade + 1 >= maxAttempts;
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE "${schema}".automation_runs SET status=$2, error_message=$3, finished_at=now(),
             duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000, actions_failed_count=actions_failed_count+1,
             dead_lettered_at=CASE WHEN $4 THEN now() ELSE dead_lettered_at END WHERE id=$1`,
          [runId, finalAttempt ? 'dead_letter' : 'failed', message, finalAttempt],
        );
        await manager.query(
          `UPDATE "${schema}".automation_rules SET last_run_at=now(), last_error_at=now(), last_error_message=$2 WHERE id=$1`,
          [run.rule_id, message],
        );
        await manager.query(`UPDATE "${schema}".automation_outbox SET status=$2, last_error=$3 WHERE id=$1`, [data.outboxId, finalAttempt ? 'dead_letter' : 'retry', message]);
        if (finalAttempt) {
          await manager.query(
            `INSERT INTO "${schema}".automation_dead_letters
              (run_id, queue_job_id, error_class, error_message, payload, attempts)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (run_id) DO NOTHING`,
            [runId, run.queue_job_id, error instanceof Error ? error.constructor.name : 'Error', message, JSON.stringify(run.input_payload || {}), attemptsMade + 1],
          );
        }
      });
      throw error;
    }
  }

  async health() {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return { queue: DOFLOW_AUTOMATION_PERFORMANCE_QUEUE, ...counts };
  }
}
