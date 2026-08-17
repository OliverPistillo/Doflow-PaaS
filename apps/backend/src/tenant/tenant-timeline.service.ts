import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { TenantCrmService } from './tenant-crm.service';
import { TenantEffectivePermissionsService } from './tenant-effective-permissions.service';
import { TenantProjectsService } from './tenant-projects.service';
import { ensureDoflowTimelineSchema } from './tenant-timeline-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD_KINDS = ['company', 'opportunity', 'project'] as const;
const QUICK_TYPES = ['activity', 'appointment', 'call', 'email', 'file', 'note', 'status_change', 'whatsapp'] as const;
const CALL_OUTCOMES = ['answered', 'busy', 'no_answer', 'other', 'rescheduled', 'voicemail'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const AUDIT_ACTIONS = [
  'crm_opportunity_stage_changed',
  'project_status_changed',
  'project_updated',
  'quote_accepted',
  'quote_rejected',
  'quotes_quotes_created',
  'quotes_quotes_updated',
  'material_requested',
  'material_received',
  'material_waived',
  'finance_invoice_created',
  'finance_invoice_created_from_project',
  'finance_invoice_created_from_quote',
  'finance_invoice_updated',
  'finance_payment_created',
  'finance_payment_updated',
  'finance_deadline_updated',
  'finance_renewal_updated',
] as const;

type RecordKind = typeof RECORD_KINDS[number];
type TimelineTarget = {
  kind: RecordKind;
  id: string;
  company_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  project_id: string | null;
};

export type TenantTimelineEvent = {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  project_id: string | null;
  type: string;
  channel: string;
  direction: string | null;
  author_user_id: string | null;
  author_label: string;
  created_at: string;
  status: string;
  outcome: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  source: string;
};

type Cursor = { created_at: string; id: string };

function text(value: unknown, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

function nullableText(value: unknown, max = 4000): string | null {
  const normalized = text(value, max);
  return normalized || null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function sanitizeMetadata(value: unknown, allowFinancial: boolean): Record<string, unknown> {
  const metadata = asObject(value);
  if (allowFinancial) return metadata;
  const hidden = /(amount|balance|cost|currency|discount|payment|price|rate|subtotal|tax|total)/i;
  const scrub = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(scrub);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.entries(entry as Record<string, unknown>)
      .filter(([key]) => !hidden.test(key))
      .map(([key, nested]) => [key, scrub(nested)]));
  };
  return scrub(metadata) as Record<string, unknown>;
}

@Injectable()
export class TenantTimelineService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly crm: TenantCrmService,
    private readonly projects: TenantProjectsService,
    private readonly permissions: TenantEffectivePermissionsService,
  ) {}

  private getUser() {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema() {
    const user = this.request.user || this.request.authUser;
    const schema = safeSchema(user?.tenantId || user?.tenant_id || this.request.tenantId || 'public', 'TenantTimelineService.getSchema');
    if (!isDoflowTenant(schema)) throw new ForbiddenException('Timeline operativa disponibile soltanto per Doflow.');
    return schema;
  }

  private requireUuid(value: unknown, label: string) {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private recordKind(value: unknown): RecordKind {
    const kind = String(value || '').trim() as RecordKind;
    if (!(RECORD_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('record_kind non valido');
    return kind;
  }

  private normalizeLimit(value: unknown) {
    const numeric = Number(value || 20);
    return Number.isFinite(numeric) ? Math.max(1, Math.min(50, Math.trunc(numeric))) : 20;
  }

  private parseDate(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    if (!Number.isFinite(date.getTime())) throw new BadRequestException(`${label} non valido`);
    return date.toISOString();
  }

  private parseCursor(value: unknown): Cursor | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')) as Cursor;
      if (!parsed?.id || !Number.isFinite(new Date(parsed.created_at).getTime())) throw new Error('invalid');
      return { created_at: new Date(parsed.created_at).toISOString(), id: String(parsed.id) };
    } catch {
      throw new BadRequestException('cursor non valido');
    }
  }

  private encodeCursor(event: TenantTimelineEvent) {
    return Buffer.from(JSON.stringify({ created_at: event.created_at, id: event.id }), 'utf8').toString('base64url');
  }

  private async ensureSchema(schema: string) {
    await ensureDoflowTimelineSchema(this.dataSource, schema);
  }

  private async resolveTarget(kind: RecordKind, id: string, write: boolean): Promise<TimelineTarget> {
    const access = await this.permissions.getCurrentAccess();
    const moduleKey = kind === 'project' ? 'projects' : 'crm';
    const capability = access.modules[moduleKey];
    if (!capability?.can_view || (write && !capability.can_create)) {
      throw new ForbiddenException(write ? 'Permesso di creazione richiesto.' : 'Permesso di lettura richiesto.');
    }

    if (kind === 'company') {
      const company = await this.crm.findOne('companies', id);
      return { kind, id, company_id: id, contact_id: null, opportunity_id: null, project_id: null };
    }
    if (kind === 'opportunity') {
      const opportunity = await this.crm.findOne('opportunities', id);
      return {
        kind,
        id,
        company_id: UUID_RE.test(String(opportunity.company_id || '')) ? opportunity.company_id : null,
        contact_id: UUID_RE.test(String(opportunity.contact_id || '')) ? opportunity.contact_id : null,
        opportunity_id: id,
        project_id: null,
      };
    }
    const project = await this.projects.getProject(id);
    return {
      kind,
      id,
      company_id: UUID_RE.test(String(project.company_id || '')) ? project.company_id : null,
      contact_id: UUID_RE.test(String(project.contact_id || '')) ? project.contact_id : null,
      opportunity_id: UUID_RE.test(String(project.opportunity_id || '')) ? project.opportunity_id : null,
      project_id: id,
    };
  }

  private targetSql(target: TimelineTarget, activityAlias: string, projectAlias: string) {
    if (target.kind === 'company') return `(${activityAlias}.company_id = $1 OR ${projectAlias}.company_id = $1)`;
    if (target.kind === 'opportunity') return `(${activityAlias}.opportunity_id = $1 OR ${projectAlias}.opportunity_id = $1)`;
    return `${activityAlias}.project_id = $1`;
  }

  private addTimeConditions(where: string[], params: unknown[], alias: string, dateFrom: string | null, dateTo: string | null, cursor: Cursor | null) {
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`${alias}.created_at >= $${params.length}::timestamptz`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`${alias}.created_at <= $${params.length}::timestamptz`);
    }
    if (cursor) {
      params.push(cursor.created_at);
      where.push(`${alias}.created_at <= $${params.length}::timestamptz`);
    }
  }

  private normalizeEvent(row: Record<string, any>): TenantTimelineEvent {
    return {
      id: String(row.id),
      contact_id: UUID_RE.test(String(row.contact_id || '')) ? row.contact_id : null,
      company_id: UUID_RE.test(String(row.company_id || '')) ? row.company_id : null,
      opportunity_id: UUID_RE.test(String(row.opportunity_id || '')) ? row.opportunity_id : null,
      project_id: UUID_RE.test(String(row.project_id || '')) ? row.project_id : null,
      type: String(row.type || 'activity'),
      channel: String(row.channel || 'internal'),
      direction: nullableText(row.direction, 30),
      author_user_id: UUID_RE.test(String(row.author_user_id || '')) ? row.author_user_id : null,
      author_label: nullableText(row.author_label, 200) || 'Sistema',
      created_at: new Date(row.created_at).toISOString(),
      status: String(row.status || 'recorded'),
      outcome: nullableText(row.outcome, 80),
      title: nullableText(row.title, 300) || 'Aggiornamento',
      body: nullableText(row.body, 10000),
      metadata: asObject(row.metadata),
      source: String(row.source || 'domain'),
    };
  }

  private async loadActivities(schema: string, target: TimelineTarget, options: any) {
    const params: unknown[] = [target.id];
    const where = ['a.deleted_at IS NULL', this.targetSql(target, 'a', 'p')];
    const normalizedType = `CASE WHEN a.type IN ('meeting', 'appointment') THEN 'appointment'
                                 WHEN a.type IN ('task', 'activity', 'follow_up') THEN 'activity'
                                 ELSE a.type END`;
    this.addTimeConditions(where, params, 'a', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorId) {
      params.push(options.operatorId);
      where.push(`a.created_by = $${params.length}::uuid`);
    }
    if (options.types.length) {
      params.push(options.types);
      where.push(`${normalizedType} = ANY($${params.length}::text[])`);
    }
    if (options.outcome) {
      params.push(options.outcome);
      where.push(`COALESCE(a.outcome, a.status) = $${params.length}`);
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'activity:' || a.id::text AS id,
              a.contact_id, COALESCE(a.company_id, p.company_id) AS company_id,
              COALESCE(a.opportunity_id, p.opportunity_id) AS opportunity_id, a.project_id,
              ${normalizedType} AS type,
              COALESCE(a.channel, CASE WHEN a.type = 'call' THEN 'phone' WHEN a.type IN ('email', 'whatsapp') THEN a.type ELSE 'internal' END) AS channel,
              a.direction, a.created_by AS author_user_id, COALESCE(u.email, 'Sistema') AS author_label,
              a.created_at,
              COALESCE(a.status, CASE WHEN a.completed_at IS NOT NULL THEN 'completed' ELSE 'pending' END) AS status,
              a.outcome, a.title, a.description AS body,
              COALESCE(a.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('due_at', a.due_at, 'completed_at', a.completed_at)) AS metadata,
              'commercial_activity' AS source
       FROM "${schema}".commercial_activities a
       LEFT JOIN "${schema}".projects p ON p.id = a.project_id AND p.deleted_at IS NULL
       LEFT JOIN "${schema}".users u ON u.id = a.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row: any) => this.normalizeEvent(row));
  }

  private async loadProjectComments(schema: string, target: TimelineTarget, options: any) {
    const params: unknown[] = [target.id];
    const where = ['pc.deleted_at IS NULL'];
    if (target.kind === 'company') where.push('p.company_id = $1');
    else if (target.kind === 'opportunity') where.push('p.opportunity_id = $1');
    else where.push('p.id = $1');
    this.addTimeConditions(where, params, 'pc', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorId) {
      params.push(options.operatorId);
      where.push(`pc.created_by = $${params.length}::uuid`);
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'comment:' || pc.id::text AS id, p.contact_id, p.company_id, p.opportunity_id, p.id AS project_id,
              'note' AS type,
              CASE WHEN pc.visibility = 'internal' THEN 'internal' ELSE 'client' END AS channel,
              NULL::text AS direction,
              pc.created_by AS author_user_id, COALESCE(u.email, 'Sistema') AS author_label,
              pc.created_at, 'recorded' AS status, NULL::text AS outcome,
              'Nota progetto' AS title, pc.body,
              jsonb_build_object('visibility', pc.visibility) AS metadata, 'project_comment' AS source
       FROM "${schema}".project_comments pc
       LEFT JOIN "${schema}".tasks t ON t.id = pc.task_id AND t.deleted_at IS NULL
       JOIN "${schema}".projects p ON p.id = COALESCE(pc.project_id, t.project_id) AND p.deleted_at IS NULL
       LEFT JOIN "${schema}".users u ON u.id = pc.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY pc.created_at DESC, pc.id DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row: any) => this.normalizeEvent(row));
  }

  private async loadProjectTasks(schema: string, target: TimelineTarget, options: any) {
    const params: unknown[] = [target.id];
    const where = ['t.deleted_at IS NULL'];
    if (target.kind === 'company') where.push('p.company_id = $1');
    else if (target.kind === 'opportunity') where.push('p.opportunity_id = $1');
    else where.push('p.id = $1');
    this.addTimeConditions(where, params, 't', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorId) {
      params.push(options.operatorId);
      where.push(`t.created_by = $${params.length}::uuid`);
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'task:' || t.id::text AS id, p.contact_id, p.company_id, p.opportunity_id, p.id AS project_id,
              'activity' AS type, 'project' AS channel, NULL::text AS direction,
              t.created_by AS author_user_id, COALESCE(u.email, 'Sistema') AS author_label,
              t.created_at, t.status, NULL::text AS outcome, t.title, t.description AS body,
              jsonb_strip_nulls(jsonb_build_object('priority', t.priority, 'due_at', t.due_at, 'completed_at', t.completed_at)) AS metadata,
              'project_task' AS source
       FROM "${schema}".tasks t
       JOIN "${schema}".projects p ON p.id = t.project_id AND p.deleted_at IS NULL
       LEFT JOIN "${schema}".users u ON u.id = t.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row: any) => this.normalizeEvent(row));
  }

  private async tableExists(schema: string, table: string) {
    const rows = await this.dataSource.query(`SELECT to_regclass($1) AS name`, [`"${schema}"."${table}"`]).catch(() => []);
    return Boolean(rows[0]?.name);
  }

  private async relatedAuditTargets(schema: string, target: TimelineTarget, access: any) {
    const ids = new Set<string>([target.id]);
    const collect = async (table: string, condition: string, params: unknown[]) => {
      if (!(await this.tableExists(schema, table))) return;
      const rows = await this.dataSource.query(`SELECT id::text AS id FROM "${schema}".${table} WHERE ${condition} AND deleted_at IS NULL`, params);
      rows.forEach((row: any) => { if (row.id) ids.add(String(row.id)); });
    };
    if (target.kind === 'company') {
      await collect('projects', 'company_id = $1', [target.id]);
      await collect('opportunities', 'company_id = $1', [target.id]);
      if (access.modules.quotes?.can_view) await collect('quotes', 'company_id = $1', [target.id]);
      if (access.modules.contracts?.can_view) await collect('contracts', 'company_id = $1', [target.id]);
      if (access.modules.finance?.can_view) {
        await collect('invoices', 'company_id = $1', [target.id]);
        await collect('payments', 'company_id = $1', [target.id]);
        await collect('financial_deadlines', 'company_id = $1', [target.id]);
        await collect('recurring_services', 'company_id = $1', [target.id]);
        await collect('renewals', 'company_id = $1', [target.id]);
      }
    } else if (target.kind === 'opportunity') {
      await collect('projects', 'opportunity_id = $1', [target.id]);
      if (access.modules.quotes?.can_view) await collect('quotes', 'opportunity_id = $1', [target.id]);
      if (access.modules.contracts?.can_view) await collect('contracts', 'opportunity_id = $1', [target.id]);
      if (access.modules.finance?.can_view) {
        await collect('invoices', 'opportunity_id = $1', [target.id]);
        await collect('payments', `EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = invoice_id AND i.opportunity_id = $1 AND i.deleted_at IS NULL)`, [target.id]);
        await collect('financial_deadlines', `EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = invoice_id AND i.opportunity_id = $1 AND i.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = quote_id AND q.opportunity_id = $1 AND q.deleted_at IS NULL)`, [target.id]);
        await collect('recurring_services', `EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = quote_id AND q.opportunity_id = $1 AND q.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".projects p WHERE p.id = project_id AND p.opportunity_id = $1 AND p.deleted_at IS NULL)`, [target.id]);
        await collect('renewals', `EXISTS (SELECT 1 FROM "${schema}".recurring_services rs WHERE rs.id = recurring_service_id AND rs.deleted_at IS NULL AND (EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = rs.quote_id AND q.opportunity_id = $1 AND q.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".projects p WHERE p.id = rs.project_id AND p.opportunity_id = $1 AND p.deleted_at IS NULL)))`, [target.id]);
      }
    } else {
      if (target.opportunity_id) ids.add(target.opportunity_id);
      if (access.modules.quotes?.can_view && target.opportunity_id) await collect('quotes', 'opportunity_id = $1', [target.opportunity_id]);
      if (access.modules.contracts?.can_view) await collect('contracts', 'project_id = $1', [target.id]);
      if (access.modules.finance?.can_view) {
        await collect('invoices', 'project_id = $1', [target.id]);
        await collect('payments', 'project_id = $1', [target.id]);
        await collect('financial_deadlines', 'project_id = $1', [target.id]);
        await collect('recurring_services', 'project_id = $1', [target.id]);
        await collect('renewals', 'project_id = $1', [target.id]);
      }
    }
    return [...ids];
  }

  private auditTitle(action: string, metadata: Record<string, unknown> = {}) {
    const titles: Record<string, string> = {
      crm_opportunity_stage_changed: 'Fase commerciale aggiornata',
      project_status_changed: 'Stato progetto aggiornato',
      project_updated: 'Progetto aggiornato',
      quote_accepted: 'Preventivo accettato',
      quote_rejected: 'Preventivo rifiutato',
      quotes_quotes_created: 'Preventivo creato',
      quotes_quotes_updated: 'Preventivo aggiornato',
      material_requested: 'Materiale richiesto',
      material_received: 'Materiale ricevuto',
      material_waived: 'Materiale non necessario',
      finance_invoice_created: 'Fattura creata',
      finance_invoice_created_from_project: 'Fattura creata dal progetto',
      finance_invoice_created_from_quote: 'Fattura creata dal preventivo',
      finance_invoice_updated: 'Fattura aggiornata',
      finance_payment_created: 'Pagamento registrato',
      finance_payment_updated: 'Pagamento aggiornato',
      finance_deadline_updated: metadata.status === 'completed' ? 'Scadenza completata' : 'Scadenza aggiornata',
      finance_renewal_updated: metadata.status === 'paid' ? 'Rinnovo completato' : 'Rinnovo aggiornato',
    };
    return titles[action] || 'Aggiornamento di sistema';
  }

  private async loadAudit(schema: string, target: TimelineTarget, options: any, access: any) {
    const targetIds = await this.relatedAuditTargets(schema, target, access);
    const allowed = AUDIT_ACTIONS.filter((action) => access.modules.finance?.can_view || !action.startsWith('finance_'));
    const params: unknown[] = [targetIds, allowed];
    const where = ['a.target = ANY($1::text[])', 'a.action = ANY($2::text[])'];
    this.addTimeConditions(where, params, 'a', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorEmail) {
      params.push(options.operatorEmail);
      where.push(`lower(a.actor_email) = lower($${params.length})`);
    } else if (options.operatorId) {
      return [];
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'audit:' || a.id::text AS id, a.action, a.actor_email, a.created_at,
              COALESCE(a.metadata, '{}'::jsonb) AS metadata
       FROM "${schema}".audit_log a
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row: any) => {
      const metadata = sanitizeMetadata(row.metadata, Boolean(access.modules.finance?.can_view));
      const next = nullableText(metadata.new_status || metadata.new_stage || metadata.status, 80);
      return this.normalizeEvent({
        id: row.id,
        contact_id: target.contact_id,
        company_id: target.company_id,
        opportunity_id: target.opportunity_id,
        project_id: target.project_id,
        type: row.action === 'project_updated' || row.action.startsWith('material_') || row.action === 'finance_payment_created' || row.action === 'finance_payment_updated' || row.action === 'finance_deadline_updated' || row.action === 'finance_renewal_updated' ? 'activity' : 'status_change',
        channel: 'system',
        direction: null,
        author_user_id: null,
        author_label: row.actor_email || 'Sistema',
        created_at: row.created_at,
        status: next || 'recorded',
        outcome: next,
        title: this.auditTitle(row.action, metadata),
        body: null,
        metadata,
        source: 'audit_log',
      });
    });
  }

  private async loadDocumentActivity(schema: string, target: TimelineTarget, options: any, access: any) {
    if (!access.modules.documents?.can_view || !(await this.tableExists(schema, 'document_activity'))) return [];
    const params: unknown[] = [target.id];
    const where = [target.kind === 'company'
      ? `(a.entity_type = 'company' AND a.entity_id = $1::uuid OR a.entity_type = 'project' AND EXISTS (SELECT 1 FROM "${schema}".projects dp WHERE dp.id = a.entity_id AND dp.company_id = $1::uuid AND dp.deleted_at IS NULL))`
      : target.kind === 'opportunity'
        ? `(a.entity_type = 'opportunity' AND a.entity_id = $1::uuid OR a.entity_type = 'project' AND EXISTS (SELECT 1 FROM "${schema}".projects dp WHERE dp.id = a.entity_id AND dp.opportunity_id = $1::uuid AND dp.deleted_at IS NULL))`
        : `a.entity_type = 'project' AND a.entity_id = $1::uuid`];
    this.addTimeConditions(where, params, 'a', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorId) {
      params.push(options.operatorId);
      where.push(`a.actor_user_id = $${params.length}::uuid`);
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'document:' || a.id::text AS id, a.actor_user_id AS author_user_id,
              COALESCE(u.email, 'Sistema') AS author_label, a.created_at, a.action,
              COALESCE(a.metadata, '{}'::jsonb) AS metadata
       FROM "${schema}".document_activity a
       LEFT JOIN "${schema}".users u ON u.id = a.actor_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length}`,
      params,
    );
    const titles: Record<string, string> = {
      uploaded: 'File caricato',
      version_created: 'Nuova versione file',
      archived: 'File archiviato',
      restored: 'File ripristinato',
      linked: 'File collegato',
      unlinked: 'File scollegato',
    };
    return rows.map((row: any) => this.normalizeEvent({
      id: row.id,
      contact_id: target.contact_id,
      company_id: target.company_id,
      opportunity_id: target.opportunity_id,
      project_id: target.project_id,
      type: 'file',
      channel: 'document',
      author_user_id: row.author_user_id,
      author_label: row.author_label,
      created_at: row.created_at,
      status: row.action,
      title: titles[row.action] || 'File aggiornato',
      metadata: row.metadata,
      source: 'document_activity',
    }));
  }

  private async loadContractActivity(schema: string, target: TimelineTarget, options: any, access: any) {
    if (!access.modules.contracts?.can_view || !(await this.tableExists(schema, 'contract_activity'))) return [];
    const params: unknown[] = [target.id];
    const where = ['c.deleted_at IS NULL'];
    if (target.kind === 'company') where.push('c.company_id = $1');
    else if (target.kind === 'opportunity') where.push('c.opportunity_id = $1');
    else where.push('c.project_id = $1');
    this.addTimeConditions(where, params, 'a', options.dateFrom, options.dateTo, options.cursor);
    if (options.operatorId) {
      params.push(options.operatorId);
      where.push(`a.actor_user_id = $${params.length}::uuid`);
    }
    params.push(options.sourceLimit);
    const rows = await this.dataSource.query(
      `SELECT 'contract:' || a.id::text AS id, c.contact_id, c.company_id, c.opportunity_id, c.project_id,
              CASE WHEN a.action ~ '(status|sent|signed|approved|activated|cancelled)' THEN 'status_change' ELSE 'activity' END AS type,
              'contract' AS channel, NULL::text AS direction, a.actor_user_id AS author_user_id,
              COALESCE(u.email, 'Sistema') AS author_label, a.created_at, a.action AS status,
              a.action AS outcome, 'Contratto aggiornato' AS title, NULL::text AS body,
              COALESCE(a.metadata, '{}'::jsonb) AS metadata, 'contract_activity' AS source
       FROM "${schema}".contract_activity a
       JOIN "${schema}".contracts c ON c.id = a.contract_id
       LEFT JOIN "${schema}".users u ON u.id = a.actor_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((row: any) => this.normalizeEvent({
      ...row,
      metadata: sanitizeMetadata(row.metadata, Boolean(access.modules.finance?.can_view)),
    }));
  }

  async list(query: Record<string, any>) {
    const schema = this.getSchema();
    const kind = this.recordKind(query.record_kind);
    const recordId = this.requireUuid(query.record_id, 'record_id');
    const target = await this.resolveTarget(kind, recordId, false);
    await this.ensureSchema(schema);
    const access = await this.permissions.getCurrentAccess();
    const limit = this.normalizeLimit(query.limit);
    const cursor = this.parseCursor(query.cursor);
    const dateFrom = this.parseDate(query.date_from, 'date_from');
    const dateTo = this.parseDate(query.date_to, 'date_to');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('Intervallo date non valido');
    const operatorId = query.operator_id ? this.requireUuid(query.operator_id, 'operator_id') : null;
    let operatorEmail: string | null = null;
    if (operatorId) {
      const rows = await this.dataSource.query(`SELECT email FROM "${schema}".users WHERE id = $1 LIMIT 1`, [operatorId]);
      operatorEmail = nullableText(rows[0]?.email, 200);
    }
    const types = String(query.types || '').split(',').map((value) => value.trim()).filter(Boolean);
    if (types.some((value) => !(QUICK_TYPES as readonly string[]).includes(value))) throw new BadRequestException('types non valido');
    const outcome = nullableText(query.outcome, 80);
    const options = { cursor, dateFrom, dateTo, operatorId, operatorEmail, types, outcome, sourceLimit: Math.min(204, (limit + 1) * 4) };
    const wants = (...eventTypes: string[]) => !types.length || eventTypes.some((type) => types.includes(type));

    const [activities, comments, tasks, audits, documents, contracts] = await Promise.all([
      wants('activity', 'appointment', 'call', 'email', 'note', 'whatsapp') ? this.loadActivities(schema, target, options) : Promise.resolve([]),
      wants('note') ? this.loadProjectComments(schema, target, options) : Promise.resolve([]),
      wants('activity') ? this.loadProjectTasks(schema, target, options) : Promise.resolve([]),
      wants('activity', 'status_change') ? this.loadAudit(schema, target, options, access) : Promise.resolve([]),
      wants('file') ? this.loadDocumentActivity(schema, target, options, access) : Promise.resolve([]),
      wants('activity', 'status_change') ? this.loadContractActivity(schema, target, options, access) : Promise.resolve([]),
    ]);
    let events = [...activities, ...comments, ...tasks, ...audits, ...documents, ...contracts]
      .filter((event) => !types.length || types.includes(event.type))
      .filter((event) => !outcome || event.outcome === outcome || event.status === outcome)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    if (cursor) {
      events = events.filter((event) => event.created_at < cursor.created_at || (event.created_at === cursor.created_at && event.id < cursor.id));
    }
    const page = events.slice(0, limit);
    return {
      items: page,
      next_cursor: events.length > limit && page.length ? this.encodeCursor(page[page.length - 1]) : null,
      has_more: events.length > limit,
    };
  }

  private eventTarget(body: Record<string, any>) {
    return {
      kind: this.recordKind(body.record_kind),
      id: this.requireUuid(body.record_id, 'record_id'),
    };
  }

  private async insertActivity(target: TimelineTarget, values: Record<string, unknown>) {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".commercial_activities (
         company_id, contact_id, opportunity_id, project_id, type, title, description,
         due_at, completed_at, assigned_to, created_by, updated_by,
         channel, direction, status, outcome, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $11,
         $12, $13, $14, $15, $16::jsonb, now(), now()
       ) RETURNING *`,
      [
        target.company_id, target.contact_id, target.opportunity_id, target.project_id,
        values.type, values.title, values.description || null, values.due_at || null,
        values.completed_at || null, values.assigned_to || null,
        UUID_RE.test(user.id) ? user.id : null, values.channel, values.direction || null,
        values.status, values.outcome || null, JSON.stringify({ timeline_event: true, ...(values.metadata as Record<string, unknown> || {}) }),
      ],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Evento non creato');
    return this.normalizeEvent({
      id: `activity:${row.id}`,
      ...row,
      author_user_id: row.created_by,
      author_label: user.email || 'Utente autenticato',
      body: row.description,
      source: 'commercial_activity',
    });
  }

  async createNote(body: Record<string, any>) {
    const record = this.eventTarget(body);
    const target = await this.resolveTarget(record.kind, record.id, true);
    const note = text(body.body, 10000);
    if (!note) throw new BadRequestException('Testo nota obbligatorio');
    return this.insertActivity(target, {
      type: 'note', title: nullableText(body.title, 300) || 'Nota interna', description: note,
      channel: 'internal', status: 'recorded', metadata: { visibility: 'internal' },
    });
  }

  async createActivity(body: Record<string, any>) {
    const record = this.eventTarget(body);
    const target = await this.resolveTarget(record.kind, record.id, true);
    const title = text(body.title, 300);
    if (!title) throw new BadRequestException('Titolo attività obbligatorio');
    const assignedTo = body.assigned_to ? this.requireUuid(body.assigned_to, 'assigned_to') : null;
    const dueAt = this.parseDate(body.due_at, 'due_at');
    const priority = String(body.priority || 'medium');
    if (!(PRIORITIES as readonly string[]).includes(priority)) throw new BadRequestException('Priorità non valida');
    return this.insertActivity(target, {
      type: 'activity', title, description: nullableText(body.description, 10000), due_at: dueAt,
      assigned_to: assignedTo, channel: 'internal', status: 'pending', metadata: { priority },
    });
  }

  async createAppointment(body: Record<string, any>) {
    const record = this.eventTarget(body);
    const target = await this.resolveTarget(record.kind, record.id, true);
    const title = text(body.title, 300);
    if (!title) throw new BadRequestException('Titolo appuntamento obbligatorio');
    const dueAt = this.parseDate(body.due_at, 'due_at');
    if (!dueAt) throw new BadRequestException('Data e ora obbligatorie');
    const assignedTo = body.assigned_to ? this.requireUuid(body.assigned_to, 'assigned_to') : null;
    return this.insertActivity(target, {
      type: 'appointment', title, description: nullableText(body.description, 10000), due_at: dueAt,
      assigned_to: assignedTo, channel: 'meeting', status: 'scheduled', metadata: {},
    });
  }

  async createCall(body: Record<string, any>) {
    const record = this.eventTarget(body);
    const target = await this.resolveTarget(record.kind, record.id, true);
    if (body.confirmed !== true) throw new BadRequestException('Conferma manuale chiamata obbligatoria');
    const number = text(body.number, 80);
    if (!number) throw new BadRequestException('Numero obbligatorio');
    const outcome = String(body.outcome || '');
    if (!(CALL_OUTCOMES as readonly string[]).includes(outcome)) throw new BadRequestException('Esito chiamata non valido');
    const duration = body.duration_minutes === '' || body.duration_minutes === undefined ? null : Number(body.duration_minutes);
    if (duration !== null && (!Number.isFinite(duration) || duration < 0 || duration > 1440)) throw new BadRequestException('Durata non valida');
    return this.insertActivity(target, {
      type: 'call', title: nullableText(body.title, 300) || 'Chiamata in uscita',
      description: nullableText(body.body, 10000), completed_at: new Date().toISOString(),
      channel: 'phone', direction: 'outbound', status: 'manually_confirmed', outcome,
      metadata: { number, duration_minutes: duration, confirmation: 'manual' },
    });
  }

  async createExternalMessage(body: Record<string, any>) {
    const record = this.eventTarget(body);
    const target = await this.resolveTarget(record.kind, record.id, true);
    if (body.confirmed !== true) throw new BadRequestException('Conferma manuale invio obbligatoria');
    const channel = String(body.channel || '');
    if (!['email', 'whatsapp'].includes(channel)) throw new BadRequestException('Canale esterno non valido');
    const destination = text(body.destination, 320);
    const message = text(body.body, 10000);
    if (!destination || !message) throw new BadRequestException('Destinatario e messaggio obbligatori');
    return this.insertActivity(target, {
      type: channel, title: nullableText(body.title, 300) || (channel === 'email' ? 'Email in uscita' : 'Messaggio WhatsApp'),
      description: message, completed_at: new Date().toISOString(), channel, direction: 'outbound',
      status: 'manually_confirmed', outcome: 'sent',
      metadata: { destination, confirmation: 'manual', provider_delivery: false },
    });
  }
}
