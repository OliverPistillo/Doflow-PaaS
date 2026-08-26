import { BadRequestException, ConflictException, ForbiddenException, Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
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
import { TenantCommercialAccessService, type CommercialActor } from './tenant-commercial-access.service';

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
type Queryable = Pick<EntityManager, 'query'>;

const RESOURCES: Record<ResourceKey, ResourceConfig> = {
  companies: {
    table: 'companies',
    required: ['name'],
    writable: [
      'name', 'legal_name', 'vat_number', 'fiscal_code', 'website', 'email', 'phone',
      'industry', 'size', 'status', 'source', 'address', 'city', 'province', 'country',
      'notes', 'owner_user_id',
      'logo_url',
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
      'description', 'due_at', 'completed_at', 'assigned_to', 'status', 'priority',
      'kanban_order', 'metadata',
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
    @Optional() private readonly commercialAccess?: TenantCommercialAccessService,
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

  private legacyCrmAccess(write = false) {
    const user = this.getUser();
    if (!hasRoleAtLeast(user.role, 'manager')) {
      throw new ForbiddenException(write ? 'Manager o superiore richiesto per modificare il CRM.' : 'Manager o superiore richiesto per leggere il CRM.');
    }
    return user;
  }

  private async assertCrmAccess(resource: ResourceKey, write = false, record?: Record<string, any>) {
    if (!this.commercialAccess) return this.legacyCrmAccess(write);
    const actor = await this.commercialAccess.current();
    if (!isDoflowTenant(actor.schema)) return actor;
    const has = (capability: string) => this.commercialAccess!.has(actor, capability);
    if (resource === 'companies' || resource === 'contacts') {
      this.commercialAccess.require(actor, write ? 'canEditCustomers' : 'canViewCustomers');
      return actor;
    }
    if (resource === 'activities') {
      this.commercialAccess.require(actor, write ? 'canEditAssignedLead' : 'canViewActivities', ...(write ? ['canEditCustomers'] : []));
      return actor;
    }
    if (!write) {
      this.commercialAccess.require(actor, 'canViewAllLeads', 'canViewAssignedLeads');
      if (record && !has('canViewAllLeads') && String(record.assigned_to || '') !== actor.id) {
        throw new ForbiddenException('Lead non assegnato');
      }
      return actor;
    }
    if (!record) {
      this.commercialAccess.require(actor, 'canCreateLeads');
      return actor;
    }
    if (!has('canAssignLeads') && !(has('canEditAssignedLead') && String(record.assigned_to || '') === actor.id)) {
      throw new ForbiddenException('Lead non assegnato o non modificabile');
    }
    return actor;
  }

  private scopedWhere(resource: ResourceKey, schema: string, where: string, actor: any) {
    if (
      !isDoflowTenant(schema)
      || !actor?.capabilities
      || actor.capabilities.has('*')
      || actor.capabilities.has('canViewAllLeads')
    ) return where;
    if (resource === 'opportunities') return `${where} AND t.assigned_to = $${'__ACTOR_PARAM__'}`;
    if (resource === 'leads') return `${where} AND commercial_opportunity.assigned_to = $${'__ACTOR_PARAM__'}`;
    if (resource === 'activities') {
      if (actor.capabilities.has('canAssignLeads')) return where;
      const actorParam = `$${'__ACTOR_PARAM__'}`;
      return `${where} AND (
        t.assigned_to = ${actorParam}
        OR t.created_by = ${actorParam}
        OR EXISTS (
          SELECT 1 FROM "${schema}".opportunities activity_opportunity
          WHERE activity_opportunity.deleted_at IS NULL
            AND activity_opportunity.assigned_to = ${actorParam}
            AND (
              activity_opportunity.id = t.opportunity_id
              OR activity_opportunity.lead_id = t.lead_id
              OR activity_opportunity.company_id = t.company_id
              OR activity_opportunity.contact_id = t.contact_id
            )
        )
        OR EXISTS (
          SELECT 1 FROM "${schema}".leads activity_lead
          WHERE activity_lead.id = t.lead_id
            AND activity_lead.deleted_at IS NULL
            AND activity_lead.assigned_to = ${actorParam}
        )
      )`;
    }
    return where;
  }

  private async assertActivityMutationScope(
    schema: string,
    actor: CommercialActor,
    activity: Record<string, unknown>,
    queryable: Queryable,
  ) {
    if (!isDoflowTenant(schema)) return;
    const globalScope = Boolean(
      this.commercialAccess?.has(actor, '*')
      || this.commercialAccess?.has(actor, 'canViewAllLeads')
      || this.commercialAccess?.has(actor, 'canAssignLeads'),
    );

    const assignedTo = String(activity.assigned_to || '');
    if (!globalScope && assignedTo && assignedTo !== actor.id) {
      throw new ForbiddenException('Assegnatario attività non autorizzato');
    }

    const opportunityId = activity.opportunity_id ? String(activity.opportunity_id) : null;
    const leadId = activity.lead_id ? String(activity.lead_id) : null;
    const companyId = activity.company_id ? String(activity.company_id) : null;
    const contactId = activity.contact_id ? String(activity.contact_id) : null;
    if (!opportunityId && !leadId && !companyId && !contactId) return;

    if (opportunityId) {
      const rows = await queryable.query(
        `SELECT o.lead_id, o.company_id, o.contact_id
         FROM "${schema}".opportunities o
         WHERE o.id = $1 AND o.deleted_at IS NULL
           ${globalScope ? '' : 'AND o.assigned_to = $2'}
         LIMIT 1`,
        globalScope ? [opportunityId] : [opportunityId, actor.id],
      );
      const opportunity = rows[0];
      if (!opportunity) throw new ForbiddenException('Record commerciale non assegnato');
      if (
        (leadId && String(opportunity.lead_id || '') !== leadId)
        || (companyId && String(opportunity.company_id || '') !== companyId)
        || (contactId && String(opportunity.contact_id || '') !== contactId)
      ) throw new BadRequestException('Riferimenti attività incoerenti');
      return;
    }

    if (leadId) {
      const rows = await queryable.query(
        `SELECT l.company_id, l.contact_id
         FROM "${schema}".leads l
         WHERE l.id = $1 AND l.deleted_at IS NULL
           ${globalScope ? '' : `AND (
             l.assigned_to = $2
             OR EXISTS (
               SELECT 1 FROM "${schema}".opportunities o
               WHERE o.lead_id = l.id AND o.deleted_at IS NULL AND o.assigned_to = $2
             )
           )`}
         LIMIT 1`,
        globalScope ? [leadId] : [leadId, actor.id],
      );
      const lead = rows[0];
      if (!lead) throw new ForbiddenException('Record commerciale non assegnato');
      if (
        (companyId && String(lead.company_id || '') !== companyId)
        || (contactId && String(lead.contact_id || '') !== contactId)
      ) throw new BadRequestException('Riferimenti attività incoerenti');
      return;
    }

    if (contactId) {
      const rows = await queryable.query(
        `SELECT ct.company_id
         FROM "${schema}".contacts ct
         LEFT JOIN "${schema}".companies c ON c.id = ct.company_id AND c.deleted_at IS NULL
         WHERE ct.id = $1 AND ct.deleted_at IS NULL
           ${globalScope ? '' : `AND (
             c.owner_user_id = $2
             OR EXISTS (
               SELECT 1 FROM "${schema}".opportunities o
               WHERE o.deleted_at IS NULL AND o.assigned_to = $2
                 AND (o.contact_id = ct.id OR o.company_id = ct.company_id)
             )
           )`}
         LIMIT 1`,
        globalScope ? [contactId] : [contactId, actor.id],
      );
      const contact = rows[0];
      if (!contact) throw new ForbiddenException('Record commerciale non assegnato');
      if (companyId && String(contact.company_id || '') !== companyId) {
        throw new BadRequestException('Riferimenti attività incoerenti');
      }
      return;
    }

    const rows = await queryable.query(
      `SELECT 1 FROM "${schema}".companies c
       WHERE c.id = $1 AND c.deleted_at IS NULL
         ${globalScope ? '' : `AND (
           c.owner_user_id = $2
           OR EXISTS (
             SELECT 1 FROM "${schema}".opportunities o
             WHERE o.company_id = c.id AND o.deleted_at IS NULL AND o.assigned_to = $2
           )
         )`}
       LIMIT 1`,
      globalScope ? [companyId] : [companyId, actor.id],
    );
    if (!rows[0]) throw new ForbiddenException('Record commerciale non assegnato');
  }

  private async ensureSchema(schema: string) {
    await ensureTenantCrmCoreTables(this.dataSource, schema);
    if (isPublicLeadIntakeTenantEnabled(schema)) {
      await ensureLeadIntakeSubmissionsTable(this.dataSource, schema);
    }
  }

  private sameDatabaseValue(left: unknown, right: unknown) {
    if (left == null && right == null) return true;
    if (left instanceof Date) return left.toISOString() === String(right);
    if (right instanceof Date) return right.toISOString() === String(left);
    if (typeof left === 'object' || typeof right === 'object') {
      try {
        return JSON.stringify(left) === JSON.stringify(right);
      } catch {
        return false;
      }
    }
    return String(left) === String(right);
  }

  private actorId(user: { id?: string }) {
    return UUID_RE.test(String(user.id || '')) ? String(user.id) : null;
  }

  private async recordMutation(
    manager: Queryable,
    schema: string,
    user: { id?: string; email?: string; role: string },
    action: string,
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
    metadata: Record<string, unknown>,
  ) {
    if (!isDoflowTenant(schema)) return;
    const operationId = randomUUID();
    const correlationId = randomUUID();
    const actorId = this.actorId(user);
    const auditMetadata = {
      operation_id: operationId,
      correlation_id: correlationId,
      entity_type: entityType,
      before: beforeState,
      after: afterState,
      ...metadata,
    };
    await manager.query(
      `INSERT INTO "${schema}".commercial_history
         (operation_id, correlation_id, entity_type, entity_id, event_type,
          actor_user_id, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
      [
        operationId,
        correlationId,
        entityType,
        entityId,
        action,
        actorId,
        beforeState == null ? null : JSON.stringify(beforeState),
        afterState == null ? null : JSON.stringify(afterState),
        JSON.stringify(metadata),
      ],
    );
    await manager.query(
      `INSERT INTO "${schema}".audit_log
         (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [user.email || null, user.role, action, entityId, JSON.stringify(auditMetadata)],
    );
    await manager.query(
      `INSERT INTO "${schema}".commercial_outbox
         (operation_id, correlation_id, topic, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        operationId,
        correlationId,
        action,
        entityType,
        entityId,
        JSON.stringify({ entity_id: entityId, ...metadata }),
      ],
    );
  }

  private async auditLegacy(
    schema: string,
    user: { email?: string; role: string },
    action: string,
    target: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schema}".audit_log
           (actor_email, actor_role, action, target, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [user.email || null, user.role, action, target, JSON.stringify(metadata)],
      );
    } catch {
      // Compatibilità tenant legacy: l'assenza della tabella audit non annulla la mutazione.
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
          SELECT o.stage, o.assigned_to
          FROM "${schema}".opportunities o
          WHERE o.lead_id = t.id AND o.deleted_at IS NULL
          ORDER BY o.updated_at DESC, o.created_at DESC
          LIMIT 1
        ) commercial_opportunity ON true`;
    }
    if (config.table === 'opportunities' && isDoflowTenant(schema)) {
      baseJoins += `
        LEFT JOIN LATERAL (
          SELECT ca.*
          FROM "${schema}".commercial_attributions ca
          WHERE ca.opportunity_id = t.id
          ORDER BY ca.occurred_at DESC, ca.created_at DESC
          LIMIT 1
        ) commercial_attribution ON true`;
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
    const attributionSelect = config.table === 'opportunities' && isDoflowTenant(schema)
      ? `, commercial_attribution.campaign_id AS campaign_id,
           to_jsonb(commercial_attribution) AS commercial_attribution`
      : '';
    const baseSelect = `t.*${config.selectExtra || ''}${commercialStageSelect}${attributionSelect}`;
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

    if (!partial && isDoflowTenant(schema) && body.id !== undefined) {
      if (!UUID_RE.test(String(body.id))) throw new BadRequestException('id non valido');
      cleaned.id = String(body.id);
    }

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

    if (resource === 'activities') {
      if ('status' in cleaned && !['todo', 'in_progress', 'waiting_client', 'completed', 'cancelled'].includes(String(cleaned.status))) {
        throw new BadRequestException('Stato attività non valido');
      }
      if ('priority' in cleaned && !['low', 'medium', 'high', 'urgent'].includes(String(cleaned.priority))) {
        throw new BadRequestException('Priorità attività non valida');
      }
      if ('kanban_order' in cleaned) {
        const order = Number(cleaned.kanban_order);
        if (!Number.isSafeInteger(order) || order < 0) throw new BadRequestException('Ordine attività non valido');
        cleaned.kanban_order = order;
      }
      if ('status' in cleaned) {
        cleaned.completed_at = cleaned.status === 'completed'
          ? cleaned.completed_at || new Date().toISOString()
          : null;
      }
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

  private normalizeReadRow(resource: ResourceKey, schema: string, row: Record<string, any>, actor?: CommercialActor) {
    if (!isDoflowTenant(schema)) return row;

    const capabilities = actor?.capabilities;
    const canViewValues = !capabilities || capabilities.has('*') || capabilities.has('canViewCommercialValues');
    const visibleRow = canViewValues
      ? row
      : { ...row, budget_estimate: null, value_estimate: null };

    if (resource === 'opportunities') {
      const normalized = normalizeCommercialStage(visibleRow.stage);
      if (!normalized.mapped) return { ...visibleRow, commercial_stage_unmapped: true };
      return { ...visibleRow, stage: normalized.stage };
    }

    if (resource === 'leads') {
      const sourceStage = visibleRow.opportunity_stage ?? visibleRow.status;
      const normalized = normalizeCommercialStage(sourceStage);
      if (!normalized.mapped) {
        return { ...visibleRow, commercial_stage: sourceStage, commercial_stage_unmapped: true };
      }
      return { ...visibleRow, commercial_stage: normalized.stage };
    }

    return visibleRow;
  }

  private userIdOrNull(userId: string): string | null {
    return UUID_RE.test(userId) ? userId : null;
  }

  async list(resource: ResourceKey, query: Record<string, any>) {
    const actor = await this.assertCrmAccess(resource, false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const { column, direction } = this.normalizeSort(config, query.sortBy, query.sortOrder);
    const built = this.buildWhere(resource, config, schema, query);
    let { where } = built;
    const params = [...built.params];
    const scoped = this.scopedWhere(resource, schema, where, actor);
    if (scoped.includes('__ACTOR_PARAM__')) {
      params.push(actor.id);
      where = scoped.split('__ACTOR_PARAM__').join(String(params.length));
    } else where = scoped;

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
      items: rows.map((row: Record<string, any>) => this.normalizeReadRow(resource, schema, row, actor as CommercialActor)),
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
    };
  }

  async findOne(resource: ResourceKey, id: string) {
    const actor = await this.assertCrmAccess(resource, false);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    let where = 't.id = $1 AND t.deleted_at IS NULL';
    const params: unknown[] = [id];
    const scoped = this.scopedWhere(resource, schema, where, actor);
    if (scoped.includes('__ACTOR_PARAM__')) {
      params.push(actor.id);
      where = scoped.split('__ACTOR_PARAM__').join(String(params.length));
    } else where = scoped;
    const rows = await this.dataSource.query(
      `SELECT ${this.select(config, schema)}
       FROM "${schema}".${config.table} t
       ${this.joins(config, schema)}
       WHERE ${where}
       LIMIT 1`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Record CRM non trovato');
    await this.assertCrmAccess(resource, false, rows[0]);
    return this.normalizeReadRow(resource, schema, rows[0], actor as CommercialActor);
  }

  async create(resource: ResourceKey, body: Record<string, any>) {
    const user = await this.assertCrmAccess(resource, true);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const cleaned = this.cleanBody(resource, config, schema, body, false);
    const userId = this.userIdOrNull(user.id);

    const columns = [...Object.keys(cleaned), 'created_by', 'updated_by'];
    const values = [...Object.values(cleaned), userId, userId];
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const id = await this.dataSource.transaction(async (manager) => {
      if (resource === 'activities' && isDoflowTenant(schema) && this.commercialAccess) {
        await this.assertActivityMutationScope(schema, user as CommercialActor, cleaned, manager);
      }
      const rows = await manager.query(
        `INSERT INTO "${schema}".${config.table} (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values,
      );
      await this.recordMutation(
        manager,
        schema,
        user,
        `crm_${resource}_created`,
        resource,
        rows[0].id,
        null,
        rows[0],
        { changes: cleaned },
      );
      return rows[0].id as string;
    });
    if (!isDoflowTenant(schema)) {
      await this.auditLegacy(schema, user, `crm_${resource}_created`, id, cleaned);
    }
    return this.findOne(resource, id);
  }

  async update(resource: ResourceKey, id: string, body: Record<string, any>) {
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = this.getConfig(resource);
    const cleaned = this.cleanBody(resource, config, schema, body, true);
    const expectedVersion = isDoflowTenant(schema) ? Number(body.version) : null;
    if (isDoflowTenant(schema) && (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1)) {
      throw new BadRequestException('version obbligatoria');
    }
    const legacyAudit = await this.dataSource.transaction(async (manager) => {
      let user: any;
      let currentRows: any[];
      if (resource === 'activities' && isDoflowTenant(schema) && this.commercialAccess) {
        user = await this.assertCrmAccess(resource, true);
        let where = 't.id = $1 AND t.deleted_at IS NULL';
        const params: unknown[] = [id];
        const scoped = this.scopedWhere(resource, schema, where, user);
        if (scoped.includes('__ACTOR_PARAM__')) {
          params.push(user.id);
          where = scoped.split('__ACTOR_PARAM__').join(String(params.length));
        } else where = scoped;
        currentRows = await manager.query(
          `SELECT t.* FROM "${schema}".${config.table} t
           WHERE ${where}
           LIMIT 1 FOR UPDATE`,
          params,
        );
      } else {
        currentRows = await manager.query(
          `SELECT * FROM "${schema}".${config.table}
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [id],
        );
      }
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Record CRM non trovato');
      if (!user) user = await this.assertCrmAccess(resource, true, current);
      if (
        resource === 'activities'
        && isDoflowTenant(schema)
        && this.commercialAccess
        && ['company_id', 'contact_id', 'lead_id', 'opportunity_id', 'assigned_to'].some((field) => field in cleaned)
      ) {
        await this.assertActivityMutationScope(
          schema,
          user as CommercialActor,
          { ...current, ...cleaned },
          manager,
        );
      }
      if (isDoflowTenant(schema) && body.assigned_to !== undefined && body.assigned_to !== current.assigned_to && this.commercialAccess) {
        this.commercialAccess.require(user as CommercialActor, 'canAssignLeads');
      }
      if (isDoflowTenant(schema) && Number(current.version) !== expectedVersion) {
        throw new ConflictException('Conflitto di versione');
      }

      const entries = Object.entries(cleaned).filter(
        ([field, value]) => !this.sameDatabaseValue(current[field], value),
      );
      if (entries.length === 0) return null;

      const userId = this.userIdOrNull(user.id);
      const sets = entries.map(([field], index) => `${field} = $${index + 1}`);
      const params = entries.map(([, value]) => value);
      params.push(userId, id);
      if (isDoflowTenant(schema)) params.push(expectedVersion);
      const rows = await manager.query(
        `UPDATE "${schema}".${config.table}
         SET ${sets.join(', ')}, updated_by = $${entries.length + 1},
             ${isDoflowTenant(schema) ? 'version = version + 1,' : ''} updated_at = now()
         WHERE id = $${entries.length + 2} AND deleted_at IS NULL
           ${isDoflowTenant(schema) ? `AND version = $${entries.length + 3}` : ''}
         RETURNING *`,
        params,
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione');
      const changes = Object.fromEntries(entries);
      const isStageChange = resource === 'opportunities' && 'stage' in changes;
      const action = isStageChange ? 'crm_opportunity_stage_changed' : `crm_${resource}_updated`;
      const metadata: Record<string, unknown> = { changes };
      if (isStageChange) {
        const previous = normalizeCommercialStage(current.stage);
        metadata.previous_stage = previous.mapped ? previous.stage : previous.raw || null;
        metadata.new_stage = changes.stage;
        if (!previous.mapped || previous.isLegacy) metadata.previous_stage_raw = previous.raw || null;
      }
      await this.recordMutation(manager, schema, user, action, resource, id, current, rows[0], metadata);
      return { user, action, metadata };
    });
    if (!isDoflowTenant(schema) && legacyAudit) {
      await this.auditLegacy(schema, legacyAudit.user, legacyAudit.action, id, legacyAudit.metadata);
    }
    return this.findOne(resource, id);
  }

  async remove(resource: ResourceKey, id: string) {
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    if (isDoflowTenant(schema)) {
      throw new BadRequestException('Usare l’endpoint Commercial Core versionato per archiviare');
    }
    const config = this.getConfig(resource);
    const archivedBy = await this.dataSource.transaction(async (manager) => {
      const currentRows = await manager.query(
        `SELECT * FROM "${schema}".${config.table}
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Record CRM non trovato');
      const user = await this.assertCrmAccess(resource, true, current);
      if (isDoflowTenant(schema) && this.commercialAccess) this.commercialAccess.require(user as CommercialActor, 'canManageArchive');
      const userId = this.userIdOrNull(user.id);
      const rows = await manager.query(
        `UPDATE "${schema}".${config.table}
         SET deleted_at = now(), archived_by = $1, updated_by = $1,
             ${isDoflowTenant(schema) ? 'version = version + 1,' : ''} updated_at = now()
         WHERE id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, id],
      );
      if (!rows[0]) throw new NotFoundException('Record CRM non trovato');
      await this.recordMutation(
        manager,
        schema,
        user,
        `crm_${resource}_archived`,
        resource,
        id,
        current,
        rows[0],
        {},
      );
      return user;
    });
    await this.auditLegacy(schema, archivedBy, `crm_${resource}_deleted`, id, {});
    return { success: true };
  }

  async updateOpportunityStage(id: string, stage: string) {
    const schema = this.getSchema();
    if (isDoflowTenant(schema)) {
      throw new BadRequestException('Usare la transizione Commercial Core versionata');
    } else if (!PIPELINE_STAGES.includes(stage)) {
      throw new BadRequestException('Stage non valido');
    }
    return this.update('opportunities', id, { stage });
  }

  async completeActivity(id: string) {
    if (isDoflowTenant(this.getSchema())) {
      throw new BadRequestException('Usare l’aggiornamento Commercial Core versionato');
    }
    return this.update('activities', id, { completed_at: new Date().toISOString() });
  }

  async pipeline(query: Record<string, any>) {
    const actor = await this.assertCrmAccess('opportunities', false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const built = this.buildWhere('opportunities', RESOURCES.opportunities, schema, query);
    let { where } = built;
    const params = [...built.params];
    const scoped = this.scopedWhere('opportunities', schema, where, actor);
    if (scoped.includes('__ACTOR_PARAM__')) {
      params.push(actor.id);
      where = scoped.replace('__ACTOR_PARAM__', String(params.length));
    } else where = scoped;
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
