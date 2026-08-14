import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureLeadIntakeSubmissionsTable } from '../public-lead-intake/public-lead-intake-schema';
import { isPublicLeadIntakeTenantEnabled } from '../public-lead-intake/public-lead-intake-tenants';
import { hasRoleAtLeast } from '../roles';
import {
  aliasesForCommercialStage,
  COMMERCIAL_OUTCOME_STAGES,
  COMMERCIAL_POSITIVE_STAGES,
  commercialStageLabel,
  isDoflowTenant,
  normalizeCommercialStage,
} from './commercial-stage-model';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';

type ResourceKey = 'companies' | 'contacts' | 'leads' | 'opportunities' | 'activities';

type ResourceConfig = {
  table: string;
  required: string[];
  writable: string[];
  searchable: string[];
  filters: string[];
  sort: string[];
  defaultSort: string;
  joins?: string;
  selectExtra?: string;
  intakeLink?: 'lead_id' | 'opportunity_id';
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESOURCES: Record<ResourceKey, ResourceConfig> = {
  companies: {
    table: 'companies',
    required: ['name'],
    writable: [
      'name', 'legal_name', 'vat_number', 'fiscal_code', 'website', 'email', 'phone',
      'industry', 'size', 'status', 'source', 'address', 'city', 'province', 'country',
      'notes', 'owner_user_id',
    ],
    searchable: ['name', 'legal_name', 'vat_number', 'email', 'phone', 'city'],
    filters: ['status', 'owner_user_id'],
    sort: ['created_at', 'updated_at', 'name'],
    defaultSort: 'updated_at',
  },
  contacts: {
    table: 'contacts',
    required: ['first_name'],
    writable: [
      'company_id', 'first_name', 'last_name', 'role_title', 'email', 'phone',
      'decision_level', 'preferred_channel', 'notes', 'is_primary',
    ],
    searchable: ['first_name', 'last_name', 'email', 'phone', 'role_title'],
    filters: ['company_id', 'decision_level'],
    sort: ['created_at', 'updated_at', 'first_name'],
    defaultSort: 'updated_at',
    joins: 'LEFT JOIN "{schema}".companies c ON c.id = t.company_id',
    selectExtra: ', c.name AS company_name',
  },
  leads: {
    table: 'leads',
    required: ['title'],
    writable: [
      'company_id', 'contact_id', 'title', 'source', 'interest', 'budget_estimate',
      'urgency', 'quality', 'status', 'assigned_to', 'next_action', 'next_action_at',
      'lost_reason', 'notes',
    ],
    searchable: ['title', 'source', 'interest', 'next_action', 'notes'],
    filters: ['status', 'company_id', 'contact_id', 'assigned_to'],
    sort: ['created_at', 'updated_at', 'next_action_at'],
    defaultSort: 'updated_at',
    joins: `
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
      LEFT JOIN "{schema}".contacts ct ON ct.id = t.contact_id
    `,
    selectExtra: `, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name`,
    intakeLink: 'lead_id',
  },
  opportunities: {
    table: 'opportunities',
    required: ['title'],
    writable: [
      'company_id', 'contact_id', 'lead_id', 'title', 'service_type', 'value_estimate',
      'lead_source', 'lead_interest', 'lead_urgency', 'probability', 'stage',
      'expected_close_date', 'assigned_to', 'next_action', 'next_action_at',
      'lost_reason', 'notes',
    ],
    searchable: ['title', 'service_type', 'next_action', 'notes'],
    filters: ['stage', 'company_id', 'contact_id', 'lead_id', 'assigned_to'],
    sort: ['created_at', 'updated_at', 'next_action_at', 'expected_close_date'],
    defaultSort: 'updated_at',
    joins: `
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
      LEFT JOIN "{schema}".contacts ct ON ct.id = t.contact_id
      LEFT JOIN "{schema}".leads l ON l.id = t.lead_id
    `,
    selectExtra: `, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name, ct.email AS contact_email, ct.phone AS contact_phone, l.title AS lead_title, COALESCE(t.lead_source, l.source) AS lead_source, COALESCE(t.lead_interest, l.interest) AS lead_interest, COALESCE(t.lead_urgency, l.urgency) AS lead_urgency`,
    intakeLink: 'opportunity_id',
  },
  activities: {
    table: 'commercial_activities',
    required: ['type', 'title'],
    writable: [
      'company_id', 'contact_id', 'lead_id', 'opportunity_id', 'type', 'title',
      'description', 'due_at', 'completed_at', 'assigned_to',
    ],
    searchable: ['title', 'description', 'type'],
    filters: ['type', 'company_id', 'contact_id', 'lead_id', 'opportunity_id', 'assigned_to'],
    sort: ['created_at', 'updated_at', 'due_at'],
    defaultSort: 'due_at',
    joins: `
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
      LEFT JOIN "{schema}".contacts ct ON ct.id = t.contact_id
      LEFT JOIN "{schema}".leads l ON l.id = t.lead_id
      LEFT JOIN "{schema}".opportunities o ON o.id = t.opportunity_id
    `,
    selectExtra: `, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name, l.title AS lead_title, o.title AS opportunity_title`,
  },
};

const PIPELINE_STAGES = [
  'new_lead',
  'to_contact',
  'contacted',
  'call_scheduled',
  'briefing_sent',
  'briefing_received',
  'quote_preparation',
  'quote_sent',
  'follow_up',
  'accepted',
  'lost',
  'paused',
];

@Injectable()
export class TenantCrmService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
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

  private getSchema(): string {
    const user = this.request.user || this.request.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantCrmService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Tenant CRM non disponibile nel contesto public');
    return schema;
  }

  private assertCrmAccess(write = false) {
    const user = this.getUser();
    if (!hasRoleAtLeast(user.role, 'manager')) {
      throw new ForbiddenException(write ? 'Manager o superiore richiesto per modificare il CRM.' : 'Manager o superiore richiesto per leggere il CRM.');
    }
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantCrmCoreTables(this.dataSource, schema);
    if (isPublicLeadIntakeTenantEnabled(schema)) {
      await ensureLeadIntakeSubmissionsTable(this.dataSource, schema);
    }
  }

  private getConfig(resource: ResourceKey): ResourceConfig {
    const config = RESOURCES[resource];
    if (!config) throw new BadRequestException('Risorsa CRM non valida');
    return config;
  }

  private normalizeLimit(value: unknown): number {
    const n = Number(value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(100, Math.trunc(n)));
  }

  private normalizeOffset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  private normalizeSort(config: ResourceConfig, sortBy?: string, sortOrder?: string) {
    const column = config.sort.includes(String(sortBy || '')) ? String(sortBy) : config.defaultSort;
    const direction = String(sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { column, direction };
  }

  private buildWhere(resource: ResourceKey, config: ResourceConfig, schema: string, query: Record<string, any>) {
    const where = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];

    const search = String(query.search || '').trim();
    if (search && config.searchable.length > 0) {
      params.push(`%${search.toLowerCase()}%`);
      const idx = params.length;
      where.push(`(${config.searchable.map((field) => `lower(coalesce(t.${field}::text, '')) LIKE $${idx}`).join(' OR ')})`);
    }

    for (const filter of config.filters) {
      const value = query[filter];
      if (value === undefined || value === null || value === '') continue;

      if (isDoflowTenant(schema) && ((resource === 'opportunities' && filter === 'stage') || (resource === 'leads' && filter === 'status'))) {
        const aliases = aliasesForCommercialStage(value);
        if (!aliases) throw new BadRequestException('Fase commerciale non valida');
        params.push(aliases);
        const source = resource === 'leads'
          ? "lower(coalesce(commercial_opportunity.stage, t.status, ''))"
          : "lower(coalesce(t.stage, ''))";
        where.push(`${source} = ANY($${params.length}::text[])`);
        continue;
      }

      params.push(value);
      where.push(`t.${filter} = $${params.length}`);
    }

    if (config.table === 'commercial_activities') {
      if (query.completed === 'true') where.push('t.completed_at IS NOT NULL');
      if (query.completed === 'false') where.push('t.completed_at IS NULL');
      if (query.overdue === 'true') where.push('t.completed_at IS NULL AND t.due_at < now()');
    }

    return { where: where.join(' AND '), params };
  }

  private joins(config: ResourceConfig, schema: string): string {
    let baseJoins = (config.joins || '').replace(/\{schema\}/g, schema);
    if (config.table === 'leads' && isDoflowTenant(schema)) {
      baseJoins += `
        LEFT JOIN LATERAL (
          SELECT o.stage
          FROM "${schema}".opportunities o
          WHERE o.lead_id = t.id AND o.deleted_at IS NULL
          ORDER BY o.updated_at DESC, o.created_at DESC
          LIMIT 1
        ) commercial_opportunity ON true`;
    }
    if (!config.intakeLink || !isPublicLeadIntakeTenantEnabled(schema)) return baseJoins;

    return `${baseJoins}
      LEFT JOIN LATERAL (
        SELECT
          lis.submission_id,
          lis.form_data,
          lis.attribution,
          lis.landing_url,
          lis.source_origin,
          lis.created_at
        FROM "${schema}".lead_intake_submissions lis
        WHERE lis.${config.intakeLink} = t.id
        ORDER BY lis.created_at DESC
        LIMIT 1
      ) intake ON true`;
  }

  private select(config: ResourceConfig, schema: string): string {
    const commercialStageSelect = config.table === 'leads' && isDoflowTenant(schema)
      ? ', commercial_opportunity.stage AS opportunity_stage'
      : '';
    const baseSelect = `t.*${config.selectExtra || ''}${commercialStageSelect}`;
    if (!config.intakeLink) return baseSelect;

    const intakeSelect = isPublicLeadIntakeTenantEnabled(schema)
      ? `intake.submission_id AS intake_submission_id,
         intake.form_data AS intake_form_data,
         intake.attribution AS intake_attribution,
         intake.landing_url AS intake_landing_url,
         intake.source_origin AS intake_source_origin,
         intake.created_at AS intake_created_at`
      : `NULL::uuid AS intake_submission_id,
         NULL::jsonb AS intake_form_data,
         NULL::jsonb AS intake_attribution,
         NULL::text AS intake_landing_url,
         NULL::text AS intake_source_origin,
         NULL::timestamptz AS intake_created_at`;

    return `${baseSelect}, ${intakeSelect}`;
  }

  private cleanBody(resource: ResourceKey, config: ResourceConfig, schema: string, body: Record<string, any>, partial: boolean) {
    const cleaned: Record<string, unknown> = {};

    for (const field of config.writable) {
      if (!(field in body)) continue;
      const value = body[field];
      if (value === '') cleaned[field] = null;
      else cleaned[field] = value;
    }

    if (!partial) {
      for (const field of config.required) {
        const value = cleaned[field] ?? body[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          throw new BadRequestException(`${field} obbligatorio`);
        }
      }
    }

    for (const key of ['company_id', 'contact_id', 'lead_id', 'opportunity_id', 'assigned_to', 'owner_user_id']) {
      if (cleaned[key] && !UUID_RE.test(String(cleaned[key]))) {
        throw new BadRequestException(`${key} non valido`);
      }
    }

    if ('probability' in cleaned && cleaned.probability !== null) {
      const p = Number(cleaned.probability);
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new BadRequestException('probability deve essere tra 0 e 100');
      cleaned.probability = Math.trunc(p);
    }

    if (resource === 'opportunities' && isDoflowTenant(schema)) {
      if ('stage' in cleaned) {
        const normalized = normalizeCommercialStage(cleaned.stage);
        if (!normalized.mapped) throw new BadRequestException('Fase commerciale non valida');
        cleaned.stage = normalized.stage;
      } else if (!partial) {
        cleaned.stage = 'new';
      }
    }

    return cleaned;
  }

  private normalizeReadRow(resource: ResourceKey, schema: string, row: Record<string, any>) {
    if (!isDoflowTenant(schema)) return row;

    if (resource === 'opportunities') {
      const normalized = normalizeCommercialStage(row.stage);
      if (!normalized.mapped) return { ...row, commercial_stage_unmapped: true };
      return { ...row, stage: normalized.stage };
    }

    if (resource === 'leads') {
      const sourceStage = row.opportunity_stage ?? row.status;
      const normalized = normalizeCommercialStage(sourceStage);
      if (!normalized.mapped) {
        return { ...row, commercial_stage: sourceStage, commercial_stage_unmapped: true };
      }
      return { ...row, commercial_stage: normalized.stage };
    }

    return row;
  }

  private userIdOrNull(userId: string): string | null {
    return UUID_RE.test(userId) ? userId : null;
  }

  async list(resource: ResourceKey, query: Record<string, any>) {
    this.assertCrmAccess(false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const { column, direction } = this.normalizeSort(config, query.sortBy, query.sortOrder);
    const { where, params } = this.buildWhere(resource, config, schema, query);

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".${config.table} t ${this.joins(config, schema)} WHERE ${where}`,
      params,
    );

    const rows = await this.dataSource.query(
      `SELECT ${this.select(config, schema)}
       FROM "${schema}".${config.table} t
       ${this.joins(config, schema)}
       WHERE ${where}
       ORDER BY t.${column} ${direction} NULLS LAST, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      items: rows.map((row: Record<string, any>) => this.normalizeReadRow(resource, schema, row)),
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
    };
  }

  async findOne(resource: ResourceKey, id: string) {
    this.assertCrmAccess(false);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const rows = await this.dataSource.query(
      `SELECT ${this.select(config, schema)}
       FROM "${schema}".${config.table} t
       ${this.joins(config, schema)}
       WHERE t.id = $1 AND t.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Record CRM non trovato');
    return this.normalizeReadRow(resource, schema, rows[0]);
  }

  async create(resource: ResourceKey, body: Record<string, any>) {
    const user = this.assertCrmAccess(true);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const cleaned = this.cleanBody(resource, config, schema, body, false);
    const userId = this.userIdOrNull(user.id);

    const columns = [...Object.keys(cleaned), 'created_by', 'updated_by'];
    const values = [...Object.values(cleaned), userId, userId];
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${config.table} (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    await this.audit(schema, user, `crm_${resource}_created`, rows[0].id, cleaned);
    return this.findOne(resource, rows[0].id);
  }

  async update(resource: ResourceKey, id: string, body: Record<string, any>) {
    const user = this.assertCrmAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const cleaned = this.cleanBody(resource, config, schema, body, true);
    const userId = this.userIdOrNull(user.id);
    const entries = Object.entries(cleaned);

    if (entries.length === 0) return this.findOne(resource, id);

    const sets = entries.map(([field], index) => `${field} = $${index + 1}`);
    const params = entries.map(([, value]) => value);
    params.push(userId, id);

    let previousStageRaw: string | null = null;
    if (resource === 'opportunities' && isDoflowTenant(schema) && 'stage' in cleaned) {
      const previousRows = await this.dataSource.query(
        `SELECT stage FROM "${schema}".opportunities WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [id],
      );
      previousStageRaw = previousRows[0]?.stage == null ? null : String(previousRows[0].stage);
    }

    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${config.table}
       SET ${sets.join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Record CRM non trovato');
    if (resource === 'opportunities' && isDoflowTenant(schema) && 'stage' in cleaned) {
      const previous = normalizeCommercialStage(previousStageRaw);
      const metadata: Record<string, unknown> = {
        previous_stage: previous.mapped ? previous.stage : previous.raw || null,
        new_stage: cleaned.stage,
        changes: cleaned,
      };
      if (!previous.mapped || previous.isLegacy) metadata.previous_stage_raw = previous.raw || null;
      await this.audit(schema, user, 'crm_opportunity_stage_changed', id, metadata);
    } else {
      await this.audit(schema, user, `crm_${resource}_updated`, id, cleaned);
    }
    return this.findOne(resource, id);
  }

  async remove(resource: ResourceKey, id: string) {
    const user = this.assertCrmAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const userId = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${config.table}
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, id],
    );
    if (!rows[0]) throw new NotFoundException('Record CRM non trovato');
    await this.audit(schema, user, `crm_${resource}_deleted`, id, {});
    return { success: true };
  }

  async updateOpportunityStage(id: string, stage: string) {
    const schema = this.getSchema();
    if (isDoflowTenant(schema)) {
      if (!normalizeCommercialStage(stage).mapped) throw new BadRequestException('Stage non valido');
    } else if (!PIPELINE_STAGES.includes(stage)) {
      throw new BadRequestException('Stage non valido');
    }
    return this.update('opportunities', id, { stage });
  }

  async completeActivity(id: string) {
    return this.update('activities', id, { completed_at: new Date().toISOString() });
  }

  async pipeline(query: Record<string, any>) {
    this.assertCrmAccess(false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const { where, params } = this.buildWhere('opportunities', RESOURCES.opportunities, schema, query);
    const rows = await this.dataSource.query(
      `SELECT ${this.select(RESOURCES.opportunities, schema)}
       FROM "${schema}".opportunities t
       ${this.joins(RESOURCES.opportunities, schema)}
       WHERE ${where}
       ORDER BY t.expected_close_date ASC NULLS LAST, t.updated_at DESC`,
      params,
    );

    if (isDoflowTenant(schema)) {
      const mappedItems: Record<string, any>[] = [];
      const unmappedItems: Record<string, any>[] = [];
      for (const row of rows) {
        const normalized = normalizeCommercialStage(row.stage);
        if (!normalized.mapped) {
          unmappedItems.push({ ...row, commercial_stage_unmapped: true });
          continue;
        }
        mappedItems.push({ ...row, stage: normalized.stage });
      }

      const orderedStages = [...COMMERCIAL_POSITIVE_STAGES, ...COMMERCIAL_OUTCOME_STAGES];
      return {
        model: 'doflow-canonical-v1',
        stages: orderedStages.map((stage) => {
          const items = mappedItems.filter((row) => row.stage === stage);
          return {
            stage,
            kind: (COMMERCIAL_OUTCOME_STAGES as readonly string[]).includes(stage) ? 'outcome' : 'positive',
            label: commercialStageLabel(stage),
            count: items.length,
            totalValue: items.reduce((sum, row) => sum + Number(row.value_estimate || 0), 0),
            items,
          };
        }),
        unmappedCount: unmappedItems.length,
        ...(unmappedItems.length > 0 ? { unmappedItems } : {}),
      };
    }

    return {
      stages: PIPELINE_STAGES.map((stage) => {
        const items = rows.filter((row: any) => row.stage === stage);
        return {
          stage,
          label: stageLabel(stage),
          count: items.length,
          totalValue: items.reduce((sum: number, row: any) => sum + Number(row.value_estimate || 0), 0),
          items,
        };
      }),
    };
  }

  private async audit(schema: string, user: { email?: string; role: string }, action: string, target: string, metadata: Record<string, unknown>) {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [user.email || null, user.role, action, target, JSON.stringify(metadata || {})],
      );
    } catch {
      // Audit non bloccante: alcuni tenant legacy possono avere audit_log non aggiornato.
    }
  }
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    new_lead: 'Nuovo lead',
    to_contact: 'Da contattare',
    contacted: 'Contattato',
    call_scheduled: 'Call fissata',
    briefing_sent: 'Brief inviato',
    briefing_received: 'Brief ricevuto',
    quote_preparation: 'Preventivo in preparazione',
    quote_sent: 'Preventivo inviato',
    follow_up: 'Follow-up',
    accepted: 'Accettata',
    lost: 'Persa',
    paused: 'In pausa',
  };
  return labels[stage] || stage;
}

export type { ResourceKey };
