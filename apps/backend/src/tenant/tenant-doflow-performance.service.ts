import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { isDoflowTenant } from './tenant-context';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['commercial', 'developer', 'project_manager', 'support']);
const ECONOMIC_METRICS = new Set(['gross_collected', 'net_collected', 'paid_sales', 'new_paying_customers', 'lead_to_payment_conversion', 'average_collected_ticket', 'refunds']);
const PENALTY_METRICS = new Set(['refunds', 'reopened_work', 'project_delays']);

type Actor = { id: string; email: string; role: string; schema: string };
type Access = {
  admin: boolean;
  canViewFinance: boolean;
  canViewGlobalPoints: boolean;
  canManagePolicy: boolean;
  canManageRankings: boolean;
  canManageGoals: boolean;
};

@Injectable()
export class TenantDoflowPerformanceService {
  constructor(private readonly dataSource: DataSource, @Inject(REQUEST) private readonly request: any) {}

  private actor(): Actor {
    const source = this.request?.user || this.request?.authUser;
    const schema = String(source?.tenantId || source?.tenant_id || this.request?.tenantId || '').toLowerCase();
    const id = String(source?.sub || source?.id || '');
    if (!UUID_RE.test(id) || !isDoflowTenant(schema)) throw new ForbiddenException('Performance disponibile soltanto per il tenant Doflow');
    return { id, email: String(source?.email || ''), role: String(source?.role || '').toLowerCase(), schema };
  }

  private uuid(value: unknown, label: string) {
    const id = String(value || '');
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private operationUuid(value: string) {
    if (UUID_RE.test(value)) return value;
    const hash = createHash('sha256').update(value).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  private text(value: unknown, label: string, required = false, max = 2_000) {
    const text = String(value ?? '').trim();
    if (required && !text) throw new BadRequestException(`${label} obbligatorio`);
    if (text.length > max) throw new BadRequestException(`${label} troppo lungo`);
    return text;
  }

  private async access(actor = this.actor()): Promise<Access> {
    const [roles, capabilities] = await Promise.all([
      this.dataSource.query(`SELECT role FROM "${actor.schema}".doflow_user_roles WHERE user_id=$1`, [actor.id]),
      this.dataSource.query(`SELECT capability FROM "${actor.schema}".doflow_user_capabilities WHERE user_id=$1`, [actor.id]),
    ]);
    const roleSet = new Set(roles.map((row: any) => String(row.role)));
    const caps = new Set(capabilities.map((row: any) => String(row.capability)));
    const admin = ['owner', 'admin', 'superadmin', 'super_admin'].includes(actor.role) || roleSet.has('administrator');
    return {
      admin,
      canViewFinance: admin || caps.has('canViewCommercialValues') || caps.has('canViewGlobalCommerceValues'),
      canViewGlobalPoints: admin || caps.has('canViewGlobalPoints') || caps.has('canViewGlobalWorkload'),
      canManagePolicy: admin || caps.has('canManagePointPolicies'),
      canManageRankings: admin || caps.has('canManageRankings'),
      canManageGoals: admin || caps.has('canManageGoals'),
    };
  }

  private assert(value: boolean, message: string) {
    if (!value) throw new ForbiddenException(message);
  }

  private pointPolicy(formula: Record<string, unknown>) {
    return {
      onTimeBase: Number(formula.on_time || 0),
      earlyPerDay: Number(formula.early_per_day || 0),
      earlyMaximum: Number(formula.early_maximum || 0),
      latePerDay: Number(formula.late_per_day || 0),
      lateMaximum: Number(formula.late_maximum || 0),
      qaFirstPass: Number(formula.qa_first_pass || 0),
      qaRejected: Number(formula.qa_rejected || 0),
      reopened: Number(formula.reopened || 0),
      deliveredProject: Number(formula.project_delivered || 0),
      collectedPerHundredEuro: Number(formula.collected_per_hundred_euro || 0),
    };
  }

  private policyFormula(input: Record<string, unknown>) {
    const values: Record<string, number> = {
      on_time: Number(input.onTimeBase),
      early_per_day: Number(input.earlyPerDay),
      early_maximum: Number(input.earlyMaximum),
      late_per_day: Number(input.latePerDay),
      late_maximum: Number(input.lateMaximum),
      qa_first_pass: Number(input.qaFirstPass),
      qa_rejected: Number(input.qaRejected),
      reopened: Number(input.reopened),
      project_delivered: Number(input.deliveredProject),
      collected_per_hundred_euro: Number(input.collectedPerHundredEuro),
    };
    for (const [key, value] of Object.entries(values)) {
      if (!Number.isFinite(value) || Math.abs(value) > 10_000) throw new BadRequestException(`Formula ${key} non valida`);
    }
    return values;
  }

  private mapLedger(row: Record<string, any>) {
    const rule = String(row.event_type || 'manual_adjustment');
    return {
      id: row.id,
      userId: row.user_id,
      points: Number(row.amount),
      rule,
      recordType: row.source_record_type,
      recordId: row.source_record_id || row.id,
      sourceEventId: row.operation_id,
      occurredAt: row.effective_at,
      status: row.state === 'provisional' ? 'provisional' : row.amount < 0 ? 'reversed' : 'approved',
      reason: row.reason,
      reversesEntryId: row.compensates_entry_id || undefined,
      createdBy: row.actor_user_id || 'system',
      policyId: row.policy_id,
      policyVersion: Number(row.policy_version),
      metadata: row.metadata || {},
    };
  }

  private mapGoal(row: Record<string, any>) {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      targetType: row.target_type,
      targetId: row.target_id || undefined,
      metric: row.metric,
      targetValue: Number(row.target_value),
      unit: row.unit,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      responsibleId: row.responsible_id || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async goalValue(manager: EntityManager | DataSource, actor: Actor, goal: Record<string, any>, access: Access) {
    const schema = actor.schema;
    const from = goal.starts_at;
    const to = goal.ends_at;
    const metric = String(goal.metric);
    if (metric === 'revenue') {
      if (!access.canViewFinance) return null;
      const rows = await manager.query(
        `SELECT COALESCE(SUM(total),0)::numeric AS value FROM "${schema}".orders
         WHERE deleted_at IS NULL AND administrative_status<>'Annullato' AND order_date >= $1 AND order_date < $2`,
        [from, to],
      );
      return Number(rows[0]?.value || 0);
    }
    if (metric === 'won_leads') {
      const rows = await manager.query(`SELECT COUNT(*)::int AS value FROM "${schema}".opportunities WHERE deleted_at IS NULL AND stage IN ('closed_won','won') AND updated_at >= $1 AND updated_at < $2`, [from, to]);
      return Number(rows[0]?.value || 0);
    }
    if (metric === 'new_clients') {
      const rows = await manager.query(`SELECT COUNT(*)::int AS value FROM "${schema}".companies WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2`, [from, to]);
      return Number(rows[0]?.value || 0);
    }
    if (metric === 'completed_projects' || metric === 'on_time_deliveries') {
      const rows = await manager.query(
        `SELECT COUNT(*) FILTER (WHERE $3='completed_projects' OR due_date IS NULL OR delivered_at::date<=due_date::date)::int AS value
         FROM "${schema}".projects WHERE deleted_at IS NULL AND delivered_at >= $1 AND delivered_at < $2`,
        [from, to, metric],
      );
      return Number(rows[0]?.value || 0);
    }
    if (metric === 'completed_activities' || metric === 'resolved_bugs') {
      const rows = await manager.query(
        `SELECT COUNT(*) FILTER (WHERE $3='completed_activities' OR lower(COALESCE(title,'')) LIKE '%bug%')::int AS value
         FROM "${schema}".tasks WHERE deleted_at IS NULL AND status='done' AND completed_at >= $1 AND completed_at < $2`,
        [from, to, metric],
      );
      return Number(rows[0]?.value || 0);
    }
    if (metric === 'renewals') {
      const rows = await manager.query(`SELECT COUNT(*)::int AS value FROM "${schema}".renewals WHERE deleted_at IS NULL AND status IN ('paid','completed','Pagato') AND updated_at >= $1 AND updated_at < $2`, [from, to]);
      return Number(rows[0]?.value || 0);
    }
    return 0;
  }

  private async mission(actor: Actor, access: Access, goalRows: Record<string, any>[]) {
    const items = [];
    for (const row of goalRows) {
      const currentValue = await this.goalValue(this.dataSource, actor, row, access);
      const target = Number(row.target_value || 0);
      items.push({
        ...this.mapGoal(row),
        currentValue,
        progress: currentValue == null ? null : target > 0 ? Math.min(100, Math.round(currentValue / target * 100)) : 0,
        redacted: currentValue == null,
      });
    }
    return { items };
  }

  private effectiveSnapshots(rows: Record<string, any>[], revisions: Record<string, any>[], access: Access, actor: Actor) {
    const actions = new Map<string, Record<string, any>>();
    for (const revision of revisions) if (!actions.has(revision.snapshot_id)) actions.set(revision.snapshot_id, revision);
    return rows.map((row) => {
      const latest = actions.get(row.id);
      const rawScores = Array.isArray(row.scores) ? row.scores : [];
      const scores = rawScores.flatMap((score: Record<string, any>) => {
        if (!access.canViewGlobalPoints && score.userId !== actor.id) return [];
        const metrics = { ...(score.metrics || {}) };
        if (!access.canViewFinance) for (const key of ECONOMIC_METRICS) delete metrics[key];
        return [{ ...score, metrics }];
      });
      return {
        id: row.id,
        period: row.period,
        role: row.role,
        winnerUserId: row.winner_user_id,
        tiedUserIds: row.tied_user_ids || [],
        scores,
        computedAt: row.consolidated_at,
        formulaVersion: Number(row.formula_version),
        status: latest?.action === 'revoked' ? 'revoked' : 'consolidated',
        revokedAt: latest?.action === 'revoked' ? latest.created_at : undefined,
        revokedBy: latest?.action === 'revoked' ? latest.actor_user_id : undefined,
        revocationReason: latest?.action === 'revoked' ? latest.reason : undefined,
        supersedesId: row.supersedes_id || undefined,
        recalculationReason: row.reason || undefined,
        revision: Number(row.revision),
      };
    });
  }

  async state() {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    const ledgerWhere = access.canViewGlobalPoints ? '' : 'WHERE user_id=$1';
    const ledgerParams = access.canViewGlobalPoints ? [] : [actor.id];
    const [policyRows, ledgerRows, configs, snapshots, revisions, goals, adapters] = await Promise.all([
      this.dataSource.query(
        `SELECT p.*,v.formula FROM "${actor.schema}".point_policies p
         JOIN "${actor.schema}".point_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
         WHERE p.status='active' ORDER BY p.valid_from DESC LIMIT 1`,
      ),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".point_ledger ${ledgerWhere} ORDER BY effective_at DESC,created_at DESC LIMIT 1000`, ledgerParams),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".ranking_configs ORDER BY role`),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".ranking_snapshots ORDER BY period DESC,role,revision DESC`),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".ranking_revisions ORDER BY created_at DESC`),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".doflow_goals WHERE deleted_at IS NULL ORDER BY starts_at DESC,created_at DESC`),
      this.dataSource.query(`SELECT name,enabled,configured,synthetic,required_secret_names,timeout_ms,max_attempts,health_state,last_error,updated_at FROM "${actor.schema}".automation_adapters ORDER BY name`),
    ]);
    const visibleGoals = access.canManageGoals
      ? goals
      : goals.filter((goal: any) => goal.target_type === 'user' && goal.target_id === actor.id);
    const mission = await this.mission(actor, access, visibleGoals.filter((goal: any) => goal.status === 'active'));
    return {
      pointPolicy: policyRows[0] ? this.pointPolicy(policyRows[0].formula || {}) : null,
      policy: policyRows[0] ? { id: policyRows[0].id, version: Number(policyRows[0].current_version), name: policyRows[0].name, formula: policyRows[0].formula } : null,
      pointLedger: ledgerRows.map((row: any) => this.mapLedger(row)),
      rankingConfigs: configs.map((row: any) => ({ role: row.role, metrics: row.metrics, formulaVersion: Number(row.formula_version), optimisticVersion: Number(row.optimistic_version) })),
      rankingSnapshots: this.effectiveSnapshots(snapshots, revisions, access, actor),
      goals: visibleGoals.map((row: any) => this.mapGoal(row)),
      mission,
      adapters,
      permissions: access,
    };
  }

  async updatePolicy(body: Record<string, unknown>) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.canManagePolicy, 'Gestione policy punti non autorizzata');
    const reason = this.text(body.reason, 'reason', true, 1_000);
    const formula = this.policyFormula((body.formula || body) as Record<string, unknown>);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".point_policies WHERE status='active' ORDER BY valid_from DESC LIMIT 1 FOR UPDATE`);
      if (!rows[0]) throw new NotFoundException('Policy punti non trovata');
      const next = Number(rows[0].current_version) + 1;
      await manager.query(
        `INSERT INTO "${actor.schema}".point_policy_versions (policy_id,version,formula,reason,created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [rows[0].id, next, JSON.stringify(formula), reason, actor.id],
      );
      await manager.query(`UPDATE "${actor.schema}".point_policies SET current_version=$2,updated_at=now() WHERE id=$1`, [rows[0].id, next]);
      await manager.query(
        `INSERT INTO "${actor.schema}".audit_log (actor_email,actor_role,action,target,metadata,created_at)
         VALUES ($1,$2,'point_policy_version_created',$3,$4::jsonb,now())`,
        [actor.email, actor.role, rows[0].id, JSON.stringify({ version: next, reason })],
      );
      return { id: rows[0].id, version: next, formula, pointPolicy: this.pointPolicy(formula) };
    });
  }

  async manualAdjustment(body: Record<string, unknown>, idempotencyKey: string) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.canManagePolicy, 'Rettifica ledger non autorizzata');
    const userId = this.uuid(body.userId, 'userId');
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000) throw new BadRequestException('amount non valido');
    const reason = this.text(body.reason, 'reason', true, 1_000);
    if (!idempotencyKey || idempotencyKey.length > 240) throw new BadRequestException('Idempotency-Key non valida');
    const operationId = this.operationUuid(idempotencyKey);
    return this.dataSource.transaction(async (manager) => {
      const policy = await manager.query(`SELECT id,current_version FROM "${actor.schema}".point_policies WHERE status='active' ORDER BY valid_from DESC LIMIT 1`);
      if (!policy[0]) throw new NotFoundException('Policy punti non trovata');
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".point_ledger
          (user_id,policy_id,policy_version,event_type,source_record_type,operation_id,amount,state,effective_at,actor_user_id,reason,metadata)
         VALUES ($1,$2,$3,'manual_adjustment','manual',$4,$5,'adjustment',now(),$6,$7,$8::jsonb)
         ON CONFLICT (operation_id,event_type,user_id) DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *`,
        [userId, policy[0].id, policy[0].current_version, operationId, amount, actor.id, reason, JSON.stringify({ idempotency_key: idempotencyKey })],
      );
      await manager.query(
        `INSERT INTO "${actor.schema}".audit_log (actor_email,actor_role,action,target,metadata,created_at)
         SELECT $1,$2,'point_ledger_adjusted',$3,$4::jsonb,now()
         WHERE NOT EXISTS (SELECT 1 FROM "${actor.schema}".audit_log WHERE action='point_ledger_adjusted' AND target=$3)`,
        [actor.email, actor.role, rows[0].id, JSON.stringify({ amount, reason })],
      );
      return this.mapLedger(rows[0]);
    });
  }

  async updateRankingConfig(roleValue: string, body: Record<string, unknown>) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.canManageRankings, 'Gestione classifiche non autorizzata');
    const role = String(roleValue || '');
    if (!ROLES.has(role)) throw new BadRequestException('Ruolo classifica non valido');
    if (!Array.isArray(body.metrics) || !body.metrics.length || body.metrics.length > 30) throw new BadRequestException('Metriche classifica non valide');
    const metrics = body.metrics.map((item) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('Metrica non valida');
      const metric = this.text((item as any).metric, 'metric', true, 100);
      const weight = Number((item as any).weight);
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new BadRequestException('Peso metrica non valido');
      return { metric, weight };
    });
    const version = Number(body.optimisticVersion);
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager.query(
        `UPDATE "${actor.schema}".ranking_configs SET metrics=$2::jsonb,formula_version=formula_version+1,
           optimistic_version=optimistic_version+1,updated_by=$3,updated_at=now()
         WHERE role=$1 AND optimistic_version=$4 RETURNING *`,
        [role, JSON.stringify(metrics), actor.id, version],
      );
      const rows = Array.isArray(updateResult[0]) && typeof updateResult[1] === 'number' ? updateResult[0] : updateResult;
      if (!rows[0]) throw new ConflictException('Configurazione classifica modificata da un altro utente');
      await manager.query(
        `INSERT INTO "${actor.schema}".ranking_config_versions (role,formula_version,metrics,reason,created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [role, rows[0].formula_version, JSON.stringify(metrics), this.text(body.reason, 'reason', false, 1_000) || 'Aggiornamento formula classifica', actor.id],
      );
      await manager.query(
        `INSERT INTO "${actor.schema}".audit_log (actor_email,actor_role,action,target,metadata,created_at)
         VALUES ($1,$2,'ranking_config_version_created',$3,$4::jsonb,now())`,
        [actor.email, actor.role, role, JSON.stringify({ formulaVersion: rows[0].formula_version })],
      );
      return { role, metrics: rows[0].metrics, formulaVersion: Number(rows[0].formula_version), optimisticVersion: Number(rows[0].optimistic_version) };
    });
  }

  private metricAccumulator() {
    return new Proxy<Record<string, number>>({}, { get: (target, key: string) => target[key] || 0 });
  }

  private async rankingRows(manager: EntityManager, actor: Actor, period: string, role: string, metricsConfig: Array<{ metric: string; weight: number }>) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Periodo non valido');
    const from = `${period}-01`;
    const toDate = new Date(`${from}T00:00:00Z`); toDate.setUTCMonth(toDate.getUTCMonth() + 1);
    const to = toDate.toISOString().slice(0, 10);
    const users = await manager.query(
      `SELECT DISTINCT tm.user_id,tm.display_name,COALESCE(array_agg(DISTINCT r.role) FILTER (WHERE r.role IS NOT NULL),'{}') AS roles
       FROM "${actor.schema}".team_members tm
       LEFT JOIN "${actor.schema}".doflow_user_roles r ON r.user_id=tm.user_id
       WHERE tm.user_id IS NOT NULL AND tm.deleted_at IS NULL AND tm.status='active'
       GROUP BY tm.user_id,tm.display_name`,
    );
    const ledger = await manager.query(
      `SELECT user_id,event_type,amount,source_record_id,metadata FROM "${actor.schema}".point_ledger
       WHERE effective_at >= $1 AND effective_at < $2 ORDER BY created_at`,
      [from, to],
    );
    const raw = users.flatMap((user: any) => {
      const roles = new Set<string>(user.roles || []);
      const participates = role === 'commercial' ? roles.has('commercial') : role === 'developer' ? roles.has('web_developer') : role === 'project_manager' ? roles.has('project_manager') : true;
      if (!participates) return [];
      const values = this.metricAccumulator();
      const paidRecords = new Set<string>();
      for (const entry of ledger.filter((item: any) => item.user_id === user.user_id)) {
        const metadata = entry.metadata || {};
        if (entry.event_type === 'sale_collected') {
          const euros = Number(metadata.euros || 0);
          values.gross_collected += euros; values.net_collected += euros;
          if (entry.source_record_id) paidRecords.add(entry.source_record_id);
        } else if (entry.event_type === 'refund') {
          const euros = Number(metadata.euros || 0); values.refunds += euros; values.net_collected -= euros;
        } else if (['on_time', 'early', 'late'].includes(entry.event_type)) values.on_time_activities += 1;
        else if (entry.event_type === 'qa_first_pass') { values.approved_technical_work += 1; values.qa_passed += 1; }
        else if (entry.event_type === 'qa_rejected') values.reopened_work += 1;
        else if (entry.event_type === 'reopened') values.reopened_work += 1;
        else if (entry.event_type === 'project_delivered') { values.delivered_projects += 1; if (metadata.on_time) values.on_time_projects += 1; }
      }
      values.paid_sales = paidRecords.size;
      values.average_collected_ticket = paidRecords.size ? Math.max(0, values.net_collected) / paidRecords.size : 0;
      return [{ userId: user.user_id, name: user.display_name, metrics: Object.fromEntries(metricsConfig.map(({ metric }) => [metric, Number(values[metric] || 0)])) }];
    });
    const maxima = Object.fromEntries(metricsConfig.map(({ metric }) => [metric, Math.max(0, ...raw.map((row: any) => Number(row.metrics[metric] || 0))) ]));
    const totalWeight = metricsConfig.reduce((sum, item) => sum + item.weight, 0);
    const scored = raw.map((row: any) => {
      const weighted = metricsConfig.reduce((sum, item) => {
        const max = Number(maxima[item.metric] || 0);
        const normalized = max ? Number(row.metrics[item.metric] || 0) / max : 0;
        return sum + normalized * item.weight * (PENALTY_METRICS.has(item.metric) ? -1 : 1);
      }, 0);
      return { ...row, score: Number(Math.max(0, Math.min(100, totalWeight ? weighted / totalWeight * 100 : 0)).toFixed(2)) };
    }).sort((a: any, b: any) => b.score - a.score || a.userId.localeCompare(b.userId));
    let position = 1;
    return scored.map((row: any, index: number) => {
      if (index > 0 && row.score !== scored[index - 1].score) position = index + 1;
      return { ...row, position, tied: scored.some((other: any) => other.userId !== row.userId && other.score === row.score) };
    });
  }

  async previewRanking(period: string, role: string) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    const configs = await this.dataSource.query(`SELECT * FROM "${actor.schema}".ranking_configs WHERE role=$1`, [role]);
    if (!configs[0]) throw new NotFoundException('Configurazione classifica non trovata');
    let rows = await this.dataSource.transaction((manager) => this.rankingRows(manager, actor, period, role, configs[0].metrics || []));
    if (!access.canViewGlobalPoints) rows = rows.filter((row: any) => row.userId === actor.id);
    if (!access.canViewFinance) rows = rows.map((row: any) => ({ ...row, metrics: Object.fromEntries(Object.entries(row.metrics).filter(([key]) => !ECONOMIC_METRICS.has(key))) }));
    return { period, role, formulaVersion: Number(configs[0].formula_version), rows };
  }

  async consolidateRanking(period: string, role: string, reasonValue?: unknown, supersedesId?: string) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.canManageRankings, 'Consolidamento classifica non autorizzato');
    if (!ROLES.has(role)) throw new BadRequestException('Ruolo classifica non valido');
    const currentPeriod = new Date().toISOString().slice(0, 7);
    if (period >= currentPeriod) throw new ConflictException('Si consolidano soltanto periodi chiusi');
    const reason = supersedesId ? this.text(reasonValue, 'reason', true, 1_000) : this.text(reasonValue, 'reason', false, 1_000) || 'Consolidamento periodo chiuso';
    return this.dataSource.transaction(async (manager) => {
      const configs = await manager.query(`SELECT * FROM "${actor.schema}".ranking_configs WHERE role=$1 FOR UPDATE`, [role]);
      if (!configs[0]) throw new NotFoundException('Configurazione classifica non trovata');
      const latest = await manager.query(`SELECT * FROM "${actor.schema}".ranking_snapshots WHERE period=$1 AND role=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE`, [period, role]);
      if (latest[0] && !supersedesId) throw new ConflictException('Snapshot del periodo già consolidato');
      if (supersedesId && latest[0]?.id !== supersedesId) throw new ConflictException('La revisione deve sostituire lo snapshot corrente');
      const rows = await this.rankingRows(manager, actor, period, role, configs[0].metrics || []);
      const eligible = rows.filter((row: any) => row.score > 0);
      if (!eligible.length) throw new ConflictException('Nessun dato reale consolidabile nel periodo');
      const top = eligible[0].score;
      const tied = eligible.filter((row: any) => row.score === top).map((row: any) => row.userId).sort();
      const revision = Number(latest[0]?.revision || 0) + 1;
      const inserted = await manager.query(
        `INSERT INTO "${actor.schema}".ranking_snapshots
          (period,role,revision,formula_version,scores,winner_user_id,tied_user_ids,consolidated_by,supersedes_id,reason)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::uuid[],$8,$9,$10) RETURNING *`,
        [period, role, revision, configs[0].formula_version, JSON.stringify(rows), tied[0], tied, actor.id, supersedesId || null, reason],
      );
      if (supersedesId) await manager.query(`INSERT INTO "${actor.schema}".ranking_revisions (snapshot_id,action,reason,actor_user_id) VALUES ($1,'superseded',$2,$3)`, [supersedesId, reason, actor.id]);
      await manager.query(
        `INSERT INTO "${actor.schema}".audit_log (actor_email,actor_role,action,target,metadata,created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,now())`,
        [actor.email, actor.role, supersedesId ? 'ranking_recalculated' : 'ranking_consolidated', inserted[0].id, JSON.stringify({ period, role, revision, reason })],
      );
      return { id: inserted[0].id, period, role, revision, winnerUserId: tied[0], tiedUserIds: tied, scores: rows, computedAt: inserted[0].consolidated_at, formulaVersion: Number(configs[0].formula_version), status: 'consolidated', supersedesId };
    });
  }

  async revokeSnapshot(snapshotIdValue: string, reasonValue: unknown) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.canManageRankings, 'Revoca classifica non autorizzata');
    const snapshotId = this.uuid(snapshotIdValue, 'snapshotId');
    const reason = this.text(reasonValue, 'reason', true, 1_000);
    const rows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".ranking_snapshots WHERE id=$1`, [snapshotId]);
    if (!rows[0]) throw new NotFoundException('Snapshot non trovato');
    const existing = await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".ranking_revisions WHERE snapshot_id=$1 AND action='revoked'`, [snapshotId]);
    if (existing[0]) throw new ConflictException('Snapshot già revocato');
    await this.dataSource.query(`INSERT INTO "${actor.schema}".ranking_revisions (snapshot_id,action,reason,actor_user_id) VALUES ($1,'revoked',$2,$3)`, [snapshotId, reason, actor.id]);
    return { id: snapshotId, status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: actor.id, revocationReason: reason };
  }

  async setSyntheticAdapter(enabled: boolean) {
    const actor = this.actor();
    await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    const access = await this.access(actor);
    this.assert(access.admin, 'Gestione adapter non autorizzata');
    if (process.env.AUTOMATION_ACCEPTANCE_SYNTHETIC_ADAPTER !== 'true') throw new ForbiddenException('Adapter sintetico modificabile soltanto nello stack acceptance');
    const rows = await this.dataSource.query(
      `UPDATE "${actor.schema}".automation_adapters SET enabled=$1,health_state=$2,updated_by=$3,updated_at=now()
       WHERE name='acceptance_synthetic' RETURNING name,enabled,configured,synthetic,health_state`,
      [enabled, enabled ? 'healthy' : 'disabled', actor.id],
    );
    return rows[0];
  }
}
