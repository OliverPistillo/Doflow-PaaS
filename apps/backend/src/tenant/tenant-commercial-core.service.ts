import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import {
  TenantCommercialAccessService,
  type CommercialActor,
} from './tenant-commercial-access.service';
import {
  normalizeCommercialStage,
} from './commercial-stage-model';
import { ensureDoflowTimelineSchema } from './tenant-timeline-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MERGE_TABLES = ['companies', 'contacts', 'opportunities'] as const;
type MergeTable = (typeof MERGE_TABLES)[number];
type Queryable = Pick<EntityManager, 'query'>;

type IdempotentContext = {
  actor: CommercialActor;
  manager: EntityManager;
  operationId: string;
  correlationId: string;
};

@Injectable()
export class TenantCommercialCoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: TenantCommercialAccessService,
  ) {}

  private uuid(value: unknown, label: string) {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private expectedVersion(value: unknown) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Versione record obbligatoria');
    }
    return version;
  }

  private idempotencyKey(value: unknown) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9_.:@/-]{8,200}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key non valida');
    }
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private actorId(actor: CommercialActor) {
    return UUID_RE.test(actor.id) ? actor.id : null;
  }

  private stageValue(value: unknown) {
    const normalized = normalizeCommercialStage(value);
    return normalized.mapped ? normalized.stage : normalized.raw;
  }

  private uiStageValue(stageValue: unknown, uiStageValue: unknown) {
    const explicit = String(uiStageValue || '').trim().toLowerCase().replace(/_/g, '-');
    if (explicit) return explicit;
    const canonical = this.stageValue(stageValue);
    const fallbacks: Record<string, string> = {
      new: 'new',
      contacted: 'qualified',
      qualified: 'qualified',
      appointment: 'proposal',
      quote: 'proposal',
      closed_won: 'won',
      lost: 'lost',
      paused: 'follow-up',
    };
    return fallbacks[canonical] || canonical;
  }

  private requestedStage(value: unknown) {
    const raw = String(value || '').trim().toLowerCase();
    const aliases: Record<string, string> = {
      proposal: 'quote',
      negotiation: 'quote',
      unqualified: 'lost',
      'not-interested': 'lost',
      'follow-up': 'quote',
      won: 'closed_won',
    };
    const normalized = normalizeCommercialStage(aliases[raw] || raw);
    if (!normalized.mapped) throw new BadRequestException('Fase commerciale non valida');
    return { canonical: normalized.stage, ui: raw };
  }

  private async prepare(actor: CommercialActor) {
    await ensureTenantCrmCoreTables(this.dataSource, actor.schema);
    await ensureDoflowTimelineSchema(this.dataSource, actor.schema);
  }

  private canEditOpportunity(actor: CommercialActor, row: Record<string, any>) {
    if (this.access.has(actor, 'canAssignLeads')) return true;
    return this.access.has(actor, 'canEditAssignedLead') && String(row.assigned_to || '') === actor.id;
  }

  private assertEditOpportunity(actor: CommercialActor, row: Record<string, any>) {
    if (!this.canEditOpportunity(actor, row)) {
      throw new ForbiddenException('Lead non assegnato o non modificabile');
    }
  }

  private assertEditActivity(actor: CommercialActor, row: Record<string, any>) {
    if (this.access.has(actor, 'canEditCustomers') || this.access.has(actor, 'canAssignLeads')) return;
    if (this.access.has(actor, 'canEditAssignedLead') && String(row.assigned_to || '') === actor.id) return;
    throw new ForbiddenException('Attività non assegnata o non modificabile');
  }

  private async withIdempotency<T>(
    operation: string,
    keyValue: unknown,
    requestValue: unknown,
    work: (context: IdempotentContext) => Promise<T>,
  ): Promise<T> {
    const actor = await this.access.current();
    const key = this.idempotencyKey(keyValue);
    const requestHash = this.hash(requestValue);
    await this.prepare(actor);

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query(
        `SELECT request_hash, status, response
         FROM "${actor.schema}".commercial_idempotency
         WHERE operation = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [operation, key],
      );
      if (existing[0]) {
        if (String(existing[0].request_hash) !== requestHash) {
          throw new ConflictException('Idempotency-Key già usata con dati differenti');
        }
        if (existing[0].status === 'completed') return existing[0].response as T;
        throw new ConflictException('Operazione identica già in corso');
      }

      await manager.query(
        `INSERT INTO "${actor.schema}".commercial_idempotency
           (operation, idempotency_key, actor_user_id, request_hash, status)
         VALUES ($1, $2, $3, $4, 'processing')`,
        [operation, key, this.actorId(actor), requestHash],
      );
      const context = {
        actor,
        manager,
        operationId: randomUUID(),
        correlationId: randomUUID(),
      };
      const response = await work(context);
      await manager.query(
        `UPDATE "${actor.schema}".commercial_idempotency
         SET status = 'completed', response = $3::jsonb, completed_at = now()
         WHERE operation = $1 AND idempotency_key = $2`,
        [operation, key, JSON.stringify(response)],
      );
      return response;
    });
  }

  private async recordOperation(
    context: IdempotentContext,
    eventType: string,
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
    metadata: Record<string, unknown> = {},
  ) {
    const { actor, manager, operationId, correlationId } = context;
    const actorId = this.actorId(actor);
    const auditMetadata = {
      correlation_id: correlationId,
      operation_id: operationId,
      entity_type: entityType,
      before: beforeState,
      after: afterState,
      ...metadata,
    };
    await manager.query(
      `INSERT INTO "${actor.schema}".commercial_history
         (operation_id, correlation_id, entity_type, entity_id, event_type,
          actor_user_id, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
      [
        operationId,
        correlationId,
        entityType,
        entityId,
        eventType,
        actorId,
        beforeState == null ? null : JSON.stringify(beforeState),
        afterState == null ? null : JSON.stringify(afterState),
        JSON.stringify(metadata),
      ],
    );
    await manager.query(
      `INSERT INTO "${actor.schema}".audit_log
         (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [actor.email, actor.role, eventType, entityId, JSON.stringify(auditMetadata)],
    );
    await manager.query(
      `INSERT INTO "${actor.schema}".commercial_outbox
         (operation_id, correlation_id, topic, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        operationId,
        correlationId,
        eventType,
        entityType,
        entityId,
        JSON.stringify({ entity_id: entityId, ...metadata }),
      ],
    );
  }

  async createLead(body: Record<string, unknown>, keyValue: unknown) {
    const companyName = String(body.companyName || '').trim().slice(0, 500);
    const title = String(body.title || '').trim().slice(0, 500);
    if (!companyName || !title) throw new BadRequestException('Azienda e titolo lead sono obbligatori');
    const firstName = String(body.firstName || '').trim().slice(0, 300);
    const lastName = String(body.lastName || '').trim().slice(0, 300);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 500);
    const phone = String(body.phone || '').trim().slice(0, 100);
    const serviceType = String(body.serviceType || '').trim().slice(0, 500) || null;
    const source = String(body.source || '').trim().slice(0, 300) || null;
    const stage = this.requestedStage(body.stage || 'new');
    const value = body.value == null ? null : Number(body.value);
    const probability = body.probability == null ? 0 : Number(body.probability);
    if (value != null && (!Number.isFinite(value) || value < 0)) throw new BadRequestException('Valore lead non valido');
    if (!Number.isInteger(probability) || probability < 0 || probability > 100) throw new BadRequestException('Probabilità lead non valida');
    const assignedToValue = body.assignedTo == null || body.assignedTo === ''
      ? null
      : this.uuid(body.assignedTo, 'Assegnatario');
    const campaignId = body.campaignId == null || body.campaignId === ''
      ? null
      : this.uuid(body.campaignId, 'Campagna');
    const nextAction = String(body.nextAction || '').trim().slice(0, 1000) || null;
    const nextActionAt = body.nextActionAt == null || body.nextActionAt === ''
      ? null
      : String(body.nextActionAt);

    return this.withIdempotency(
      'commercial.leads.create',
      keyValue,
      {
        companyName, title, firstName, lastName, email, phone, serviceType,
        source, stage, value, probability, assignedToValue, campaignId,
        nextAction, nextActionAt,
      },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canCreateLeads');
        const actorId = this.actorId(actor);
        const assignedTo = assignedToValue || actorId;
        if (!assignedTo) throw new ForbiddenException('Identità assegnatario non valida');
        if (assignedTo !== actor.id) this.access.require(actor, 'canAssignLeads');

        const companyRows = await manager.query(
          `SELECT * FROM "${actor.schema}".companies
           WHERE deleted_at IS NULL AND merged_into_id IS NULL
             AND lower(trim(name)) = lower(trim($1))
             AND ($2::text = '' OR lower(COALESCE(email, '')) = lower($2))
           ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
          [companyName, email],
        );
        let company = companyRows[0];
        if (!company) {
          const inserted = await manager.query(
            `INSERT INTO "${actor.schema}".companies
               (name, email, phone, status, source, owner_user_id, created_by, updated_by)
             VALUES ($1, $2, $3, 'prospect', $4, $5, $6, $6)
             RETURNING *`,
            [companyName, email || null, phone || null, source, assignedTo, actorId],
          );
          company = inserted[0];
        }

        let contact: Record<string, any> | null = null;
        if (firstName || lastName || email || phone) {
          const contactRows = await manager.query(
            `SELECT * FROM "${actor.schema}".contacts
             WHERE deleted_at IS NULL AND merged_into_id IS NULL
               AND (($1::text <> '' AND lower(COALESCE(email, '')) = lower($1))
                 OR ($2::text <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')))
             ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [email, phone],
          );
          contact = contactRows[0] || null;
          if (contact && !contact.company_id) {
            const linked = await manager.query(
              `UPDATE "${actor.schema}".contacts
               SET company_id = $1, version = version + 1, updated_by = $2, updated_at = now()
               WHERE id = $3 RETURNING *`,
              [company.id, actorId, contact.id],
            );
            contact = linked[0];
          }
          if (!contact) {
            const primaryRows = await manager.query(
              `SELECT 1 FROM "${actor.schema}".contacts
               WHERE company_id = $1 AND is_primary = true AND deleted_at IS NULL
               LIMIT 1`,
              [company.id],
            );
            const inserted = await manager.query(
              `INSERT INTO "${actor.schema}".contacts
                 (company_id, first_name, last_name, email, phone, is_primary, created_by, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
               RETURNING *`,
              [company.id, firstName || companyName, lastName || null, email || null, phone || null, !primaryRows[0], actorId],
            );
            contact = inserted[0];
          }
        }

        const leadRows = await manager.query(
          `INSERT INTO "${actor.schema}".leads
             (company_id, contact_id, title, source, interest, status, assigned_to,
              next_action, next_action_at, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           RETURNING *`,
          [company.id, contact?.id || null, title, source, serviceType, stage.canonical, assignedTo, nextAction, nextActionAt, actorId],
        );
        const opportunityRows = await manager.query(
          `INSERT INTO "${actor.schema}".opportunities
             (company_id, contact_id, lead_id, title, service_type, value_estimate,
              lead_source, probability, stage, ui_stage, assigned_to, next_action,
              next_action_at, pipeline_order, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   COALESCE((SELECT max(pipeline_order) + 1 FROM "${actor.schema}".opportunities WHERE stage = $9), 1),
                   $14, $14)
           RETURNING *`,
          [company.id, contact?.id || null, leadRows[0].id, title, serviceType, value, source, probability, stage.canonical, stage.ui, assignedTo, nextAction, nextActionAt, actorId],
        );
        let attribution: Record<string, any> | null = null;
        if (campaignId) {
          this.access.require(actor, 'canViewCampaigns');
          const campaignRows = await manager.query(
            `SELECT id, name FROM "${actor.schema}".campaigns WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
            [campaignId],
          );
          if (!campaignRows[0]) throw new NotFoundException('Campagna non trovata');
          const attributionRows = await manager.query(
            `INSERT INTO "${actor.schema}".commercial_attributions
               (company_id, contact_id, lead_id, opportunity_id, campaign_id,
                source, campaign_name, attribution_model, occurred_at, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_last_touch', now(), $8::jsonb)
             RETURNING *`,
            [company.id, contact?.id || null, leadRows[0].id, opportunityRows[0].id, campaignId, source, campaignRows[0].name, JSON.stringify({ source: 'commercial_lead_create' })],
          );
          attribution = attributionRows[0];
        }
        const item = {
          ...opportunityRows[0],
          company_name: company.name,
          contact_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : '',
          contact_email: contact?.email || null,
          contact_phone: contact?.phone || null,
          campaign_id: campaignId,
          commercial_attribution: attribution,
        };
        await this.recordOperation(
          context,
          'commercial_lead_created',
          'opportunity',
          opportunityRows[0].id,
          null,
          { company, contact, lead: leadRows[0], opportunity: opportunityRows[0], attribution },
          { company_id: company.id, contact_id: contact?.id || null, lead_id: leadRows[0].id, campaign_id: campaignId },
        );
        return { item, correlationId: context.correlationId };
      },
    );
  }

  async transitionOpportunity(
    idValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const id = this.uuid(idValue, 'Lead');
    const expectedVersion = this.expectedVersion(body.version);
    const normalized = this.requestedStage(body.stage);

    return this.withIdempotency(
      'commercial.pipeline.transition',
      keyValue,
      { id, expectedVersion, stage: normalized.canonical, uiStage: normalized.ui, reason: body.reason, note: body.note },
      async (context) => {
        const { actor, manager } = context;
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".opportunities
           WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Lead non trovato');
        this.assertEditOpportunity(actor, current);
        if (Number(current.version) !== expectedVersion) {
          throw new ConflictException({
            message: 'Il lead è stato modificato da un’altra sessione',
            code: 'COMMERCIAL_VERSION_CONFLICT',
            current,
          });
        }
        if (this.stageValue(current.stage) === normalized.canonical && String(current.ui_stage || '') === normalized.ui) {
          return { item: current, unchanged: true, correlationId: context.correlationId };
        }

        const updated = await manager.query(
          `UPDATE "${actor.schema}".opportunities
           SET stage = $1, ui_stage = $2, probability = CASE WHEN $1 = 'closed_won' THEN 100 ELSE probability END,
               version = version + 1, updated_by = $3, updated_at = now()
           WHERE id = $4 AND version = $5 AND deleted_at IS NULL
           RETURNING *`,
          [normalized.canonical, normalized.ui, this.actorId(actor), id, expectedVersion],
        );
        if (!updated[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(
          context,
          'commercial_opportunity_stage_changed',
          'opportunity',
          id,
          current,
          updated[0],
          {
            previous_stage: this.stageValue(current.stage),
            new_stage: normalized.canonical,
            ui_stage: normalized.ui,
            reason: String(body.reason || '').trim() || null,
            note: String(body.note || '').trim() || null,
          },
        );
        return { item: updated[0], unchanged: false, correlationId: context.correlationId };
      },
    );
  }

  async reorderPipeline(body: Record<string, unknown>, keyValue: unknown) {
    const stage = this.requestedStage(body.stage);
    const leadIds = Array.isArray(body.leadIds)
      ? body.leadIds.map((id) => this.uuid(id, 'Lead'))
      : [];
    if (!leadIds.length || new Set(leadIds).size !== leadIds.length) {
      throw new BadRequestException('Ordinamento lead non valido');
    }
    return this.withIdempotency(
      'commercial.pipeline.reorder',
      keyValue,
      { stage: stage.canonical, uiStage: stage.ui, leadIds },
      async (context) => {
        const { actor, manager } = context;
        const rows = await manager.query(
          `SELECT id, stage, ui_stage, assigned_to, version, pipeline_order
           FROM "${actor.schema}".opportunities
           WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL FOR UPDATE`,
          [leadIds],
        );
        if (rows.length !== leadIds.length) throw new NotFoundException('Uno o più lead non esistono');
        for (const row of rows) {
          this.assertEditOpportunity(actor, row);
          if (this.stageValue(row.stage) !== stage.canonical || this.uiStageValue(row.stage, row.ui_stage) !== stage.ui) {
            throw new ConflictException('La pipeline è cambiata durante il riordino');
          }
        }
        const currentOrder = new Map(rows.map((row: any) => [String(row.id), Number(row.pipeline_order || 0)]));
        const needsUiStageBackfill = rows.some((row: any) => !String(row.ui_stage || '').trim());
        if (!needsUiStageBackfill && leadIds.every((id, index) => currentOrder.get(id) === index + 1)) {
          return { ok: true, stage: stage.canonical, leadIds, unchanged: true, correlationId: context.correlationId };
        }
        for (let index = 0; index < leadIds.length; index += 1) {
          await manager.query(
            `UPDATE "${actor.schema}".opportunities
             SET pipeline_order = $1, ui_stage = COALESCE(ui_stage, $2),
                 version = version + 1, updated_by = $3, updated_at = now()
             WHERE id = $4`,
            [index + 1, stage.ui, this.actorId(actor), leadIds[index]],
          );
        }
        await this.recordOperation(
          context,
          'commercial_pipeline_reordered',
          'opportunity',
          leadIds[0],
          rows.map((row: any) => ({ id: row.id, order: row.pipeline_order, ui_stage: row.ui_stage || null })),
          leadIds.map((id, index) => ({ id, order: index + 1, ui_stage: stage.ui })),
          { stage: stage.canonical, ui_stage: stage.ui, lead_ids: leadIds },
        );
        return { ok: true, stage: stage.canonical, leadIds, correlationId: context.correlationId };
      },
    );
  }

  async reorderActivities(body: Record<string, any>, keyValue: unknown) {
    const activityId = this.uuid(body.activityId, 'Attività');
    const status = String(body.status || '').trim();
    if (!['todo', 'in_progress', 'waiting_client', 'completed', 'cancelled'].includes(status)) {
      throw new BadRequestException('Stato attività non valido');
    }
    const items = Array.isArray(body.items)
      ? body.items.map((item: Record<string, unknown>) => ({
          id: this.uuid(item.id, 'Attività'),
          version: this.expectedVersion(item.version),
          order: Number(item.order),
        }))
      : [];
    const ids = items.map((item) => item.id);
    if (!items.length || !ids.includes(activityId) || new Set(ids).size !== ids.length || items.some((item) => !Number.isSafeInteger(item.order) || item.order < 0)) {
      throw new BadRequestException('Ordinamento attività non valido');
    }

    return this.withIdempotency(
      'commercial.activities.reorder',
      keyValue,
      { activityId, status, items },
      async (context) => {
        const { actor, manager } = context;
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".commercial_activities
           WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
           FOR UPDATE`,
          [ids],
        );
        if (rows.length !== ids.length) throw new NotFoundException('Una o più attività non esistono');
        const byId = new Map<string, Record<string, any>>(
          rows.map((row: any): [string, Record<string, any>] => [String(row.id), row]),
        );
        for (const item of items) {
          const current = byId.get(item.id);
          if (!current) throw new NotFoundException('Attività non trovata');
          this.assertEditActivity(actor, current);
          if (Number(current.version) !== item.version) {
            throw new ConflictException({
              message: 'Le attività sono state modificate da un’altra sessione',
              code: 'COMMERCIAL_VERSION_CONFLICT',
              current,
            });
          }
        }

        const before = items.map((item) => {
          const row = byId.get(item.id);
          if (!row) throw new NotFoundException('Attività non trovata');
          return { id: item.id, status: row.status, order: Number(row.kanban_order || 0), version: Number(row.version) };
        });
        const after = items.map((item) => ({
          id: item.id,
          status: item.id === activityId ? status : String(byId.get(item.id)?.status || 'todo'),
          order: item.order,
        }));
        const changed = after.some((item, index) => item.status !== before[index].status || item.order !== before[index].order);
        if (!changed) {
          return { items: rows, unchanged: true, correlationId: context.correlationId };
        }

        const saved = [];
        for (const item of after) {
          const current = byId.get(item.id);
          if (!current) throw new NotFoundException('Attività non trovata');
          const updated = await manager.query(
            `UPDATE "${actor.schema}".commercial_activities
             SET status = $1, kanban_order = $2,
                 completed_at = CASE
                   WHEN $1 = 'completed' THEN COALESCE(completed_at, now())
                   WHEN id = $3 THEN NULL
                   ELSE completed_at
                 END,
                 version = version + 1, updated_by = $4, updated_at = now()
             WHERE id = $3 AND version = $5 AND deleted_at IS NULL
             RETURNING *`,
            [item.status, item.order, item.id, this.actorId(actor), Number(current.version)],
          );
          if (!updated[0]) throw new ConflictException('Conflitto di versione');
          saved.push(updated[0]);
        }
        await this.recordOperation(
          context,
          'commercial_activity_reordered',
          'activity',
          activityId,
          before,
          after,
          { activity_id: activityId, status, ordered_ids: ids },
        );
        return { items: saved, unchanged: false, correlationId: context.correlationId };
      },
    );
  }

  async archive(
    resourceValue: string,
    idValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const resourceMap: Record<string, { table: string; entity: string }> = {
      lead: { table: 'opportunities', entity: 'opportunity' },
      customer: { table: 'companies', entity: 'company' },
      contact: { table: 'contacts', entity: 'contact' },
      activity: { table: 'commercial_activities', entity: 'activity' },
      communication: { table: 'commercial_communications', entity: 'communication' },
    };
    const config = resourceMap[resourceValue];
    if (!config) throw new BadRequestException('Tipo archivio non valido');
    const id = this.uuid(idValue, 'Record');
    const version = this.expectedVersion(body.version);
    const reason = String(body.reason || '').trim().slice(0, 1000) || 'Archiviazione manuale';
    return this.withIdempotency(
      `commercial.archive.${resourceValue}`,
      keyValue,
      { id, version, reason },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canManageArchive');
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}"."${config.table}"
           WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Record non trovato');
        if (config.table === 'opportunities') this.assertEditOpportunity(actor, current);
        if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione');
        const updated = await manager.query(
          `UPDATE "${actor.schema}"."${config.table}"
           SET deleted_at = now(), archived_by = $1, archive_reason = $2,
               version = version + 1, updated_by = $1, updated_at = now()
           WHERE id = $3 AND version = $4 AND deleted_at IS NULL
           RETURNING *`,
          [this.actorId(actor), reason, id, version],
        );
        if (!updated[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(
          context,
          `commercial_${config.entity}_archived`,
          config.entity,
          id,
          current,
          updated[0],
          { reason },
        );
        return { item: updated[0], correlationId: context.correlationId };
      },
    );
  }

  async restore(
    resourceValue: string,
    idValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const resourceMap: Record<string, { table: string; entity: string }> = {
      lead: { table: 'opportunities', entity: 'opportunity' },
      customer: { table: 'companies', entity: 'company' },
      contact: { table: 'contacts', entity: 'contact' },
      activity: { table: 'commercial_activities', entity: 'activity' },
      communication: { table: 'commercial_communications', entity: 'communication' },
    };
    const config = resourceMap[resourceValue];
    if (!config) throw new BadRequestException('Tipo archivio non valido');
    const id = this.uuid(idValue, 'Record');
    const version = this.expectedVersion(body.version);
    return this.withIdempotency(
      `commercial.restore.${resourceValue}`,
      keyValue,
      { id, version },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canManageArchive');
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}"."${config.table}"
           WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Record archiviato non trovato');
        if (current.merged_into_id) {
          throw new ConflictException('Un record fuso richiede una procedura amministrativa dedicata');
        }
        if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione');
        const updated = await manager.query(
          `UPDATE "${actor.schema}"."${config.table}"
           SET deleted_at = NULL, archived_by = NULL, archive_reason = NULL,
               version = version + 1, updated_by = $1, updated_at = now()
           WHERE id = $2 AND version = $3 AND deleted_at IS NOT NULL
           RETURNING *`,
          [this.actorId(actor), id, version],
        );
        if (!updated[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(
          context,
          `commercial_${config.entity}_restored`,
          config.entity,
          id,
          current,
          updated[0],
        );
        return { item: updated[0], correlationId: context.correlationId };
      },
    );
  }

  async updateAttribution(
    idValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const id = this.uuid(idValue, 'Lead');
    const version = this.expectedVersion(body.version);
    const campaignId = body.campaignId == null || body.campaignId === ''
      ? null
      : this.uuid(body.campaignId, 'Campagna');
    const attribution = {
      source: String(body.source || '').trim().slice(0, 300) || null,
      medium: String(body.medium || '').trim().slice(0, 300) || null,
      content: String(body.content || '').trim().slice(0, 300) || null,
      term: String(body.term || '').trim().slice(0, 300) || null,
    };

    return this.withIdempotency(
      'commercial.leads.attribution',
      keyValue,
      { id, version, campaignId, ...attribution },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canViewCampaigns');
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".opportunities
           WHERE id = $1 AND deleted_at IS NULL
           FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Lead non trovato');
        this.assertEditOpportunity(actor, current);
        if (Number(current.version) !== version) {
          throw new ConflictException('Conflitto di versione');
        }
        const currentAttributionRows = await manager.query(
          `SELECT * FROM "${actor.schema}".commercial_attributions
           WHERE opportunity_id = $1
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 1 FOR UPDATE`,
          [id],
        );
        const currentAttribution = currentAttributionRows[0] || null;
        let campaignName: string | null = null;
        if (campaignId) {
          const campaignRows = await manager.query(
            `SELECT id, name FROM "${actor.schema}".campaigns
             WHERE id = $1 AND deleted_at IS NULL
             LIMIT 1`,
            [campaignId],
          );
          if (!campaignRows[0]) throw new NotFoundException('Campagna non trovata');
          campaignName = String(campaignRows[0].name || '').trim() || null;
        }
        const next = {
          campaign_id: campaignId,
          campaign_name: campaignName,
          source: attribution.source ?? currentAttribution?.source ?? null,
          medium: attribution.medium ?? currentAttribution?.medium ?? null,
          content: attribution.content ?? currentAttribution?.content ?? null,
          term: attribution.term ?? currentAttribution?.term ?? null,
        };
        const unchanged = currentAttribution
          && String(currentAttribution.campaign_id || '') === String(next.campaign_id || '')
          && String(currentAttribution.source || '') === String(next.source || '')
          && String(currentAttribution.medium || '') === String(next.medium || '')
          && String(currentAttribution.content || '') === String(next.content || '')
          && String(currentAttribution.term || '') === String(next.term || '');
        if (unchanged) {
          return { item: { ...current, campaign_id: campaignId, commercial_attribution: currentAttribution }, unchanged: true, correlationId: context.correlationId };
        }

        const inserted = await manager.query(
          `INSERT INTO "${actor.schema}".commercial_attributions
             (company_id, contact_id, lead_id, opportunity_id, campaign_id,
              source, medium, campaign_name, content, term, attribution_model,
              occurred_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                   'manual_last_touch', now(), $11::jsonb)
           RETURNING *`,
          [
            current.company_id || null,
            current.contact_id || null,
            current.lead_id || null,
            id,
            campaignId,
            next.source,
            next.medium,
            campaignName,
            next.content,
            next.term,
            JSON.stringify({ source: 'commercial_lead_editor' }),
          ],
        );
        const updated = await manager.query(
          `UPDATE "${actor.schema}".opportunities
           SET version = version + 1, updated_by = $1, updated_at = now()
           WHERE id = $2 AND version = $3 AND deleted_at IS NULL
           RETURNING *`,
          [this.actorId(actor), id, version],
        );
        if (!updated[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(
          context,
          'commercial_attribution_changed',
          'opportunity',
          id,
          { opportunity: current, attribution: currentAttribution },
          { opportunity: updated[0], attribution: inserted[0] },
          { campaign_id: campaignId, attribution_id: inserted[0].id },
        );
        return {
          item: { ...updated[0], campaign_id: campaignId, commercial_attribution: inserted[0] },
          unchanged: false,
          correlationId: context.correlationId,
        };
      },
    );
  }

  async convertOpportunity(
    idValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const id = this.uuid(idValue, 'Lead');
    const expectedVersion = this.expectedVersion(body.version);
    const existingCompanyId = body.existingCompanyId
      ? this.uuid(body.existingCompanyId, 'Cliente esistente')
      : null;
    return this.withIdempotency(
      'commercial.opportunity.convert',
      keyValue,
      {
        id,
        expectedVersion,
        existingCompanyId,
        createOnboardingActivity: body.createOnboardingActivity !== false,
      },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canEditCustomers');
        const rows = await manager.query(
          `SELECT o.*, c.name AS company_name, c.email AS company_email,
                  c.phone AS company_phone, c.vat_number, c.fiscal_code,
                  ct.first_name, ct.last_name, ct.email AS contact_email,
                  ct.phone AS contact_phone
           FROM "${actor.schema}".opportunities o
           LEFT JOIN "${actor.schema}".companies c ON c.id = o.company_id
           LEFT JOIN "${actor.schema}".contacts ct ON ct.id = o.contact_id
           WHERE o.id = $1 AND o.deleted_at IS NULL FOR UPDATE OF o`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Lead non trovato');
        this.assertEditOpportunity(actor, current);
        if (current.converted_company_id) {
          return {
            status: 'existing',
            clientId: current.converted_company_id,
            opportunity: current,
            correlationId: context.correlationId,
          };
        }
        if (Number(current.version) !== expectedVersion) throw new ConflictException('Conflitto di versione');

        let companyId = existingCompanyId || (UUID_RE.test(String(current.company_id || '')) ? current.company_id : null);
        if (companyId) {
          const company = await manager.query(
            `SELECT id FROM "${actor.schema}".companies WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
            [companyId],
          );
          if (!company[0]) throw new NotFoundException('Cliente esistente non trovato');
        } else {
          const matched = current.contact_email
            ? await manager.query(
                `SELECT c.id FROM "${actor.schema}".companies c
                 JOIN "${actor.schema}".contacts ct ON ct.company_id = c.id AND ct.deleted_at IS NULL
                 WHERE lower(ct.email) = lower($1) AND c.deleted_at IS NULL
                 ORDER BY c.created_at LIMIT 1 FOR UPDATE OF c`,
                [current.contact_email],
              )
            : [];
          companyId = matched[0]?.id || null;
        }
        let created = false;
        if (!companyId) {
          const companyRows = await manager.query(
            `INSERT INTO "${actor.schema}".companies
               (name, email, phone, status, source, owner_user_id, created_by, updated_by)
             VALUES ($1, $2, $3, 'Da avviare', $4, $5, $6, $6)
             RETURNING id`,
            [
              current.company_name || current.title,
              current.contact_email || current.company_email || null,
              current.contact_phone || current.company_phone || null,
              current.lead_source || 'conversion',
              current.assigned_to || null,
              this.actorId(actor),
            ],
          );
          companyId = companyRows[0].id;
          created = true;
        } else {
          await manager.query(
            `UPDATE "${actor.schema}".companies
             SET status = CASE WHEN status IN ('prospect', 'lead') THEN 'Da avviare' ELSE status END,
                 version = version + 1, updated_by = $1, updated_at = now()
             WHERE id = $2`,
            [this.actorId(actor), companyId],
          );
        }

        let contactId = UUID_RE.test(String(current.contact_id || '')) ? current.contact_id : null;
        if (contactId) {
          await manager.query(
            `UPDATE "${actor.schema}".contacts SET company_id = $1, updated_by = $2,
             version = version + 1, updated_at = now() WHERE id = $3`,
            [companyId, this.actorId(actor), contactId],
          );
        }
        const opportunityRows = await manager.query(
          `UPDATE "${actor.schema}".opportunities
           SET company_id = $1, contact_id = COALESCE($2, contact_id), stage = 'closed_won', ui_stage = 'won',
               probability = 100, converted_company_id = $1,
               converted_contact_id = COALESCE($2, contact_id), converted_at = now(),
               version = version + 1, updated_by = $3, updated_at = now()
           WHERE id = $4 AND version = $5 AND deleted_at IS NULL
           RETURNING *`,
          [companyId, contactId, this.actorId(actor), id, expectedVersion],
        );
        if (!opportunityRows[0]) throw new ConflictException('Conflitto di versione');
        if (UUID_RE.test(String(current.lead_id || ''))) {
          await manager.query(
            `UPDATE "${actor.schema}".leads
             SET company_id = $1, contact_id = COALESCE($2, contact_id), status = 'converted',
                 version = version + 1, updated_by = $3, updated_at = now()
             WHERE id = $4 AND deleted_at IS NULL`,
            [companyId, contactId, this.actorId(actor), current.lead_id],
          );
        }
        await manager.query(
          `UPDATE "${actor.schema}".commercial_activities
           SET company_id = $1, updated_by = $2, version = version + 1, updated_at = now()
           WHERE opportunity_id = $3 AND deleted_at IS NULL`,
          [companyId, this.actorId(actor), id],
        );
        await manager.query(
          `UPDATE "${actor.schema}".commercial_attributions
           SET company_id = $1 WHERE opportunity_id = $2`,
          [companyId, id],
        );
        if (body.createOnboardingActivity !== false) {
          await manager.query(
            `INSERT INTO "${actor.schema}".commercial_activities
               (company_id, contact_id, lead_id, opportunity_id, type, title, description,
                due_at, assigned_to, created_by, updated_by, status, channel, metadata)
             VALUES ($1, $2, $3, $4, 'onboarding', 'Avvia onboarding cliente',
               'Raccogliere informazioni, materiali e accessi necessari.', now() + interval '1 day',
               $5, $6, $6, 'pending', 'internal', '{"timeline_event":false}'::jsonb)`,
            [companyId, contactId, current.lead_id || null, id, current.assigned_to || null, this.actorId(actor)],
          );
        }
        await this.recordOperation(
          context,
          'commercial_opportunity_converted',
          'opportunity',
          id,
          current,
          opportunityRows[0],
          { company_id: companyId, contact_id: contactId, customer_created: created },
        );
        return {
          status: created ? 'created' : 'existing',
          clientId: companyId,
          opportunity: opportunityRows[0],
          correlationId: context.correlationId,
        };
      },
    );
  }

  private normalizedPhoneSql(alias: string) {
    return `regexp_replace(COALESCE(${alias}.phone, ''), '[^0-9]', '', 'g')`;
  }

  async duplicateGroups() {
    const actor = await this.access.current();
    this.access.require(actor, 'canInspectDuplicates');
    await this.prepare(actor);
    const assignedOnly = !this.access.has(actor, 'canViewAllLeads');
    const params = assignedOnly ? [actor.id] : [];
    const opportunityScope = assignedOnly ? 'AND o.assigned_to = $1::uuid' : '';
    const rows = await this.dataSource.query(
      `WITH candidates AS (
         SELECT o.id, 'lead'::text AS record_type, o.title AS name, c.name AS company,
                ct.email, ct.phone, c.vat_number, c.fiscal_code, o.created_at,
                o.updated_at, o.lead_source AS source, o.assigned_to, o.stage AS status,
                o.version, o.company_id, o.lead_id, o.converted_company_id,
                lower(trim(COALESCE(ct.email, c.email, ''))) AS normalized_email,
                ${this.normalizedPhoneSql('ct')} AS normalized_phone,
                upper(regexp_replace(COALESCE(c.vat_number, ''), '\\s', '', 'g')) AS normalized_vat,
                upper(regexp_replace(COALESCE(c.fiscal_code, ''), '\\s', '', 'g')) AS normalized_tax
         FROM "${actor.schema}".opportunities o
         LEFT JOIN "${actor.schema}".companies c ON c.id = o.company_id
         LEFT JOIN "${actor.schema}".contacts ct ON ct.id = o.contact_id
         WHERE o.deleted_at IS NULL AND o.merged_into_id IS NULL ${opportunityScope}
         UNION ALL
         SELECT c.id, 'client', c.name, c.name, c.email, c.phone, c.vat_number,
                c.fiscal_code, c.created_at, c.updated_at, c.source, c.owner_user_id,
                c.status, c.version, c.id, NULL::uuid, NULL::uuid,
                lower(trim(COALESCE(c.email, ''))), ${this.normalizedPhoneSql('c')},
                upper(regexp_replace(COALESCE(c.vat_number, ''), '\\s', '', 'g')),
                upper(regexp_replace(COALESCE(c.fiscal_code, ''), '\\s', '', 'g'))
         FROM "${actor.schema}".companies c
         WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL
         UNION ALL
         SELECT ct.id, 'contact', concat_ws(' ', ct.first_name, ct.last_name), c.name,
                ct.email, ct.phone, NULL, NULL, ct.created_at, ct.updated_at, NULL,
                c.owner_user_id, ct.role_title, ct.version, ct.company_id, NULL::uuid, NULL::uuid,
                lower(trim(COALESCE(ct.email, ''))), ${this.normalizedPhoneSql('ct')}, '', ''
         FROM "${actor.schema}".contacts ct
         LEFT JOIN "${actor.schema}".companies c ON c.id = ct.company_id
         WHERE ct.deleted_at IS NULL AND ct.merged_into_id IS NULL
       ), pairs AS (
         SELECT a.*, b.id AS right_id, b.record_type AS right_type, b.name AS right_name,
                b.company AS right_company, b.email AS right_email, b.phone AS right_phone,
                b.vat_number AS right_vat_number, b.fiscal_code AS right_fiscal_code,
                b.created_at AS right_created_at, b.updated_at AS right_updated_at,
                b.source AS right_source, b.assigned_to AS right_assigned_to,
                b.status AS right_status, b.version AS right_version,
                b.company_id AS right_company_id,
                LEAST(a.id::text, b.id::text) || '::' || GREATEST(a.id::text, b.id::text) AS pair_key,
                array_remove(ARRAY[
                  CASE WHEN length(a.normalized_email) > 3 AND a.normalized_email = b.normalized_email THEN 'Email' END,
                  CASE WHEN length(a.normalized_phone) >= 8 AND right(a.normalized_phone, 10) = right(b.normalized_phone, 10) THEN 'Telefono' END,
                  CASE WHEN length(a.normalized_vat) > 3 AND a.normalized_vat = b.normalized_vat THEN 'Partita IVA' END,
                  CASE WHEN length(a.normalized_tax) > 3 AND a.normalized_tax = b.normalized_tax THEN 'Codice fiscale' END,
                  CASE WHEN lower(trim(COALESCE(a.company, ''))) <> '' AND lower(trim(a.company)) = lower(trim(b.company)) THEN 'Azienda' END
                ], NULL) AS matching_fields
         FROM candidates a JOIN candidates b ON a.id::text < b.id::text
         WHERE NOT (a.lead_id IS NOT NULL AND a.lead_id = b.lead_id)
       )
       SELECT p.*, d.decision
       FROM pairs p
       LEFT JOIN "${actor.schema}".commercial_duplicate_decisions d ON d.pair_key = p.pair_key
       WHERE cardinality(p.matching_fields) > 0
       ORDER BY cardinality(p.matching_fields) DESC, p.created_at`,
      params,
    );
    const mapped = rows.map((row: any) => {
        const fields = row.matching_fields || [];
        const candidate = (right: boolean) => ({
          id: right ? row.right_id : row.id,
          type: right ? row.right_type : row.record_type,
          name: right ? row.right_name : row.name,
          company: right ? row.right_company : row.company,
          email: right ? row.right_email : row.email,
          phone: right ? row.right_phone : row.phone,
          vatNumber: right ? row.right_vat_number : row.vat_number,
          taxCode: right ? row.right_fiscal_code : row.fiscal_code,
          createdAt: right ? row.right_created_at : row.created_at,
          updatedAt: right ? row.right_updated_at : row.updated_at,
          source: right ? row.right_source : row.source,
          owner: right ? row.right_assigned_to : row.assigned_to,
          status: right ? row.right_status : row.status,
          version: Number(right ? row.right_version : row.version),
          customerId: (right ? row.right_type : row.record_type) === 'contact'
            ? (right ? row.right_company_id : row.company_id)
            : undefined,
        });
        return {
          id: `duplicate-${row.pair_key}`,
          pairKey: row.pair_key,
          level: fields.some((field: string) => field !== 'Azienda') ? 'certain' : 'probable',
          candidates: [candidate(false), candidate(true)],
          reasons: fields.map((field: string) => `Stesso ${field.toLowerCase()}`),
          matchingFields: fields,
          score: Math.min(100, fields.includes('Azienda') ? 75 + (fields.length - 1) * 8 : 85 + fields.length * 5),
          decision: row.decision || 'pending',
        };
      });
    return {
      analyzedAt: new Date().toISOString(),
      groups: mapped.filter((group: any) => group.decision !== 'ignored'),
      ignored: mapped.filter((group: any) => group.decision === 'ignored'),
    };
  }

  async decideDuplicate(body: Record<string, unknown>, keyValue: unknown) {
    const leftId = this.uuid(body.leftId, 'Record sinistro');
    const rightId = this.uuid(body.rightId, 'Record destro');
    if (leftId === rightId) throw new BadRequestException('La coppia deve contenere record distinti');
    const decision = String(body.decision || '');
    if (!['ignored', 'pending'].includes(decision)) throw new BadRequestException('Decisione duplicato non valida');
    const pairKey = [leftId, rightId].sort().join('::');
    const reason = String(body.reason || '').trim().slice(0, 500) || null;
    return this.withIdempotency(
      'commercial.duplicates.decision',
      keyValue,
      { leftId, rightId, decision, reason },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canInspectDuplicates');
        const previousRows = await manager.query(
          `SELECT * FROM "${actor.schema}".commercial_duplicate_decisions
           WHERE pair_key = $1 FOR UPDATE`,
          [pairKey],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".commercial_duplicate_decisions
             (pair_key, left_id, right_id, record_type, decision, decided_by, reason)
           VALUES ($1, $2, $3, 'mixed', $4, $5, $6)
           ON CONFLICT (pair_key) DO UPDATE SET decision = excluded.decision,
             decided_by = excluded.decided_by, reason = excluded.reason, updated_at = now()`,
          [pairKey, leftId, rightId, decision, this.actorId(actor), reason],
        );
        const result = { ok: true as const, pairKey, decision };
        await this.recordOperation(
          context,
          decision === 'ignored' ? 'commercial_duplicate_ignored' : 'commercial_duplicate_reopened',
          'duplicate_pair',
          leftId,
          previousRows[0] || null,
          result,
          { pair_key: pairKey, right_id: rightId, reason },
        );
        return result;
      },
    );
  }

  private async identifyRecord(manager: Queryable, schema: string, id: string) {
    for (const table of MERGE_TABLES) {
      const rows = await manager.query(
        `SELECT * FROM "${schema}"."${table}" WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (rows[0]) return { table, row: rows[0] };
    }
    throw new NotFoundException('Record duplicato non trovato');
  }

  private async columnExists(manager: Queryable, schema: string, table: string, column: string) {
    const rows = await manager.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
      [schema, table, column],
    );
    return Boolean(rows[0]);
  }

  private async repoint(
    manager: Queryable,
    schema: string,
    table: string,
    column: string,
    primaryId: string,
    secondaryId: string,
  ) {
    if (!(await this.columnExists(manager, schema, table, column))) return;
    await manager.query(
      `UPDATE "${schema}"."${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
      [primaryId, secondaryId],
    );
  }

  private mergeFields(table: MergeTable, fieldsValue: unknown) {
    const fields = fieldsValue && typeof fieldsValue === 'object'
      ? fieldsValue as Record<string, unknown>
      : {};
    const mappings: Record<MergeTable, Record<string, string>> = {
      opportunities: {
        opportunityName: 'title', service: 'service_type', value: 'value_estimate',
        probability: 'probability', assigneeId: 'assigned_to', nextAction: 'next_action',
        nextActionAt: 'next_action_at', stage: 'stage', source: 'lead_source',
      },
      companies: {
        company: 'name', email: 'email', phone: 'phone', vatNumber: 'vat_number',
        taxCode: 'fiscal_code', location: 'address', assigneeId: 'owner_user_id',
        status: 'status',
      },
      contacts: { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', role: 'role_title' },
    };
    return Object.fromEntries(
      Object.entries(mappings[table]).flatMap(([source, target]) =>
        source in fields ? [[target, fields[source]]] : [],
      ),
    );
  }

  async mergeDuplicates(body: Record<string, unknown>, keyValue: unknown) {
    const primaryId = this.uuid(body.primaryId, 'Record principale');
    const secondaryId = this.uuid(body.secondaryId, 'Record secondario');
    if (primaryId === secondaryId) throw new BadRequestException('I record devono essere distinti');
    const primaryVersion = this.expectedVersion(body.primaryVersion);
    const secondaryVersion = this.expectedVersion(body.secondaryVersion);
    return this.withIdempotency(
      'commercial.duplicates.merge',
      keyValue,
      { primaryId, secondaryId, primaryVersion, secondaryVersion, fields: body.fields || {} },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canMergeDuplicates');
        const primary = await this.identifyRecord(manager, actor.schema, primaryId);
        const secondary = await this.identifyRecord(manager, actor.schema, secondaryId);
        if (primary.row.deleted_at || secondary.row.deleted_at || primary.row.merged_into_id || secondary.row.merged_into_id) {
          throw new ConflictException('Uno dei record è già archiviato o fuso');
        }
        if (Number(primary.row.version) !== primaryVersion || Number(secondary.row.version) !== secondaryVersion) {
          throw new ConflictException('I record duplicati sono cambiati: ricarica l’anteprima');
        }

        if (primary.table !== secondary.table) {
          if (!['companies', 'opportunities'].includes(primary.table) || !['companies', 'opportunities'].includes(secondary.table)) {
            throw new ConflictException('La fusione diretta dei contatti richiede una procedura dedicata');
          }

          const companyDependents = [
            'contacts', 'leads', 'opportunities', 'commercial_activities',
            'commercial_communications', 'commercial_attributions', 'projects',
            'quotes', 'contracts', 'documents',
          ];
          const repointCompany = async (targetId: string, sourceId: string) => {
            for (const dependent of companyDependents) {
              await this.repoint(manager, actor.schema, dependent, 'company_id', targetId, sourceId);
            }
          };

          let primarySaved: Record<string, any>;
          let secondarySaved: Record<string, any>;
          let canonicalCompanyId: string;
          if (primary.table === 'companies') {
            canonicalCompanyId = primaryId;
            const companyUpdates = Object.entries(this.mergeFields('companies', body.fields));
            if (companyUpdates.length) {
              await manager.query(
                `UPDATE "${actor.schema}".companies
                 SET ${companyUpdates.map(([field], index) => `"${field}" = $${index + 1}`).join(', ')},
                     updated_by = $${companyUpdates.length + 1}, updated_at = now()
                 WHERE id = $${companyUpdates.length + 2}`,
                [...companyUpdates.map(([, value]) => value), this.actorId(actor), primaryId],
              );
            }
            const sourceCompanyId = UUID_RE.test(String(secondary.row.company_id || ''))
              ? String(secondary.row.company_id)
              : null;
            if (sourceCompanyId && sourceCompanyId !== canonicalCompanyId) {
              const sourceCompanies = await manager.query(
                `SELECT * FROM "${actor.schema}".companies WHERE id = $1 FOR UPDATE`,
                [sourceCompanyId],
              );
              if (sourceCompanies[0] && !sourceCompanies[0].deleted_at) {
                await repointCompany(canonicalCompanyId, sourceCompanyId);
                await manager.query(
                  `UPDATE "${actor.schema}".companies
                   SET merged_into_id = $1, deleted_at = now(), archived_by = $2,
                       archive_reason = 'Fusione duplicati lead-cliente', version = version + 1,
                       updated_by = $2, updated_at = now()
                   WHERE id = $3 AND deleted_at IS NULL`,
                  [canonicalCompanyId, this.actorId(actor), sourceCompanyId],
                );
              }
            }
            await manager.query(
              `UPDATE "${actor.schema}".commercial_activities
               SET company_id = $1, updated_by = $2, version = version + 1, updated_at = now()
               WHERE opportunity_id = $3 AND deleted_at IS NULL`,
              [canonicalCompanyId, this.actorId(actor), secondaryId],
            );
            await manager.query(
              `UPDATE "${actor.schema}".commercial_attributions
               SET company_id = $1 WHERE opportunity_id = $2`,
              [canonicalCompanyId, secondaryId],
            );
            const archivedOpportunity = await manager.query(
              `UPDATE "${actor.schema}".opportunities
               SET company_id = $1, merged_into_id = $1, deleted_at = now(), archived_by = $2,
                   archive_reason = 'Fusione duplicati lead-cliente', version = version + 1,
                   updated_by = $2, updated_at = now()
               WHERE id = $3 AND version = $4 AND deleted_at IS NULL
               RETURNING *`,
              [canonicalCompanyId, this.actorId(actor), secondaryId, secondaryVersion],
            );
            if (!archivedOpportunity[0]) throw new ConflictException('Conflitto durante la fusione');
            secondarySaved = archivedOpportunity[0];
            const savedCompanies = await manager.query(
              `UPDATE "${actor.schema}".companies
               SET version = version + 1, updated_by = $1, updated_at = now()
               WHERE id = $2 AND version = $3 AND deleted_at IS NULL
               RETURNING *`,
              [this.actorId(actor), primaryId, primaryVersion],
            );
            if (!savedCompanies[0]) throw new ConflictException('Conflitto durante la fusione');
            primarySaved = savedCompanies[0];
          } else {
            const currentCompanyId = UUID_RE.test(String(primary.row.company_id || ''))
              ? String(primary.row.company_id)
              : null;
            if (currentCompanyId && currentCompanyId !== secondaryId) {
              canonicalCompanyId = currentCompanyId;
            } else {
              const clonedCompanies = await manager.query(
                `INSERT INTO "${actor.schema}".companies
                   (name, legal_name, vat_number, fiscal_code, website, email, phone,
                    industry, size, status, source, address, city, province, country,
                    notes, owner_user_id, created_by, updated_by)
                 SELECT name, legal_name, vat_number, fiscal_code, website, email, phone,
                        industry, size, status, source, address, city, province, country,
                        notes, owner_user_id, $1, $1
                 FROM "${actor.schema}".companies
                 WHERE id = $2 AND deleted_at IS NULL
                 RETURNING *`,
                [this.actorId(actor), secondaryId],
              );
              if (!clonedCompanies[0]) throw new NotFoundException('Cliente secondario non trovato');
              canonicalCompanyId = clonedCompanies[0].id;
            }
            await repointCompany(canonicalCompanyId, secondaryId);
            const archivedCompany = await manager.query(
              `UPDATE "${actor.schema}".companies
               SET merged_into_id = $1, deleted_at = now(), archived_by = $2,
                   archive_reason = 'Fusione duplicati lead-cliente', version = version + 1,
                   updated_by = $2, updated_at = now()
               WHERE id = $3 AND version = $4 AND deleted_at IS NULL
               RETURNING *`,
              [canonicalCompanyId, this.actorId(actor), secondaryId, secondaryVersion],
            );
            if (!archivedCompany[0]) throw new ConflictException('Conflitto durante la fusione');
            secondarySaved = archivedCompany[0];
            const opportunityUpdates = Object.entries(this.mergeFields('opportunities', body.fields));
            const savedOpportunities = await manager.query(
              `UPDATE "${actor.schema}".opportunities
               SET company_id = $1,
                   ${opportunityUpdates.map(([field], index) => `"${field}" = $${index + 2}`).join(', ')}${opportunityUpdates.length ? ',' : ''}
                   version = version + 1, updated_by = $${opportunityUpdates.length + 2}, updated_at = now()
               WHERE id = $${opportunityUpdates.length + 3} AND version = $${opportunityUpdates.length + 4} AND deleted_at IS NULL
               RETURNING *`,
              [
                canonicalCompanyId,
                ...opportunityUpdates.map(([, value]) => value),
                this.actorId(actor),
                primaryId,
                primaryVersion,
              ],
            );
            if (!savedOpportunities[0]) throw new ConflictException('Conflitto durante la fusione');
            primarySaved = savedOpportunities[0];
          }

          const pairKey = [primaryId, secondaryId].sort().join('::');
          await manager.query(
            `INSERT INTO "${actor.schema}".commercial_duplicate_decisions
               (pair_key, left_id, right_id, record_type, decision, primary_id, secondary_id, decided_by, metadata)
             VALUES ($1, $2, $3, 'lead_client', 'merged', $4, $5, $6, $7::jsonb)
             ON CONFLICT (pair_key) DO UPDATE SET decision = 'merged', primary_id = excluded.primary_id,
               secondary_id = excluded.secondary_id, decided_by = excluded.decided_by,
               metadata = excluded.metadata, updated_at = now()`,
            [pairKey, primaryId, secondaryId, primaryId, secondaryId, this.actorId(actor), JSON.stringify({ fields: body.fields || {}, canonical_company_id: canonicalCompanyId })],
          );
          await this.recordOperation(
            context,
            'commercial_duplicate_merged',
            primary.table.slice(0, -1),
            primaryId,
            { primary: primary.row, secondary: secondary.row },
            { primary: primarySaved, secondary: secondarySaved },
            { secondary_id: secondaryId, record_type: 'lead_client', canonical_company_id: canonicalCompanyId },
          );
          return {
            ok: true,
            primaryId,
            secondaryId,
            recordType: 'lead_client',
            item: primarySaved,
            correlationId: context.correlationId,
          };
        }
        const table = primary.table;
        const updates = this.mergeFields(table, body.fields);
        const entries = Object.entries(updates);
        if (entries.length) {
          await manager.query(
            `UPDATE "${actor.schema}"."${table}"
             SET ${entries.map(([field], index) => `"${field}" = $${index + 1}`).join(', ')},
                 updated_by = $${entries.length + 1}, updated_at = now()
             WHERE id = $${entries.length + 2}`,
            [...entries.map(([, value]) => value), this.actorId(actor), primaryId],
          );
        }

        if (table === 'opportunities') {
          for (const [dependent, column] of [
            ['commercial_activities', 'opportunity_id'], ['commercial_attributions', 'opportunity_id'],
            ['projects', 'opportunity_id'], ['quotes', 'opportunity_id'], ['contracts', 'opportunity_id'],
          ] as const) await this.repoint(manager, actor.schema, dependent, column, primaryId, secondaryId);
        } else if (table === 'companies') {
          for (const dependent of [
            'contacts', 'leads', 'opportunities', 'commercial_activities', 'commercial_communications',
            'commercial_attributions', 'projects', 'quotes', 'contracts', 'documents',
          ]) await this.repoint(manager, actor.schema, dependent, 'company_id', primaryId, secondaryId);
        } else {
          for (const dependent of ['leads', 'opportunities', 'commercial_activities', 'commercial_communications', 'projects', 'quotes', 'contracts']) {
            await this.repoint(manager, actor.schema, dependent, 'contact_id', primaryId, secondaryId);
          }
        }
        const archived = await manager.query(
          `UPDATE "${actor.schema}"."${table}"
           SET merged_into_id = $1, deleted_at = now(), archived_by = $2,
               archive_reason = 'Fusione duplicati', version = version + 1,
               updated_by = $2, updated_at = now()
           WHERE id = $3 AND version = $4 AND deleted_at IS NULL
           RETURNING *`,
          [primaryId, this.actorId(actor), secondaryId, secondaryVersion],
        );
        if (!archived[0]) throw new ConflictException('Conflitto durante la fusione');
        const primaryRows = await manager.query(
          `UPDATE "${actor.schema}"."${table}"
           SET version = version + 1, updated_by = $1, updated_at = now()
           WHERE id = $2 RETURNING *`,
          [this.actorId(actor), primaryId],
        );
        const pairKey = [primaryId, secondaryId].sort().join('::');
        await manager.query(
          `INSERT INTO "${actor.schema}".commercial_duplicate_decisions
             (pair_key, left_id, right_id, record_type, decision, primary_id, secondary_id, decided_by, metadata)
           VALUES ($1, $2, $3, $4, 'merged', $5, $6, $7, $8::jsonb)
           ON CONFLICT (pair_key) DO UPDATE SET decision = 'merged', primary_id = excluded.primary_id,
             secondary_id = excluded.secondary_id, decided_by = excluded.decided_by,
             metadata = excluded.metadata, updated_at = now()`,
          [pairKey, primaryId, secondaryId, table, primaryId, secondaryId, this.actorId(actor), JSON.stringify({ fields: body.fields || {} })],
        );
        await this.recordOperation(
          context,
          'commercial_duplicate_merged',
          table.slice(0, -1),
          primaryId,
          { primary: primary.row, secondary: secondary.row },
          { primary: primaryRows[0], secondary: archived[0] },
          { secondary_id: secondaryId, record_type: table },
        );
        return {
          ok: true,
          primaryId,
          secondaryId,
          recordType: table,
          item: primaryRows[0],
          correlationId: context.correlationId,
        };
      },
    );
  }

  async customerAggregate(idValue: string) {
    const actor = await this.access.current();
    this.access.require(actor, 'canViewCustomers');
    const id = this.uuid(idValue, 'Cliente');
    await this.prepare(actor);
    const companies = await this.dataSource.query(
      `SELECT * FROM "${actor.schema}".companies WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!companies[0]) throw new NotFoundException('Cliente non trovato');
    const [contacts, opportunities, activities, communications, attributions] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "${actor.schema}".contacts WHERE company_id = $1 AND deleted_at IS NULL ORDER BY is_primary DESC, created_at`, [id]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".opportunities WHERE company_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`, [id]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".commercial_activities WHERE company_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [id]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".commercial_communications WHERE company_id = $1 AND deleted_at IS NULL ORDER BY occurred_at DESC`, [id]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".commercial_attributions WHERE company_id = $1 ORDER BY occurred_at DESC`, [id]),
    ]);
    return { company: companies[0], contacts, opportunities, activities, communications, attributions };
  }

  async listCommunications() {
    const actor = await this.access.current();
    this.access.require(actor, 'canViewCustomers');
    await this.prepare(actor);
    return {
      items: await this.dataSource.query(
        `SELECT * FROM "${actor.schema}".commercial_communications
         WHERE deleted_at IS NULL ORDER BY occurred_at DESC, created_at DESC LIMIT 1000`,
      ),
    };
  }

  async setPrimaryContact(
    companyIdValue: string,
    contactIdValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const companyId = this.uuid(companyIdValue, 'Cliente');
    const contactId = this.uuid(contactIdValue, 'Contatto');
    const version = this.expectedVersion(body.version);
    return this.withIdempotency(
      'commercial.contacts.primary',
      keyValue,
      { companyId, contactId, version },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canEditCustomers');
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".contacts
           WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
          [contactId, companyId],
        );
        const contact = rows[0];
        if (!contact) throw new NotFoundException('Contatto cliente non trovato');
        if (Number(contact.version) !== version) throw new ConflictException('Conflitto di versione');
        if (contact.is_primary) {
          return { item: contact, unchanged: true, correlationId: context.correlationId };
        }
        await manager.query(
          `UPDATE "${actor.schema}".contacts
           SET is_primary = false, version = version + 1, updated_by = $1, updated_at = now()
           WHERE company_id = $2 AND is_primary = true AND deleted_at IS NULL AND id <> $3`,
          [this.actorId(actor), companyId, contactId],
        );
        const updated = await manager.query(
          `UPDATE "${actor.schema}".contacts
           SET is_primary = true, version = version + 1, updated_by = $1, updated_at = now()
           WHERE id = $2 AND version = $3 RETURNING *`,
          [this.actorId(actor), contactId, version],
        );
        if (!updated[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(context, 'commercial_primary_contact_changed', 'company', companyId, contact, updated[0], { contact_id: contactId });
        return { item: updated[0], correlationId: context.correlationId };
      },
    );
  }

  async createCommunication(
    companyIdValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const companyId = this.uuid(companyIdValue, 'Cliente');
    const channel = String(body.channel || '').trim().toLowerCase();
    if (!['whatsapp', 'email', 'chiamata', 'nota', 'phone', 'note'].includes(channel)) {
      throw new BadRequestException('Canale comunicazione non valido');
    }
    const title = String(body.title || '').trim().slice(0, 300);
    const message = String(body.body || '').trim().slice(0, 10000);
    if (!title || !message) throw new BadRequestException('Titolo e contenuto obbligatori');
    return this.withIdempotency(
      'commercial.communication.create',
      keyValue,
      { companyId, channel, title, message, occurredAt: body.occurredAt },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canEditCustomers');
        const company = await manager.query(
          `SELECT id FROM "${actor.schema}".companies WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [companyId],
        );
        if (!company[0]) throw new NotFoundException('Cliente non trovato');
        const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
        if (!Number.isFinite(occurredAt.getTime())) throw new BadRequestException('Data comunicazione non valida');
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".commercial_communications
             (company_id, contact_id, lead_id, opportunity_id, channel, direction,
              title, body, status, occurred_at, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
           RETURNING *`,
          [
            companyId,
            body.contactId ? this.uuid(body.contactId, 'Contatto') : null,
            body.leadId ? this.uuid(body.leadId, 'Lead origine') : null,
            body.opportunityId ? this.uuid(body.opportunityId, 'Opportunità') : null,
            channel,
            String(body.direction || '').trim() || null,
            title,
            message,
            String(body.status || 'recorded').trim(),
            occurredAt.toISOString(),
            JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
            this.actorId(actor),
          ],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".commercial_activities
             (company_id, contact_id, lead_id, opportunity_id, type, title, description,
              completed_at, created_by, updated_by, channel, direction, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $8, $5, $9, $10, $11::jsonb)`,
          [
            companyId,
            body.contactId ? this.uuid(body.contactId, 'Contatto') : null,
            body.leadId ? this.uuid(body.leadId, 'Lead origine') : null,
            body.opportunityId ? this.uuid(body.opportunityId, 'Opportunità') : null,
            channel === 'nota' || channel === 'note' ? 'note' : channel === 'chiamata' ? 'call' : channel,
            title,
            message,
            this.actorId(actor),
            String(body.direction || '').trim() || null,
            String(body.status || 'recorded').trim(),
            JSON.stringify({ timeline_event: true, communication_id: rows[0].id, operation_id: context.operationId }),
          ],
        );
        await this.recordOperation(context, 'commercial_communication_created', 'company', companyId, null, rows[0], { communication_id: rows[0].id, channel });
        return { item: rows[0], correlationId: context.correlationId };
      },
    );
  }

  async updateCommunication(
    companyIdValue: string,
    communicationIdValue: string,
    body: Record<string, unknown>,
    keyValue: unknown,
  ) {
    const companyId = this.uuid(companyIdValue, 'Cliente');
    const communicationId = this.uuid(communicationIdValue, 'Comunicazione');
    const version = this.expectedVersion(body.version);
    const input = body.updates && typeof body.updates === 'object'
      ? body.updates as Record<string, unknown>
      : {};
    const allowed = ['channel', 'direction', 'title', 'body', 'status', 'occurred_at', 'contact_id'] as const;
    const updates = Object.fromEntries(allowed.flatMap((field) => field in input ? [[field, input[field]]] : []));
    if (!Object.keys(updates).length) throw new BadRequestException('Nessuna modifica comunicazione');
    if ('channel' in updates && !['whatsapp', 'email', 'chiamata', 'nota', 'phone', 'note'].includes(String(updates.channel).toLowerCase())) {
      throw new BadRequestException('Canale comunicazione non valido');
    }
    if ('contact_id' in updates && updates.contact_id) this.uuid(updates.contact_id, 'Contatto');
    return this.withIdempotency(
      'commercial.communication.update',
      keyValue,
      { companyId, communicationId, version, updates },
      async (context) => {
        const { actor, manager } = context;
        this.access.require(actor, 'canEditCustomers');
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".commercial_communications
           WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
          [communicationId, companyId],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Comunicazione non trovata');
        if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione');
        const entries = Object.entries(updates).filter(([field, value]) => {
          const previous = current[field];
          if (previous == null && value == null) return false;
          if (typeof previous === 'object' || typeof value === 'object') {
            return JSON.stringify(previous) !== JSON.stringify(value);
          }
          return String(previous) !== String(value);
        });
        if (!entries.length) {
          return { item: current, unchanged: true, correlationId: context.correlationId };
        }
        const saved = await manager.query(
          `UPDATE "${actor.schema}".commercial_communications
           SET ${entries.map(([field], index) => `"${field}" = $${index + 1}`).join(', ')},
               version = version + 1, updated_by = $${entries.length + 1}, updated_at = now()
           WHERE id = $${entries.length + 2} AND version = $${entries.length + 3}
           RETURNING *`,
          [...entries.map(([, value]) => value), this.actorId(actor), communicationId, version],
        );
        if (!saved[0]) throw new ConflictException('Conflitto di versione');
        await this.recordOperation(context, 'commercial_communication_updated', 'company', companyId, current, saved[0], { communication_id: communicationId });
        return { item: saved[0], correlationId: context.correlationId };
      },
    );
  }
}
