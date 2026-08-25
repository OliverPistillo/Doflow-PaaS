import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../realtime/notifications.service';
import { TenantCommercialAccessService, type CommercialActor } from './tenant-commercial-access.service';
import { DELIVERY_PROJECT_STATES, DELIVERY_TASK_STATES } from './tenant-delivery-core.dto';
import { hasDirectedCycle } from './tenant-delivery-invariants';
import { ensureTenantDeliveryCoreTables } from './tenant-delivery-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_STATES = new Set<string>(DELIVERY_PROJECT_STATES);
const TASK_STATES = new Set<string>(DELIVERY_TASK_STATES);
const PROJECT_MEMBER_ROLES = new Set(['project_manager', 'supervisor', 'member', 'developer', 'designer', 'seo', 'copywriter']);
const REQUIRED_QA = [
  'Desktop verificato', 'Tablet verificato', 'Mobile verificato', 'Form funzionanti',
  'Link controllati', 'Nessun errore console', 'SEO base', 'Cookie/privacy',
  'Performance', 'Immagini', 'Testi', 'Backup',
];
const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  not_started: ['onboarding', 'in_progress', 'suspended', 'cancelled'],
  onboarding: ['in_progress', 'blocked', 'suspended', 'cancelled'],
  in_progress: ['blocked', 'qa_internal', 'suspended', 'cancelled'],
  blocked: ['in_progress', 'suspended', 'cancelled'],
  qa_internal: ['internal_review', 'changes_requested', 'in_progress', 'suspended'],
  internal_review: ['ready_client', 'changes_requested', 'in_progress', 'suspended'],
  ready_client: ['client_review', 'ready_publish', 'changes_requested', 'suspended'],
  client_review: ['changes_requested', 'ready_publish', 'suspended'],
  changes_requested: ['in_progress', 'qa_internal', 'suspended', 'cancelled'],
  ready_publish: ['published', 'changes_requested', 'suspended'],
  published: ['delivered', 'changes_requested', 'suspended'],
  delivered: ['support', 'in_progress', 'suspended'],
  support: ['in_progress', 'suspended', 'cancelled'],
  suspended: ['not_started', 'onboarding', 'in_progress', 'blocked', 'qa_internal', 'internal_review', 'ready_client', 'client_review', 'changes_requested', 'ready_publish', 'published', 'delivered', 'support', 'cancelled'],
  cancelled: ['not_started'],
};

type Queryable = Pick<EntityManager, 'query'>;
type OperationContext = {
  actor: CommercialActor;
  manager: EntityManager;
  operationId: string;
  correlationId: string;
};

@Injectable()
export class TenantDeliveryCoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: TenantCommercialAccessService,
    private readonly realtime: NotificationsService,
  ) {}

  private uuid(value: unknown, label: string) {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private version(value: unknown) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('Versione record obbligatoria');
    return version;
  }

  private key(value: unknown) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9_.:@/-]{8,200}$/.test(key)) throw new BadRequestException('Idempotency-Key non valida');
    return key;
  }

  private actorId(actor: CommercialActor) {
    return UUID_RE.test(actor.id) ? actor.id : null;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private text(value: unknown, max = 10_000) {
    return String(value ?? '').trim().slice(0, max);
  }

  /** TypeORM may expose UPDATE ... RETURNING as [rows, affected]; keep one row contract for the domain service. */
  private normalizeQueryResult(result: any) {
    return Array.isArray(result) && Array.isArray(result[0]) && typeof result[1] === 'number' ? result[0] : result;
  }

  private operationManager(manager: EntityManager) {
    const normalized = Object.create(manager) as EntityManager;
    normalized.query = async (sql: string, parameters?: any[]) => this.normalizeQueryResult(await manager.query(sql, parameters));
    return normalized;
  }

  private async prepare(actor: CommercialActor) {
    await ensureTenantDeliveryCoreTables(this.dataSource, actor.schema);
  }

  private require(actor: CommercialActor, ...capabilities: string[]) {
    this.access.require(actor, ...capabilities);
  }

  private canManageAll(actor: CommercialActor) {
    return this.access.has(actor, 'canManageProjects') || this.access.has(actor, 'canViewGlobalWorkload');
  }

  private async withOperation<T>(
    operation: string,
    keyValue: unknown,
    requestValue: unknown,
    work: (context: OperationContext) => Promise<T>,
  ): Promise<T> {
    const actor = await this.access.current();
    const idempotencyKey = this.key(keyValue);
    const requestHash = this.hash(requestValue);
    await this.prepare(actor);
    const response = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.query(
        `SELECT request_hash, status, response FROM "${actor.schema}".delivery_idempotency
         WHERE operation = $1 AND idempotency_key = $2 FOR UPDATE`,
        [operation, idempotencyKey],
      );
      if (existing[0]) {
        if (String(existing[0].request_hash) !== requestHash) {
          throw new ConflictException('Idempotency-Key già usata con dati differenti');
        }
        if (existing[0].status === 'completed') return existing[0].response as T;
        throw new ConflictException('Operazione identica già in corso');
      }
      await manager.query(
        `INSERT INTO "${actor.schema}".delivery_idempotency
           (operation, idempotency_key, actor_user_id, request_hash, status)
         VALUES ($1, $2, $3, $4, 'processing')`,
        [operation, idempotencyKey, this.actorId(actor), requestHash],
      );
      const context = { actor, manager: this.operationManager(manager), operationId: randomUUID(), correlationId: randomUUID() };
      const result = await work(context);
      await manager.query(
        `UPDATE "${actor.schema}".delivery_idempotency
         SET status = 'completed', response = $3::jsonb, completed_at = now()
         WHERE operation = $1 AND idempotency_key = $2`,
        [operation, idempotencyKey, JSON.stringify(result)],
      );
      return result;
    });
    try {
      await this.realtime.notifyTenant(actor.schema, {
        kind: 'delivery_changed', operation, correlationId: (response as any)?.correlationId,
      });
    } catch {
      // Realtime is a non-authoritative projection and cannot roll business data back.
    }
    return response;
  }

  private async project(
    queryable: Queryable,
    actor: CommercialActor,
    projectId: string,
    lock = false,
    requireWrite = false,
  ) {
    const rows = await queryable.query(
      `SELECT p.* FROM "${actor.schema}".projects p
       WHERE p.id = $1 AND p.deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
      [this.uuid(projectId, 'project_id')],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Progetto non trovato');
    if (this.canManageAll(actor)) return row;
    const assigned = await queryable.query(
      `SELECT 1
       FROM "${actor.schema}".project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM "${actor.schema}".tasks t
       WHERE t.project_id = $1 AND t.assignee_id = $2 AND t.deleted_at IS NULL
       LIMIT 1`,
      [projectId, this.actorId(actor)],
    );
    if (!assigned[0]) throw new ForbiddenException('Progetto non assegnato');
    if (requireWrite && !this.access.has(actor, 'canManageProjectTasks') && !this.access.has(actor, 'canEditProject')) {
      throw new ForbiddenException('Capability Delivery di modifica richiesta');
    }
    return row;
  }

  private async activeUser(queryable: Queryable, actor: CommercialActor, userId: string) {
    const id = this.uuid(userId, 'user_id');
    const rows = await queryable.query(
      `SELECT id, role, full_name, email FROM "${actor.schema}".users
       WHERE id = $1 AND is_active = true LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new BadRequestException('Utente non attivo nel tenant');
    return rows[0];
  }

  private async assertSupervisor(queryable: Queryable, actor: CommercialActor, userId: string) {
    const user = await this.activeUser(queryable, actor, userId);
    if (['owner', 'admin'].includes(String(user.role || '').toLowerCase())) return user;
    const rows = await queryable.query(
      `SELECT 1 FROM "${actor.schema}".doflow_user_roles
       WHERE user_id = $1 AND role IN ('administrator', 'project_manager')
       UNION ALL
       SELECT 1 FROM "${actor.schema}".doflow_user_capabilities
       WHERE user_id = $1 AND capability IN ('canSuperviseProject', 'canApproveProjectWork')
       LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new BadRequestException('Il supervisore non possiede la capability richiesta');
    return user;
  }

  private async event(
    context: OperationContext,
    input: {
      projectId: string; eventType: string; taskId?: string | null; phaseId?: string | null;
      before?: unknown; after?: unknown; reason?: string | null; metadata?: Record<string, unknown>;
      recipients?: string[];
    },
  ) {
    const { actor, manager, operationId, correlationId } = context;
    const metadata = input.metadata || {};
    await manager.query(
      `INSERT INTO "${actor.schema}".project_workflow_events
         (operation_id, correlation_id, project_id, task_id, phase_id, event_type,
          actor_user_id, previous_state, next_state, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb)`,
      [
        operationId, correlationId, input.projectId, input.taskId || null, input.phaseId || null,
        input.eventType, this.actorId(actor), input.before == null ? null : JSON.stringify(input.before),
        input.after == null ? null : JSON.stringify(input.after), input.reason || null, JSON.stringify(metadata),
      ],
    );
    await manager.query(
      `INSERT INTO "${actor.schema}".audit_log
         (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [actor.email, actor.role, input.eventType, input.projectId, JSON.stringify({
        correlation_id: correlationId, operation_id: operationId, task_id: input.taskId || null,
        phase_id: input.phaseId || null, reason: input.reason || null, ...metadata,
      })],
    );
    const recipients = [...new Set((input.recipients || []).filter((id) => UUID_RE.test(id)))];
    if (!recipients.length) recipients.push('');
    for (const recipient of recipients) {
      await manager.query(
        `INSERT INTO "${actor.schema}".delivery_outbox
           (operation_id, correlation_id, topic, aggregate_type, aggregate_id, recipient_user_id, payload)
         VALUES ($1, $2, $3, 'project', $4, $5, $6::jsonb)`,
        [operationId, correlationId, input.eventType, input.projectId, recipient || null, JSON.stringify(metadata)],
      );
      if (recipient) {
        await manager.query(
          `INSERT INTO "${actor.schema}".notifications
             (recipient_user_id, title, body, type, priority, entity_type, entity_id,
              link_url, fingerprint, metadata, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'project', $6, $7, $8, $9::jsonb, $10, now(), now())
           ON CONFLICT DO NOTHING`,
          [
            recipient, this.notificationTitle(input.eventType), input.reason || null, input.eventType,
            ['changes_requested', 'task_due_changed'].includes(input.eventType) ? 'high' : 'medium',
            input.projectId, `/dashboard/progetti/${input.projectId}`,
            `delivery:${operationId}:${input.eventType}:${recipient}`, JSON.stringify(metadata), this.actorId(actor),
          ],
        );
      }
    }
  }

  private notificationTitle(eventType: string) {
    const titles: Record<string, string> = {
      project_member_upserted: 'Assegnazione progetto', task_assigned: 'Attività assegnata',
      task_due_changed: 'Scadenza attività aggiornata', task_dependency_unblocked: 'Dipendenza sbloccata',
      qa_submitted: 'Lavoro inviato in QA', changes_requested: 'Modifiche richieste',
      qa_approved: 'Lavoro approvato', project_published: 'Progetto pubblicato',
      project_delivered: 'Progetto consegnato', project_comment_created: 'Nuovo commento progetto',
    };
    return titles[eventType] || 'Aggiornamento progetto';
  }

  private async recalculateProgress(manager: Queryable, schema: string, projectId: string) {
    const rows = await manager.query(
      `WITH phase_scores AS (
         SELECT m.id, GREATEST(m.weight, 0.001)::numeric AS weight,
                CASE WHEN m.status = 'completed' THEN 1::numeric
                     WHEN COUNT(t.id) = 0 THEN CASE WHEN m.status = 'in_progress' THEN 0.25 ELSE 0 END
                     ELSE COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric / COUNT(t.id)::numeric END AS score
         FROM "${schema}".milestones m
         LEFT JOIN "${schema}".tasks t ON t.milestone_id = m.id AND t.deleted_at IS NULL
         WHERE m.project_id = $1 AND m.deleted_at IS NULL
         GROUP BY m.id
       ), task_score AS (
         SELECT CASE WHEN COUNT(*) = 0 THEN 0
                     ELSE COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric END AS score
         FROM "${schema}".tasks WHERE project_id = $1 AND deleted_at IS NULL
       )
       SELECT CASE WHEN EXISTS (SELECT 1 FROM phase_scores)
              THEN ROUND(100 * SUM(weight * score) / NULLIF(SUM(weight), 0))::int
              ELSE ROUND(100 * (SELECT score FROM task_score))::int END AS progress
       FROM phase_scores`,
      [projectId],
    );
    const statusRows = await manager.query(`SELECT status FROM "${schema}".projects WHERE id = $1`, [projectId]);
    const progress = statusRows[0]?.status === 'delivered' ? 100 : Math.max(0, Math.min(100, Number(rows[0]?.progress || 0)));
    await manager.query(`UPDATE "${schema}".projects SET progress = $2, updated_at = now() WHERE id = $1`, [projectId, progress]);
    return progress;
  }

  private async workspace(queryable: Queryable, actor: CommercialActor, projectId: string) {
    const project = await this.project(queryable, actor, projectId);
    const [members, phases, tasks, qa, timers, publications, checklist, dueDateHistory] = await Promise.all([
      queryable.query(
        `SELECT pm.*, u.full_name, u.email FROM "${actor.schema}".project_members pm
         JOIN "${actor.schema}".users u ON u.id = pm.user_id
         WHERE pm.project_id = $1 AND pm.deleted_at IS NULL ORDER BY pm.created_at`, [projectId]),
      queryable.query(
        `SELECT m.*, COALESCE(array_agg(t.id) FILTER (WHERE t.id IS NOT NULL), '{}') AS task_ids
         FROM "${actor.schema}".milestones m LEFT JOIN "${actor.schema}".tasks t
           ON t.milestone_id = m.id AND t.deleted_at IS NULL
         WHERE m.project_id = $1 AND m.deleted_at IS NULL GROUP BY m.id
         ORDER BY m.sort_order, m.created_at`, [projectId]),
      queryable.query(
        `SELECT t.*, COALESCE(array_agg(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL), '{}') AS collaborator_ids,
                COALESCE(array_agg(DISTINCT td.predecessor_task_id) FILTER (WHERE td.predecessor_task_id IS NOT NULL), '{}') AS dependency_ids
         FROM "${actor.schema}".tasks t
         LEFT JOIN "${actor.schema}".task_assignees ta ON ta.task_id = t.id AND ta.deleted_at IS NULL
         LEFT JOIN "${actor.schema}".task_dependencies td ON td.successor_task_id = t.id AND td.deleted_at IS NULL
         WHERE t.project_id = $1 AND t.deleted_at IS NULL GROUP BY t.id
         ORDER BY t.kanban_order, t.due_at NULLS LAST, t.created_at`, [projectId]),
      queryable.query(
        `SELECT * FROM "${actor.schema}".project_qa_items WHERE project_id = $1 AND deleted_at IS NULL ORDER BY sort_order, created_at`, [projectId]),
      queryable.query(
        `SELECT * FROM "${actor.schema}".delivery_time_sessions WHERE project_id = $1 AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 100`, [projectId]),
      queryable.query(
        `SELECT * FROM "${actor.schema}".project_publications WHERE project_id = $1 ORDER BY publication_version DESC`, [projectId]),
      queryable.query(
        `SELECT i.* FROM "${actor.schema}".task_checklist_items i
         JOIN "${actor.schema}".tasks t ON t.id = i.task_id
         WHERE t.project_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL
         ORDER BY i.task_id, i.sort_order, i.created_at`, [projectId]),
      queryable.query(
        `SELECT h.* FROM "${actor.schema}".task_due_date_history h
         JOIN "${actor.schema}".tasks t ON t.id = h.task_id
         WHERE t.project_id = $1 AND t.deleted_at IS NULL
         ORDER BY h.changed_at`, [projectId]),
    ]);
    const checklistByTask = new Map<string, any[]>();
    for (const item of checklist) checklistByTask.set(item.task_id, [...(checklistByTask.get(item.task_id) || []), item]);
    const dueDateHistoryByTask = new Map<string, any[]>();
    for (const item of dueDateHistory) dueDateHistoryByTask.set(item.task_id, [...(dueDateHistoryByTask.get(item.task_id) || []), item]);
    return {
      project, members, phases,
      tasks: tasks.map((task: any) => ({
        ...task,
        checklist: checklistByTask.get(task.id) || [],
        due_date_history: dueDateHistoryByTask.get(task.id) || [],
      })),
      qa, timers, publications,
    };
  }

  async listProjects(query: Record<string, unknown>) {
    const actor = await this.access.current();
    this.require(actor, 'canViewProjects', 'canViewAssignedProjects');
    await this.prepare(actor);
    const params: unknown[] = [];
    const where = ['p.deleted_at IS NULL'];
    const search = this.text(query.search, 300).toLowerCase();
    if (search) { params.push(`%${search}%`); where.push(`(lower(p.name) LIKE $${params.length} OR lower(COALESCE(p.description, '')) LIKE $${params.length})`); }
    if (query.status) {
      const status = this.text(query.status, 40);
      if (!PROJECT_STATES.has(status)) throw new BadRequestException('Stato progetto non valido');
      params.push(status); where.push(`p.status = $${params.length}`);
    }
    if (!this.canManageAll(actor) && this.access.has(actor, 'canViewAssignedProjects')) {
      params.push(this.actorId(actor));
      where.push(`(p.project_manager_id = $${params.length} OR EXISTS (
        SELECT 1 FROM "${actor.schema}".project_members pm WHERE pm.project_id = p.id AND pm.user_id = $${params.length} AND pm.deleted_at IS NULL
      ) OR EXISTS (SELECT 1 FROM "${actor.schema}".tasks t WHERE t.project_id = p.id AND t.assignee_id = $${params.length} AND t.deleted_at IS NULL))`);
    }
    const rows = await this.dataSource.query(
      `SELECT p.*, c.name AS company_name FROM "${actor.schema}".projects p
       LEFT JOIN "${actor.schema}".companies c ON c.id = p.company_id AND c.deleted_at IS NULL
       WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 500`, params,
    );
    return { items: rows };
  }

  async getWorkspace(projectId: string) {
    const actor = await this.access.current();
    this.require(actor, 'canViewProjects', 'canViewAssignedProjects');
    await this.prepare(actor);
    return this.workspace(this.dataSource.manager, actor, this.uuid(projectId, 'project_id'));
  }

  async createProject(body: Record<string, any>, keyValue: unknown) {
    return this.withOperation('project.create', keyValue, body, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canCreateProject', 'canManageProjects');
      const sourceEventId = this.text(body.source_event_id, 200) || null;
      const orderId = body.order_id ? this.uuid(body.order_id, 'order_id') : null;
      if (sourceEventId || orderId) {
        const existing = await manager.query(
          `SELECT id FROM "${actor.schema}".projects WHERE deleted_at IS NULL
           AND (($1::text IS NOT NULL AND source_event_id = $1) OR ($2::uuid IS NOT NULL AND order_id = $2))
           LIMIT 1 FOR UPDATE`, [sourceEventId, orderId],
        );
        if (existing[0]) return { ...(await this.workspace(manager, actor, existing[0].id)), unchanged: true, correlationId: context.correlationId };
      }
      const projectManager = body.project_manager_id ? this.uuid(body.project_manager_id, 'project_manager_id') : this.actorId(actor);
      if (projectManager) await this.activeUser(manager, actor, projectManager);
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".projects
           (company_id, contact_id, opportunity_id, lead_id, quote_id, order_id, source_event_id,
            name, description, type, status, priority, project_manager_id, start_date, due_date,
            progress, version, created_by, updated_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,1,$16,$16,now(),now())
         RETURNING *`,
        [
          body.company_id || null, body.contact_id || null, body.opportunity_id || null, body.lead_id || null,
          body.quote_id || null, orderId, sourceEventId, this.text(body.name, 500), this.text(body.description) || null,
          this.text(body.type, 100) || 'other', PROJECT_STATES.has(body.status) ? body.status : 'not_started',
          ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium', projectManager,
          body.start_date || null, body.due_date || null, this.actorId(actor),
        ],
      );
      const project = rows[0];
      if (projectManager) {
        await manager.query(
          `INSERT INTO "${actor.schema}".project_members
             (project_id, user_id, role, version, created_by, updated_by, created_at, updated_at)
           VALUES ($1,$2,'project_manager',1,$3,$3,now(),now())
           ON CONFLICT (project_id, user_id) WHERE deleted_at IS NULL DO NOTHING`,
          [project.id, projectManager, this.actorId(actor)],
        );
      }
      for (const [index, label] of REQUIRED_QA.entries()) {
        await manager.query(
          `INSERT INTO "${actor.schema}".project_qa_items
             (project_id, label, required, sort_order, created_by, updated_by)
           VALUES ($1,$2,true,$3,$4,$4)`, [project.id, label, index, this.actorId(actor)],
        );
      }
      const planMembers = Array.isArray(body.members) ? body.members : [];
      const planPhases = Array.isArray(body.phases) ? body.phases : [];
      const planTasks = Array.isArray(body.tasks) ? body.tasks : [];
      const planDependencies = Array.isArray(body.dependencies) ? body.dependencies : [];
      if (planMembers.length > 100 || planPhases.length > 100 || planTasks.length > 1_000 || planDependencies.length > 2_000) {
        throw new BadRequestException('Piano progetto oltre i limiti consentiti');
      }
      for (const member of planMembers) {
        const userId = this.uuid(member.user_id, 'member_user_id');
        const role = this.text(member.role, 40) || 'member';
        if (!PROJECT_MEMBER_ROLES.has(role)) throw new BadRequestException('Ruolo membro progetto non valido');
        if (member.allocation_percent != null && (!Number.isInteger(Number(member.allocation_percent)) || Number(member.allocation_percent) < 1 || Number(member.allocation_percent) > 100)) {
          throw new BadRequestException('Allocazione membro progetto non valida');
        }
        if (role === 'supervisor') await this.assertSupervisor(manager, actor, userId);
        else await this.activeUser(manager, actor, userId);
        await manager.query(
          `INSERT INTO "${actor.schema}".project_members
             (project_id,user_id,role,allocation_percent,capacity_minutes_week,version,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,1,$6,$6,now(),now())
           ON CONFLICT (project_id,user_id) WHERE deleted_at IS NULL DO UPDATE SET
             role = EXCLUDED.role, allocation_percent = EXCLUDED.allocation_percent,
             capacity_minutes_week = EXCLUDED.capacity_minutes_week,
             version = project_members.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [project.id, userId, role, member.allocation_percent || null, member.capacity_minutes_week || null, this.actorId(actor)],
        );
      }
      const phaseByKey = new Map<string, string>();
      for (const [index, phase] of planPhases.entries()) {
        const phaseTitle = this.text(phase.title, 500);
        if (!phaseTitle) throw new BadRequestException('Titolo fase obbligatorio');
        if (phase.responsible_user_id) await this.activeUser(manager, actor, phase.responsible_user_id);
        const phaseKey = this.text(phase.key, 200) || String(index);
        if (phaseByKey.has(phaseKey)) throw new BadRequestException('Chiave fase duplicata');
        const phaseRows = await manager.query(
          `INSERT INTO "${actor.schema}".milestones
             (project_id,title,description,status,sort_order,weight,responsible_user_id,
              planned_start_at,planned_due_at,due_date,version,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$8::timestamptz::date,1,$9,$9,now(),now()) RETURNING *`,
          [project.id, phaseTitle, this.text(phase.description) || null,
            Number.isInteger(phase.sort_order) ? phase.sort_order : index, Number(phase.weight) > 0 ? Number(phase.weight) : 1,
            phase.responsible_user_id || null, phase.planned_start_at || null, phase.planned_due_at || null, this.actorId(actor)],
        );
        phaseByKey.set(phaseKey, phaseRows[0].id);
      }
      const taskByKey = new Map<string, string>();
      for (const [index, task] of planTasks.entries()) {
        const taskTitle = this.text(task.title, 500);
        if (!taskTitle) throw new BadRequestException('Titolo attività obbligatorio');
        const taskKey = this.text(task.key, 200) || String(index);
        if (taskByKey.has(taskKey)) throw new BadRequestException('Chiave attività duplicata');
        const assigneeId = task.assignee_id ? this.uuid(task.assignee_id, 'task_assignee_id') : null;
        if (assigneeId) await this.activeUser(manager, actor, assigneeId);
        const phaseId = task.phase_key ? phaseByKey.get(this.text(task.phase_key, 200)) : null;
        if (task.phase_key && !phaseId) throw new BadRequestException('Riferimento fase del task non valido');
        const taskRows = await manager.query(
          `INSERT INTO "${actor.schema}".tasks
             (project_id,milestone_id,company_id,title,description,status,priority,assignee_id,assigned_by,due_at,
              original_due_at,estimated_minutes,tags,recurrence_rule,version,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13::jsonb,1,$9,$9,now(),now()) RETURNING *`,
          [project.id, phaseId || null, project.company_id, taskTitle, this.text(task.description) || null,
            TASK_STATES.has(task.status) ? task.status : 'backlog', ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
            assigneeId, this.actorId(actor), task.due_at || null, Number(task.estimated_minutes || 0),
            Array.isArray(task.tags) ? task.tags.map(String) : [], task.recurrence_rule ? JSON.stringify(task.recurrence_rule) : null],
        );
        taskByKey.set(taskKey, taskRows[0].id);
        await this.replaceCollaborators(manager, actor, taskRows[0].id, task.collaborator_ids);
        for (const [checkIndex, check] of (Array.isArray(task.checklist) ? task.checklist : []).entries()) {
          const title = typeof check === 'string' ? check : this.text(check?.title, 500);
          if (!title) continue;
          await manager.query(
            `INSERT INTO "${actor.schema}".task_checklist_items
               (task_id,title,is_done,sort_order,required,version,created_at,updated_at)
             VALUES ($1,$2,false,$3,$4,1,now(),now())`,
            [taskRows[0].id, title, checkIndex, typeof check === 'object' ? check.required !== false : true],
          );
        }
      }
      const dependencyKeys = planDependencies.map((dependency: any) => ({
        from: this.text(dependency.predecessor_key, 200),
        to: this.text(dependency.successor_key, 200),
      }));
      if (hasDirectedCycle([...taskByKey.keys()], dependencyKeys)) throw new BadRequestException('Il piano progetto contiene una dipendenza ciclica o non valida');
      for (const dependency of planDependencies) {
        const predecessorId = taskByKey.get(this.text(dependency.predecessor_key, 200));
        const successorId = taskByKey.get(this.text(dependency.successor_key, 200));
        if (!predecessorId || !successorId || predecessorId === successorId) throw new BadRequestException('Dipendenza del piano progetto non valida');
        await manager.query(
          `INSERT INTO "${actor.schema}".task_dependencies
             (project_id,predecessor_task_id,successor_task_id,dependency_type,created_by,updated_by)
           VALUES ($1,$2,$3,'finish_to_start',$4,$4)
           ON CONFLICT (predecessor_task_id,successor_task_id) WHERE deleted_at IS NULL DO NOTHING`,
          [project.id, predecessorId, successorId, this.actorId(actor)],
        );
      }
      await this.recalculateProgress(manager, actor.schema, project.id);
      await this.event(context, { projectId: project.id, eventType: 'project_created', after: project });
      return { ...(await this.workspace(manager, actor, project.id)), unchanged: false, correlationId: context.correlationId };
    });
  }

  async updateProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.update', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canEditProject', 'canManageProjects');
      const current = await this.project(manager, actor, id, true, true);
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      const fields = ['name', 'description', 'type', 'priority', 'company_id', 'contact_id', 'opportunity_id', 'lead_id', 'quote_id', 'order_id', 'project_manager_id', 'start_date', 'due_date'];
      const entries = fields.filter((field) => field in body).map((field) => [field, body[field]] as const);
      if (!entries.length) return { ...(await this.workspace(manager, actor, id)), unchanged: true, correlationId: context.correlationId };
      if ('project_manager_id' in body && body.project_manager_id) await this.activeUser(manager, actor, body.project_manager_id);
      const params = entries.map(([, value]) => value === '' ? null : value);
      const rows = await manager.query(
        `UPDATE "${actor.schema}".projects SET ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')},
           version = version + 1, updated_by = $${params.length + 1}, updated_at = now()
         WHERE id = $${params.length + 2} AND version = $${params.length + 3} AND deleted_at IS NULL RETURNING *`,
        [...params, this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione progetto');
      if (body.project_manager_id) {
        await manager.query(
          `INSERT INTO "${actor.schema}".project_members
             (project_id,user_id,role,version,created_by,updated_by,created_at,updated_at)
           VALUES ($1,$2,'project_manager',1,$3,$3,now(),now())
           ON CONFLICT (project_id,user_id) WHERE deleted_at IS NULL
           DO UPDATE SET role = 'project_manager', deleted_at = NULL, version = project_members.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [id, body.project_manager_id, this.actorId(actor)],
        );
      }
      await this.event(context, { projectId: id, eventType: 'project_updated', before: current, after: rows[0], reason: body.reason || null });
      return { ...(await this.workspace(manager, actor, id)), unchanged: false, correlationId: context.correlationId };
    });
  }

  async transitionProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.transition', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      const current = await this.project(manager, actor, id, true, true);
      this.require(actor, 'canEditProject', 'canManageProjects', 'canReopenProject');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      const next = this.text(body.status, 40);
      if (!PROJECT_STATES.has(next)) throw new BadRequestException('Stato progetto non valido');
      if (next === current.status) return { ...(await this.workspace(manager, actor, id)), unchanged: true, correlationId: context.correlationId };
      if (!(TRANSITIONS[String(current.status)] || []).includes(next)) throw new ConflictException(`Transizione ${current.status} → ${next} non consentita`);
      const reason = this.text(body.reason, 2_000);
      if (['blocked', 'changes_requested', 'suspended', 'cancelled'].includes(next) && !reason) throw new BadRequestException('Motivazione obbligatoria');
      const rows = await manager.query(
        `UPDATE "${actor.schema}".projects SET status = $1,
           suspended_from_status = CASE WHEN $1 = 'suspended' THEN status ELSE suspended_from_status END,
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE id = $3 AND version = $4 AND deleted_at IS NULL RETURNING *`,
        [next, this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione progetto');
      await this.recalculateProgress(manager, actor.schema, id);
      await this.event(context, { projectId: id, eventType: 'project_status_changed', before: { status: current.status }, after: { status: next }, reason });
      return { ...(await this.workspace(manager, actor, id)), unchanged: false, correlationId: context.correlationId };
    });
  }

  async archiveProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.archive', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canArchiveProject', 'canManageArchive');
      const current = await this.project(manager, actor, id, true);
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      const reason = this.text(body.reason, 4_000);
      if (!reason) throw new BadRequestException('Motivazione obbligatoria');
      const rows = await manager.query(
        `UPDATE "${actor.schema}".projects SET deleted_at = now(), archive_reason = $1,
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE id = $3 AND version = $4 AND deleted_at IS NULL RETURNING *`,
        [reason, this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione progetto');
      await this.event(context, { projectId: id, eventType: 'project_archived', before: current, after: rows[0], reason });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async restoreProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.restore', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canArchiveProject', 'canManageArchive');
      const rows = await manager.query(
        `SELECT * FROM "${actor.schema}".projects WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE`,
        [id],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Progetto archiviato non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      const reason = this.text(body.reason, 4_000);
      if (!reason) throw new BadRequestException('Motivazione obbligatoria');
      const restored = await manager.query(
        `UPDATE "${actor.schema}".projects SET deleted_at = NULL, archive_reason = NULL,
           version = version + 1, updated_by = $1, updated_at = now()
         WHERE id = $2 AND version = $3 AND deleted_at IS NOT NULL RETURNING *`,
        [this.actorId(actor), id, version],
      );
      if (!restored[0]) throw new ConflictException('Conflitto di versione progetto');
      await this.event(context, { projectId: id, eventType: 'project_restored', before: current, after: restored[0], reason });
      return { item: restored[0], correlationId: context.correlationId };
    });
  }

  async upsertMember(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.member.upsert', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectMembers', 'canManageProjects');
      await this.project(manager, actor, id, true);
      const userId = this.uuid(body.user_id, 'user_id');
      const role = this.text(body.role, 40);
      if (role === 'supervisor') await this.assertSupervisor(manager, actor, userId);
      else await this.activeUser(manager, actor, userId);
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".project_members
           (project_id,user_id,role,allocation_percent,capacity_minutes_week,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,1,$6,$6,now(),now())
         ON CONFLICT (project_id,user_id) WHERE deleted_at IS NULL DO UPDATE SET
           role = EXCLUDED.role, allocation_percent = EXCLUDED.allocation_percent,
           capacity_minutes_week = EXCLUDED.capacity_minutes_week,
           version = project_members.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING *`,
        [id, userId, role, body.allocation_percent || null, body.capacity_minutes_week || null, this.actorId(actor)],
      );
      await this.event(context, { projectId: id, eventType: 'project_member_upserted', after: rows[0], recipients: [userId] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async updateMember(projectId: string, memberId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(memberId, 'member_id');
    return this.withOperation('project.member.update', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectMembers', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true);
      const currentRows = await manager.query(`SELECT * FROM "${actor.schema}".project_members WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Membro progetto non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione membro');
      if (body.role === 'supervisor') await this.assertSupervisor(manager, actor, current.user_id);
      const fields = ['role', 'allocation_percent', 'capacity_minutes_week'].filter((field) => field in body);
      if (!fields.length) return { item: current, unchanged: true, correlationId: context.correlationId };
      const values = fields.map((field) => body[field]);
      const rows = await manager.query(
        `UPDATE "${actor.schema}".project_members SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')},
           version = version + 1, updated_by = $${values.length + 1}, updated_at = now()
         WHERE id = $${values.length + 2} AND version = $${values.length + 3} RETURNING *`,
        [...values, this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione membro');
      await this.event(context, { projectId: projectIdValue, eventType: 'project_member_updated', before: current, after: rows[0], reason: body.reason || null, recipients: [current.user_id] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async removeMember(projectId: string, memberId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(memberId, 'member_id');
    return this.withOperation('project.member.remove', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectMembers', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true);
      const currentRows = await manager.query(`SELECT * FROM "${actor.schema}".project_members WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Membro progetto non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione membro');
      if (['project_manager', 'supervisor'].includes(current.role)) {
        const responsible = await manager.query(
          `SELECT COUNT(*)::int AS count FROM "${actor.schema}".project_members
           WHERE project_id = $1 AND role IN ('project_manager','supervisor') AND deleted_at IS NULL AND id <> $2`,
          [projectIdValue, id],
        );
        if (Number(responsible[0]?.count || 0) === 0 && !['not_started', 'cancelled'].includes(project.status)) {
          throw new ConflictException('Impossibile rimuovere l’ultimo responsabile del progetto attivo');
        }
      }
      const rows = await manager.query(
        `UPDATE "${actor.schema}".project_members SET deleted_at = now(), version = version + 1,
           updated_by = $1, updated_at = now() WHERE id = $2 AND version = $3 RETURNING *`,
        [this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione membro');
      await this.event(context, { projectId: projectIdValue, eventType: 'project_member_removed', before: current, after: rows[0], reason: body.reason, recipients: [current.user_id] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async createPhase(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.phase.create', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canEditProject', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true);
      if (body.responsible_user_id) await this.activeUser(manager, actor, body.responsible_user_id);
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".milestones
           (project_id,title,description,status,sort_order,weight,responsible_user_id,
            planned_start_at,planned_due_at,due_date,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$8::timestamptz::date,1,$9,$9,now(),now()) RETURNING *`,
        [projectIdValue, this.text(body.title, 500), this.text(body.description) || null, body.sort_order || 0,
          body.weight || 1, body.responsible_user_id || null, body.planned_start_at || null,
          body.planned_due_at || null, this.actorId(actor)],
      );
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, phaseId: rows[0].id, eventType: 'project_phase_created', after: rows[0] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async updatePhase(projectId: string, phaseId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(phaseId, 'phase_id');
    return this.withOperation('project.phase.update', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canEditProject', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true);
      const currentRows = await manager.query(`SELECT * FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Fase non trovata');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione fase');
      if (body.responsible_user_id) await this.activeUser(manager, actor, body.responsible_user_id);
      if (body.status === 'completed') {
        const open = await manager.query(`SELECT COUNT(*)::int AS count FROM "${actor.schema}".tasks WHERE milestone_id = $1 AND deleted_at IS NULL AND status <> 'done'`, [id]);
        if (Number(open[0]?.count || 0) > 0) throw new ConflictException('La fase contiene attività non completate');
      }
      const fields = ['title', 'description', 'status', 'sort_order', 'weight', 'responsible_user_id', 'planned_start_at', 'planned_due_at', 'blocked_reason'].filter((field) => field in body);
      if (!fields.length) return { item: current, unchanged: true, correlationId: context.correlationId };
      const values = fields.map((field) => body[field] === '' ? null : body[field]);
      const extra = body.status === 'completed' ? ', actual_end_at = now(), completed_at = now()' : body.status === 'in_progress' ? ', actual_start_at = COALESCE(actual_start_at, now())' : '';
      const rows = await manager.query(
        `UPDATE "${actor.schema}".milestones SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}${extra},
           version = version + 1, updated_by = $${values.length + 1}, updated_at = now()
         WHERE id = $${values.length + 2} AND version = $${values.length + 3} RETURNING *`,
        [...values, this.actorId(actor), id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione fase');
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, phaseId: id, eventType: 'project_phase_updated', before: current, after: rows[0], reason: body.reason || null });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async reorderPhases(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.phase.reorder', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canEditProject', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true);
      if (Number(project.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione progetto');
      const ids = Array.isArray(body.phase_ids) ? [...new Set(body.phase_ids.map((id: unknown) => this.uuid(id, 'phase_id')))] : [];
      const rows = await manager.query(`SELECT id FROM "${actor.schema}".milestones WHERE project_id = $1 AND deleted_at IS NULL FOR UPDATE`, [projectIdValue]);
      if (ids.length !== rows.length || rows.some((row: any) => !ids.includes(row.id))) throw new BadRequestException('Elenco fasi incompleto');
      for (const [index, id] of ids.entries()) await manager.query(`UPDATE "${actor.schema}".milestones SET sort_order = $1, version = version + 1, updated_by = $2, updated_at = now() WHERE id = $3`, [index, this.actorId(actor), id]);
      await manager.query(`UPDATE "${actor.schema}".projects SET version = version + 1, updated_by = $2, updated_at = now() WHERE id = $1`, [projectIdValue, this.actorId(actor)]);
      await this.event(context, { projectId: projectIdValue, eventType: 'project_phases_reordered', after: { phase_ids: ids } });
      return { ...(await this.workspace(manager, actor, projectIdValue)), correlationId: context.correlationId };
    });
  }

  async deletePhase(projectId: string, phaseId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(phaseId, 'phase_id');
    return this.withOperation('project.phase.delete', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canEditProject', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Fase non trovata');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione fase');
      const linked = await manager.query(`SELECT COUNT(*)::int AS count FROM "${actor.schema}".tasks WHERE milestone_id = $1 AND deleted_at IS NULL`, [id]);
      if (Number(linked[0]?.count || 0) > 0) throw new ConflictException('Scollega le attività prima di archiviare la fase');
      await manager.query(`UPDATE "${actor.schema}".milestones SET deleted_at = now(), version = version + 1, updated_by = $1, updated_at = now() WHERE id = $2`, [this.actorId(actor), id]);
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, phaseId: id, eventType: 'project_phase_archived', before: current, reason: body.reason });
      return { ok: true, correlationId: context.correlationId };
    });
  }

  private async replaceCollaborators(
    manager: Queryable,
    actor: CommercialActor,
    taskId: string,
    collaboratorIds: unknown,
  ) {
    if (!Array.isArray(collaboratorIds)) return;
    const ids = [...new Set(collaboratorIds.map((id) => this.uuid(id, 'collaborator_id')))];
    for (const id of ids) await this.activeUser(manager, actor, id);
    await manager.query(
      `UPDATE "${actor.schema}".task_assignees SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE task_id = $2 AND deleted_at IS NULL AND NOT (user_id = ANY($3::uuid[]))`,
      [this.actorId(actor), taskId, ids],
    );
    for (const id of ids) {
      await manager.query(
        `INSERT INTO "${actor.schema}".task_assignees
           (task_id,user_id,role,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,'collaborator',1,$3,$3,now(),now())
         ON CONFLICT (task_id,user_id) WHERE deleted_at IS NULL DO UPDATE SET
           deleted_at = NULL, version = task_assignees.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [taskId, id, this.actorId(actor)],
      );
    }
  }

  async createTask(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.task.create', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const phaseId = body.phase_id ? this.uuid(body.phase_id, 'phase_id') : null;
      if (phaseId) {
        const phase = await manager.query(`SELECT 1 FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [phaseId, projectIdValue]);
        if (!phase[0]) throw new BadRequestException('Fase non appartenente al progetto');
      }
      const assigneeId = body.assignee_id ? this.uuid(body.assignee_id, 'assignee_id') : null;
      if (assigneeId) await this.activeUser(manager, actor, assigneeId);
      const status = TASK_STATES.has(body.status) ? body.status : 'backlog';
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".tasks
           (project_id,milestone_id,title,description,status,priority,assignee_id,assigned_by,due_at,
            original_due_at,estimated_minutes,tags,recurrence_rule,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11::text[],$12::jsonb,1,$8,$8,now(),now()) RETURNING *`,
        [projectIdValue, phaseId, this.text(body.title, 500), this.text(body.description) || null, status,
          ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium', assigneeId,
          this.actorId(actor), body.due_at || null, body.estimated_minutes ?? null, body.tags || [],
          body.recurrence_rule ? JSON.stringify(body.recurrence_rule) : null],
      );
      await this.replaceCollaborators(manager, actor, rows[0].id, body.collaborator_ids);
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, taskId: rows[0].id, phaseId, eventType: assigneeId ? 'task_assigned' : 'task_created', after: rows[0], recipients: assigneeId ? [assigneeId, ...(body.collaborator_ids || [])] : body.collaborator_ids || [] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async updateTask(projectId: string, taskId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(taskId, 'task_id');
    return this.withOperation('project.task.update', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const currentRows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Attività non trovata');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione attività');
      if (body.phase_id) {
        const phase = await manager.query(`SELECT 1 FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [body.phase_id, projectIdValue]);
        if (!phase[0]) throw new BadRequestException('Fase non appartenente al progetto');
      }
      if (body.assignee_id) await this.activeUser(manager, actor, body.assignee_id);
      const map: Record<string, string> = { phase_id: 'milestone_id' };
      const fields = ['title', 'description', 'phase_id', 'assignee_id', 'priority', 'due_at', 'estimated_minutes', 'blocked_reason', 'kanban_order']
        .filter((field) => field in body);
      if ('due_at' in body && String(current.due_at || '') !== String(body.due_at || '')) {
        const reason = this.text(body.reason, 2_000);
        if (!reason) throw new BadRequestException('Motivazione cambio scadenza obbligatoria');
        await manager.query(
          `INSERT INTO "${actor.schema}".task_due_date_history
             (task_id,previous_due_at,new_due_at,reason,changed_by,correlation_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, current.due_at, body.due_at || null, reason, this.actorId(actor), context.correlationId],
        );
      }
      const values = fields.map((field) => body[field] === '' ? null : body[field]);
      let saved = current;
      if (fields.length) {
        const rows = await manager.query(
          `UPDATE "${actor.schema}".tasks SET ${fields.map((field, index) => `${map[field] || field} = $${index + 1}`).join(', ')},
             version = version + 1, updated_by = $${values.length + 1}, updated_at = now()
           WHERE id = $${values.length + 2} AND version = $${values.length + 3} RETURNING *`,
          [...values, this.actorId(actor), id, version],
        );
        if (!rows[0]) throw new ConflictException('Conflitto di versione attività');
        saved = rows[0];
      }
      await this.replaceCollaborators(manager, actor, id, body.collaborator_ids);
      const eventType = 'due_at' in body && String(current.due_at || '') !== String(body.due_at || '') ? 'task_due_changed' : body.assignee_id && body.assignee_id !== current.assignee_id ? 'task_assigned' : 'task_updated';
      if (fields.length || Array.isArray(body.collaborator_ids)) {
        await this.recalculateProgress(manager, actor.schema, projectIdValue);
        await this.event(context, { projectId: projectIdValue, taskId: id, phaseId: saved.milestone_id, eventType, before: current, after: saved, reason: body.reason || null, recipients: [saved.assignee_id, ...(body.collaborator_ids || [])].filter(Boolean) });
      }
      return { item: saved, unchanged: !fields.length && !Array.isArray(body.collaborator_ids), correlationId: context.correlationId };
    });
  }

  private async completionBlockers(manager: Queryable, schema: string, taskId: string) {
    const [dependencies, checklist] = await Promise.all([
      manager.query(
        `SELECT p.id, p.title FROM "${schema}".task_dependencies d
         JOIN "${schema}".tasks p ON p.id = d.predecessor_task_id AND p.deleted_at IS NULL
         WHERE d.successor_task_id = $1 AND d.deleted_at IS NULL AND p.status <> 'done'`, [taskId]),
      manager.query(
        `SELECT id, title FROM "${schema}".task_checklist_items
         WHERE task_id = $1 AND required = true AND is_done = false AND deleted_at IS NULL`, [taskId]),
    ]);
    return { dependencies, checklist };
  }

  async reorderTasks(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const movedTaskId = this.uuid(body.moved_task_id, 'moved_task_id');
    return this.withOperation('project.task.reorder', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const nextStatus = this.text(body.status, 40);
      if (!TASK_STATES.has(nextStatus)) throw new BadRequestException('Stato attività non valido');
      const items = Array.isArray(body.items) ? body.items.map((item: any, index: number) => ({
        id: this.uuid(item.id, 'task_id'), version: this.version(item.version), order: Number.isInteger(item.order) ? item.order : (index + 1) * 1000,
      })) : [];
      if (!items.length || new Set(items.map((item) => item.id)).size !== items.length || !items.some((item) => item.id === movedTaskId)) {
        throw new BadRequestException('Ordinamento attività non valido');
      }
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL FOR UPDATE`, [projectIdValue, items.map((item) => item.id)]);
      if (rows.length !== items.length) throw new BadRequestException('Attività non appartenente al progetto');
      for (const item of items) {
        const current = rows.find((row: any) => row.id === item.id);
        if (Number(current.version) !== item.version) throw new ConflictException('Conflitto di versione attività');
      }
      const moved = rows.find((row: any) => row.id === movedTaskId);
      if (nextStatus === 'done' && moved.status !== 'done') {
        const blockers = await this.completionBlockers(manager, actor.schema, movedTaskId);
        if (blockers.dependencies.length || blockers.checklist.length) throw new ConflictException({ message: 'Attività bloccata da dipendenze o checklist', blockers });
      }
      const reason = this.text(body.reason, 2_000);
      if (moved.status === 'done' && nextStatus !== 'done' && !reason) throw new BadRequestException('Motivazione riapertura obbligatoria');
      if (nextStatus === 'blocked' && !reason) throw new BadRequestException('Motivazione blocco obbligatoria');
      for (const item of items) {
        if (item.id === movedTaskId) {
          await manager.query(
            `UPDATE "${actor.schema}".tasks SET kanban_order = $1, status = $2,
               completed_at = CASE WHEN $2 = 'done' THEN COALESCE(completed_at, now()) ELSE NULL END,
               reopened_at = CASE WHEN status = 'done' AND $2 <> 'done' THEN now() ELSE reopened_at END,
               reopened_by = CASE WHEN status = 'done' AND $2 <> 'done' THEN $3 ELSE reopened_by END,
               reopen_reason = CASE WHEN status = 'done' AND $2 <> 'done' THEN $4 ELSE reopen_reason END,
               blocked_reason = CASE WHEN $2 = 'blocked' THEN $4 ELSE NULL END,
               version = version + 1, updated_by = $3, updated_at = now() WHERE id = $5 AND version = $6`,
            [item.order, nextStatus, this.actorId(actor), reason || null, item.id, item.version],
          );
        } else {
          await manager.query(`UPDATE "${actor.schema}".tasks SET kanban_order = $1, version = version + 1, updated_by = $2, updated_at = now() WHERE id = $3 AND version = $4`, [item.order, this.actorId(actor), item.id, item.version]);
        }
      }
      const progress = await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, taskId: movedTaskId, phaseId: moved.milestone_id, eventType: moved.status === nextStatus ? 'task_reordered' : nextStatus === 'done' ? 'task_completed' : moved.status === 'done' ? 'task_reopened' : 'task_status_changed', before: { status: moved.status, kanban_order: moved.kanban_order }, after: { status: nextStatus, progress }, reason });
      return { ...(await this.workspace(manager, actor, projectIdValue)), correlationId: context.correlationId };
    });
  }

  async transitionTask(projectId: string, taskId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(taskId, 'task_id');
    return this.withOperation('project.task.transition', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Attività non trovata');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione attività');
      const next = this.text(body.status, 40);
      if (!TASK_STATES.has(next)) throw new BadRequestException('Stato attività non valido');
      if (next === current.status) return { item: current, unchanged: true, correlationId: context.correlationId };
      if (next === 'done') {
        const blockers = await this.completionBlockers(manager, actor.schema, id);
        if (blockers.dependencies.length || blockers.checklist.length) {
          throw new ConflictException({ message: 'Attività bloccata da dipendenze o checklist', blockers });
        }
      }
      const reason = this.text(body.reason, 2_000);
      if (current.status === 'done' && next !== 'done' && !reason) throw new BadRequestException('Motivazione riapertura obbligatoria');
      if (next === 'blocked' && !reason) throw new BadRequestException('Motivazione blocco obbligatoria');
      const updated = await manager.query(
        `UPDATE "${actor.schema}".tasks SET status = $1,
           completed_at = CASE WHEN $1 = 'done' THEN now() ELSE NULL END,
           reopened_at = CASE WHEN status = 'done' AND $1 <> 'done' THEN now() ELSE reopened_at END,
           reopened_by = CASE WHEN status = 'done' AND $1 <> 'done' THEN $2 ELSE reopened_by END,
           reopen_reason = CASE WHEN status = 'done' AND $1 <> 'done' THEN $3 ELSE reopen_reason END,
           blocked_reason = CASE WHEN $1 = 'blocked' THEN $3 ELSE NULL END,
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE id = $4 AND version = $5 RETURNING *`,
        [next, this.actorId(actor), reason || null, id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione attività');
      const progress = await this.recalculateProgress(manager, actor.schema, projectIdValue);
      const eventType = next === 'done' ? 'task_completed' : current.status === 'done' ? 'task_reopened' : 'task_status_changed';
      await this.event(context, { projectId: projectIdValue, taskId: id, phaseId: current.milestone_id, eventType, before: { status: current.status }, after: { status: next, progress }, reason });
      if (next === 'done') {
        const unblocked = await manager.query(
          `SELECT DISTINCT successor.assignee_id, successor.id
           FROM "${actor.schema}".task_dependencies d
           JOIN "${actor.schema}".tasks successor ON successor.id = d.successor_task_id AND successor.deleted_at IS NULL
           WHERE d.predecessor_task_id = $1 AND d.deleted_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM "${actor.schema}".task_dependencies remaining
               JOIN "${actor.schema}".tasks predecessor ON predecessor.id = remaining.predecessor_task_id
               WHERE remaining.successor_task_id = successor.id AND remaining.deleted_at IS NULL AND predecessor.status <> 'done'
             )`, [id],
        );
        for (const row of unblocked.filter((entry: any) => entry.assignee_id)) {
          await manager.query(
            `INSERT INTO "${actor.schema}".notifications
               (recipient_user_id,title,type,priority,entity_type,entity_id,link_url,fingerprint,metadata,created_by,created_at,updated_at)
             VALUES ($1,'Dipendenza sbloccata','task_dependency_unblocked','medium','project',$2,$3,$4,$5::jsonb,$6,now(),now())
             ON CONFLICT DO NOTHING`,
            [row.assignee_id, projectIdValue, `/dashboard/progetti/${projectIdValue}`, `delivery:unblocked:${context.operationId}:${row.id}`, JSON.stringify({ task_id: row.id, correlation_id: context.correlationId }), this.actorId(actor)],
          );
        }
      }
      return { item: updated[0], progress, correlationId: context.correlationId };
    });
  }

  async archiveTask(projectId: string, taskId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(taskId, 'task_id');
    return this.withOperation('project.task.archive', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Attività non trovata');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione attività');
      const activeTimer = await manager.query(`SELECT 1 FROM "${actor.schema}".delivery_time_sessions WHERE task_id = $1 AND status = 'active' AND deleted_at IS NULL`, [id]);
      if (activeTimer[0]) throw new ConflictException('Ferma il timer prima di archiviare l’attività');
      await manager.query(`UPDATE "${actor.schema}".tasks SET deleted_at = now(), archive_reason = $1, version = version + 1, updated_by = $2, updated_at = now() WHERE id = $3`, [body.reason, this.actorId(actor), id]);
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, taskId: id, eventType: 'task_archived', before: current, reason: body.reason });
      return { ok: true, correlationId: context.correlationId };
    });
  }

  async generateTaskRecurrence(projectId: string, taskId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(taskId, 'task_id');
    return this.withOperation('project.task.recurrence', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Attività non trovata');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione attività');
      const rule = current.recurrence_rule && typeof current.recurrence_rule === 'object' ? current.recurrence_rule : null;
      const frequency = this.text(rule?.frequency, 20);
      if (!['daily', 'weekly', 'monthly', 'annual'].includes(frequency)) throw new ConflictException('Ricorrenza non configurata');
      const existing = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE recurrence_origin_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, [id]);
      if (existing[0]) return { item: existing[0], unchanged: true, correlationId: context.correlationId };
      const base = new Date(current.due_at || new Date());
      const interval = Math.max(1, Math.min(365, Number(rule.interval || 1)));
      if (frequency === 'daily') base.setUTCDate(base.getUTCDate() + interval);
      if (frequency === 'weekly') base.setUTCDate(base.getUTCDate() + interval * 7);
      if (frequency === 'monthly') base.setUTCMonth(base.getUTCMonth() + interval);
      if (frequency === 'annual') base.setUTCFullYear(base.getUTCFullYear() + interval);
      const recurrenceKey = `task:${id}:${base.toISOString()}`;
      const inserted = await manager.query(
        `INSERT INTO "${actor.schema}".tasks
           (project_id,milestone_id,company_id,title,description,status,priority,assignee_id,assigned_by,due_at,
            original_due_at,estimated_minutes,tags,recurrence_rule,recurrence_origin_id,recurrence_key,version,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,'backlog',$6,$7,$8,$9,$9,$10,$11,$12::jsonb,$13,$14,1,$8,$8,now(),now())
         ON CONFLICT (recurrence_key) WHERE recurrence_key IS NOT NULL DO UPDATE SET recurrence_key = EXCLUDED.recurrence_key
         RETURNING *`,
        [projectIdValue, current.milestone_id, current.company_id, current.title, current.description, current.priority,
          current.assignee_id, this.actorId(actor), base.toISOString(), current.estimated_minutes, current.tags || [],
          current.recurrence_rule ? JSON.stringify(current.recurrence_rule) : null, id, recurrenceKey],
      );
      const collaborators = await manager.query(`SELECT user_id FROM "${actor.schema}".task_assignees WHERE task_id = $1 AND deleted_at IS NULL`, [id]);
      await this.replaceCollaborators(manager, actor, inserted[0].id, collaborators.map((row: any) => row.user_id));
      await manager.query(`UPDATE "${actor.schema}".tasks SET next_recurrence_id = $1, version = version + 1, updated_by = $2, updated_at = now() WHERE id = $3`, [inserted[0].id, this.actorId(actor), id]);
      await this.event(context, { projectId: projectIdValue, taskId: inserted[0].id, phaseId: current.milestone_id, eventType: 'task_recurrence_generated', before: { source_task_id: id }, after: inserted[0] });
      return { item: inserted[0], unchanged: false, correlationId: context.correlationId };
    });
  }

  async addDependency(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.task.dependency.add', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const predecessor = this.uuid(body.predecessor_task_id, 'predecessor_task_id');
      const successor = this.uuid(body.successor_task_id, 'successor_task_id');
      if (predecessor === successor) throw new BadRequestException('Una attività non può dipendere da se stessa');
      const tasks = await manager.query(`SELECT id, project_id FROM "${actor.schema}".tasks WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL FOR UPDATE`, [[predecessor, successor]]);
      if (tasks.length !== 2) throw new NotFoundException('Attività dipendenza non trovata');
      if (tasks.some((task: any) => task.project_id !== projectIdValue)) throw new BadRequestException('Le dipendenze devono appartenere allo stesso progetto');
      const cycle = await manager.query(
        `WITH RECURSIVE reachable(id) AS (
           SELECT successor_task_id FROM "${actor.schema}".task_dependencies WHERE predecessor_task_id = $1 AND deleted_at IS NULL
           UNION
           SELECT d.successor_task_id FROM "${actor.schema}".task_dependencies d JOIN reachable r ON d.predecessor_task_id = r.id WHERE d.deleted_at IS NULL
         ) SELECT 1 FROM reachable WHERE id = $2 LIMIT 1`,
        [successor, predecessor],
      );
      if (cycle[0]) throw new ConflictException('La dipendenza creerebbe un ciclo');
      const existing = await manager.query(`SELECT * FROM "${actor.schema}".task_dependencies WHERE predecessor_task_id = $1 AND successor_task_id = $2 AND deleted_at IS NULL`, [predecessor, successor]);
      if (existing[0]) return { item: existing[0], unchanged: true, correlationId: context.correlationId };
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".task_dependencies
           (project_id,predecessor_task_id,successor_task_id,dependency_type,version,created_by,updated_by)
         VALUES ($1,$2,$3,'finish_to_start',1,$4,$4) RETURNING *`, [projectIdValue, predecessor, successor, this.actorId(actor)],
      );
      await this.event(context, { projectId: projectIdValue, taskId: successor, eventType: 'task_dependency_added', after: rows[0], metadata: { predecessor_task_id: predecessor } });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async removeDependency(projectId: string, dependencyId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(dependencyId, 'dependency_id');
    return this.withOperation('project.task.dependency.remove', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(
        `SELECT d.* FROM "${actor.schema}".task_dependencies d
         JOIN "${actor.schema}".tasks t ON t.id = d.successor_task_id
         WHERE d.id = $1 AND t.project_id = $2 AND d.deleted_at IS NULL FOR UPDATE`, [id, projectIdValue],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Dipendenza non trovata');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione dipendenza');
      await manager.query(`UPDATE "${actor.schema}".task_dependencies SET deleted_at = now(), version = version + 1 WHERE id = $1`, [id]);
      await this.event(context, { projectId: projectIdValue, taskId: current.successor_task_id, eventType: 'task_dependency_removed', before: current, reason: body.reason });
      return { ok: true, correlationId: context.correlationId };
    });
  }

  async createChecklistItem(projectId: string, taskId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const taskIdValue = this.uuid(taskId, 'task_id');
    return this.withOperation('project.task.checklist.create', keyValue, { projectId: projectIdValue, taskId: taskIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const task = await manager.query(`SELECT 1 FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [taskIdValue, projectIdValue]);
      if (!task[0]) throw new NotFoundException('Attività non trovata');
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".task_checklist_items
           (task_id,title,required,sort_order,is_done,version,created_at,updated_at)
         VALUES ($1,$2,$3,$4,false,1,now(),now()) RETURNING *`,
        [taskIdValue, this.text(body.title, 500), body.required !== false, body.sort_order || 0],
      );
      await this.event(context, { projectId: projectIdValue, taskId: taskIdValue, eventType: 'task_checklist_created', after: rows[0] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async updateChecklistItem(projectId: string, taskId: string, itemId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const taskIdValue = this.uuid(taskId, 'task_id');
    const id = this.uuid(itemId, 'checklist_item_id');
    return this.withOperation('project.task.checklist.update', keyValue, { projectId: projectIdValue, taskId: taskIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(
        `SELECT i.* FROM "${actor.schema}".task_checklist_items i JOIN "${actor.schema}".tasks t ON t.id = i.task_id
         WHERE i.id = $1 AND i.task_id = $2 AND t.project_id = $3 AND i.deleted_at IS NULL FOR UPDATE`, [id, taskIdValue, projectIdValue],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Elemento checklist non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione checklist');
      const fields = ['title', 'required', 'is_done'].filter((field) => field in body);
      if (!fields.length) return { item: current, unchanged: true, correlationId: context.correlationId };
      const values = fields.map((field) => body[field]);
      const completedSql = 'is_done' in body ? `, completed_at = ${body.is_done ? 'now()' : 'NULL'}, completed_by = ${body.is_done ? `$${values.length + 1}` : 'NULL'}` : '';
      const updated = await manager.query(
        `UPDATE "${actor.schema}".task_checklist_items SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}${completedSql},
           version = version + 1, updated_at = now() WHERE id = $${values.length + 2} AND version = $${values.length + 3} RETURNING *`,
        [...values, this.actorId(actor), id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione checklist');
      await this.event(context, { projectId: projectIdValue, taskId: taskIdValue, eventType: 'task_checklist_updated', before: current, after: updated[0] });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async activeTimer() {
    const actor = await this.access.current();
    this.require(actor, 'canTrackProjectTime', 'canManageProjects');
    await this.prepare(actor);
    const rows = await this.dataSource.query(
      `SELECT s.*, p.name AS project_name, t.title AS task_title
       FROM "${actor.schema}".delivery_time_sessions s
       JOIN "${actor.schema}".projects p ON p.id = s.project_id AND p.deleted_at IS NULL
       LEFT JOIN "${actor.schema}".tasks t ON t.id = s.task_id
       WHERE s.user_id = $1 AND s.status = 'active' AND s.deleted_at IS NULL LIMIT 1`,
      [this.actorId(actor)],
    );
    return { item: rows[0] || null, server_now: new Date().toISOString() };
  }

  async startTimer(body: Record<string, any>, keyValue: unknown) {
    return this.withOperation('timer.start', keyValue, body, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canTrackProjectTime', 'canManageProjects');
      const projectId = this.uuid(body.project_id, 'project_id');
      await this.project(manager, actor, projectId, true, true);
      const userId = this.actorId(actor);
      if (!userId) throw new ForbiddenException('Identità timer non valida');
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`delivery-timer:${actor.schema}:${userId}`]);
      const taskId = body.task_id ? this.uuid(body.task_id, 'task_id') : null;
      if (taskId) {
        const tasks = await manager.query(
          `SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`,
          [taskId, projectId],
        );
        if (!tasks[0]) throw new NotFoundException('Attività timer non trovata');
        if (['done'].includes(tasks[0].status)) throw new ConflictException('Timer non consentito su attività completata');
      }
      const active = await manager.query(
        `SELECT * FROM "${actor.schema}".delivery_time_sessions
         WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL FOR UPDATE`, [userId],
      );
      if (active[0]) {
        if (active[0].project_id === projectId && String(active[0].task_id || '') === String(taskId || '')) {
          return { item: active[0], unchanged: true, server_now: new Date().toISOString(), correlationId: context.correlationId };
        }
        throw new ConflictException('Ferma il timer attivo prima di avviarne un altro');
      }
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".delivery_time_sessions
           (project_id,task_id,user_id,status,started_at,version,created_at,updated_at)
         VALUES ($1,$2,$3,'active',now(),1,now(),now()) RETURNING *`, [projectId, taskId, userId],
      );
      await this.event(context, { projectId, taskId, eventType: 'timer_started', after: rows[0], metadata: { user_id: userId } });
      return { item: rows[0], unchanged: false, server_now: new Date().toISOString(), correlationId: context.correlationId };
    });
  }

  async stopTimer(sessionId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(sessionId, 'session_id');
    return this.withOperation('timer.stop', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canTrackProjectTime', 'canManageProjects');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".delivery_time_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Sessione timer non trovata');
      if (current.user_id !== this.actorId(actor) && !this.access.has(actor, 'canViewTeamTime')) throw new ForbiddenException('Timer di un altro utente');
      if (current.status === 'completed') return { item: current, unchanged: true, correlationId: context.correlationId };
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione timer');
      const stopKey = this.key(body.stop_key);
      const updated = await manager.query(
        `UPDATE "${actor.schema}".delivery_time_sessions SET status = 'completed', ended_at = now(),
           duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at))::int),
           description = $1, stop_key = $2, version = version + 1, updated_at = now()
         WHERE id = $3 AND version = $4 AND status = 'active' RETURNING *`,
        [this.text(body.description, 2_000) || null, stopKey, id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione timer');
      if (updated[0].task_id) {
        await manager.query(
          `UPDATE "${actor.schema}".tasks SET actual_minutes = COALESCE(actual_minutes, 0) + CEIL($1::numeric / 60)::int,
             updated_at = now() WHERE id = $2`, [updated[0].duration_seconds, updated[0].task_id],
        );
      }
      await this.event(context, { projectId: current.project_id, taskId: current.task_id, eventType: 'timer_stopped', before: current, after: updated[0], metadata: { duration_seconds: updated[0].duration_seconds } });
      return { item: updated[0], unchanged: false, server_now: new Date().toISOString(), correlationId: context.correlationId };
    });
  }

  async correctTimer(sessionId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(sessionId, 'session_id');
    return this.withOperation('timer.correct', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canViewTeamTime', 'canManageProjects');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".delivery_time_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Sessione timer non trovata');
      if (current.status !== 'completed') throw new ConflictException('Ferma il timer prima di correggerlo');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione timer');
      const startedAt = new Date(body.started_at);
      const endedAt = new Date(body.ended_at);
      if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) {
        throw new BadRequestException('Intervallo timer non valido');
      }
      const reason = this.text(body.reason, 4_000);
      const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
      const updated = await manager.query(
        `UPDATE "${actor.schema}".delivery_time_sessions SET started_at = $1, ended_at = $2,
           duration_seconds = $3, description = COALESCE($4, description), corrected_at = now(),
           corrected_by = $5, correction_reason = $6, version = version + 1, updated_at = now()
         WHERE id = $7 AND version = $8 RETURNING *`,
        [startedAt.toISOString(), endedAt.toISOString(), duration, this.text(body.description, 2_000) || null,
          this.actorId(actor), reason, id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione timer');
      if (current.task_id) {
        const previousMinutes = Math.ceil(Number(current.duration_seconds || 0) / 60);
        const nextMinutes = Math.ceil(duration / 60);
        await manager.query(
          `UPDATE "${actor.schema}".tasks SET actual_minutes = GREATEST(0, COALESCE(actual_minutes, 0) - $1 + $2), updated_at = now() WHERE id = $3`,
          [previousMinutes, nextMinutes, current.task_id],
        );
      }
      await this.event(context, { projectId: current.project_id, taskId: current.task_id, eventType: 'timer_corrected', before: current, after: updated[0], reason });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async archiveTimer(sessionId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(sessionId, 'session_id');
    return this.withOperation('timer.archive', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canViewTeamTime', 'canManageProjects');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".delivery_time_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Sessione timer non trovata');
      if (current.status !== 'completed') throw new ConflictException('Un timer attivo non può essere archiviato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione timer');
      const reason = this.text(body.reason, 4_000);
      const updated = await manager.query(
        `UPDATE "${actor.schema}".delivery_time_sessions SET deleted_at = now(), archive_reason = $1,
           version = version + 1, updated_at = now() WHERE id = $2 AND version = $3 RETURNING *`,
        [reason, id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione timer');
      await this.event(context, { projectId: current.project_id, taskId: current.task_id, eventType: 'timer_archived', before: current, after: updated[0], reason });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async createQaItem(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.qa.item.create', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canSuperviseProject', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true);
      if (body.phase_id) {
        const phase = await manager.query(`SELECT 1 FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [body.phase_id, projectIdValue]);
        if (!phase[0]) throw new BadRequestException('Fase QA non appartenente al progetto');
      }
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".project_qa_items
           (project_id,phase_id,label,required,sort_order,version,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,1,$6,$6) RETURNING *`,
        [projectIdValue, body.phase_id || null, this.text(body.label, 500), body.required !== false, body.sort_order || 0, this.actorId(actor)],
      );
      await this.event(context, { projectId: projectIdValue, phaseId: body.phase_id || null, eventType: 'qa_item_created', after: rows[0] });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async updateQaItem(projectId: string, itemId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const id = this.uuid(itemId, 'qa_item_id');
    return this.withOperation('project.qa.item.update', keyValue, { projectId: projectIdValue, id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canSubmitProjectQa', 'canSuperviseProject', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".project_qa_items WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [id, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Controllo QA non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione QA');
      if (Boolean(current.completed_at) === Boolean(body.completed) && this.text(current.comment) === this.text(body.comment)) {
        return { item: current, unchanged: true, correlationId: context.correlationId };
      }
      const updated = await manager.query(
        `UPDATE "${actor.schema}".project_qa_items SET completed_at = CASE WHEN $1 THEN now() ELSE NULL END,
           completed_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END, comment = $3,
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE id = $4 AND version = $5 RETURNING *`,
        [Boolean(body.completed), this.actorId(actor), this.text(body.comment, 2_000) || null, id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione QA');
      await this.event(context, { projectId: projectIdValue, phaseId: current.phase_id, eventType: 'qa_item_updated', before: current, after: updated[0] });
      return { item: updated[0], unchanged: false, correlationId: context.correlationId };
    });
  }

  async submitQa(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const taskId = this.uuid(body.task_id, 'task_id');
    return this.withOperation('project.qa.submit', keyValue, { projectId: projectIdValue, taskId, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canSubmitProjectQa', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true, true);
      if (Number(project.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione progetto');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [taskId, projectIdValue]);
      const task = rows[0];
      if (!task) throw new NotFoundException('Attività non trovata');
      const actorId = this.actorId(actor);
      const collaborator = await manager.query(`SELECT 1 FROM "${actor.schema}".task_assignees WHERE task_id = $1 AND user_id = $2 AND deleted_at IS NULL`, [taskId, actorId]);
      if (task.assignee_id !== actorId && !collaborator[0] && !this.canManageAll(actor)) throw new ForbiddenException('Solo esecutori assegnati possono inviare il lavoro');
      if (task.status !== 'done') throw new ConflictException('Completa l’attività prima dell’invio QA');
      if (task.work_status === 'submitted') return { item: task, unchanged: true, correlationId: context.correlationId };
      const updated = await manager.query(
        `UPDATE "${actor.schema}".tasks SET work_status = 'submitted', work_version = work_version + 1,
           submitted_at = now(), submitted_by = $1, approved_at = NULL, approved_by = NULL,
           approval_note = NULL, version = version + 1, updated_by = $1, updated_at = now()
         WHERE id = $2 RETURNING *`, [actorId, taskId],
      );
      await manager.query(`UPDATE "${actor.schema}".projects SET status = 'qa_internal', version = version + 1, updated_by = $1, updated_at = now() WHERE id = $2`, [actorId, projectIdValue]);
      const supervisors = await manager.query(`SELECT user_id FROM "${actor.schema}".project_members WHERE project_id = $1 AND role = 'supervisor' AND deleted_at IS NULL`, [projectIdValue]);
      await this.event(context, { projectId: projectIdValue, taskId, eventType: 'qa_submitted', before: task, after: updated[0], recipients: supervisors.map((row: any) => row.user_id) });
      return { item: updated[0], unchanged: false, correlationId: context.correlationId };
    });
  }

  async requestChanges(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.qa.request_changes', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canSuperviseProject', 'canApproveProjectWork', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true);
      if (Number(project.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione progetto');
      const taskId = this.uuid(body.task_id, 'task_id');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [taskId, projectIdValue]);
      const task = rows[0];
      if (!task) throw new NotFoundException('Attività non trovata');
      if (task.work_status === 'changes_requested') return { item: task, unchanged: true, correlationId: context.correlationId };
      if (task.work_status !== 'submitted') throw new ConflictException('Il lavoro non è in attesa di supervisione');
      const note = this.text(body.note, 4_000);
      const updated = await manager.query(
        `UPDATE "${actor.schema}".tasks SET status = 'in_progress', completed_at = NULL,
           work_status = 'changes_requested', changes_requested_at = now(), changes_requested_by = $1,
           changes_request_note = $2, approved_at = NULL, approved_by = NULL, approval_note = NULL,
           version = version + 1, updated_by = $1, updated_at = now() WHERE id = $3 RETURNING *`,
        [this.actorId(actor), note, taskId],
      );
      await manager.query(`UPDATE "${actor.schema}".projects SET status = 'changes_requested', version = version + 1, updated_by = $1, updated_at = now() WHERE id = $2`, [this.actorId(actor), projectIdValue]);
      await this.recalculateProgress(manager, actor.schema, projectIdValue);
      await this.event(context, { projectId: projectIdValue, taskId, eventType: 'changes_requested', before: task, after: updated[0], reason: note, recipients: [task.assignee_id] });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async approveQa(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    return this.withOperation('project.qa.approve', keyValue, { projectId: projectIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canApproveProjectWork', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true);
      if (Number(project.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione progetto');
      const taskId = this.uuid(body.task_id, 'task_id');
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".tasks WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [taskId, projectIdValue]);
      const task = rows[0];
      if (!task) throw new NotFoundException('Attività non trovata');
      if (task.work_status === 'approved') return { item: task, unchanged: true, correlationId: context.correlationId };
      if (task.work_status !== 'submitted') throw new ConflictException('Il lavoro non è in attesa di approvazione');
      const actorId = this.actorId(actor);
      if (task.submitted_by === actorId && !(['owner', 'admin'].includes(actor.role) && this.text(body.override_reason, 4_000))) {
        throw new ForbiddenException('Auto-approvazione non consentita');
      }
      const incomplete = await manager.query(`SELECT id FROM "${actor.schema}".project_qa_items WHERE project_id = $1 AND required = true AND completed_at IS NULL AND deleted_at IS NULL`, [projectIdValue]);
      if (incomplete.length) throw new ConflictException('Checklist QA obbligatoria incompleta');
      const note = this.text(body.note, 4_000);
      const updated = await manager.query(
        `UPDATE "${actor.schema}".tasks SET work_status = 'approved', approved_at = now(), approved_by = $1,
           approval_note = $2, status = 'done', completed_at = COALESCE(completed_at, now()),
           version = version + 1, updated_by = $1, updated_at = now() WHERE id = $3 RETURNING *`,
        [actorId, note, taskId],
      );
      await manager.query(`UPDATE "${actor.schema}".projects SET status = 'internal_review', version = version + 1, updated_by = $1, updated_at = now() WHERE id = $2`, [actorId, projectIdValue]);
      await this.event(context, { projectId: projectIdValue, taskId, eventType: 'qa_approved', before: task, after: updated[0], reason: note, metadata: { override_reason: this.text(body.override_reason, 4_000) || null }, recipients: [task.assignee_id] });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async publishProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.publish', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canPublishProject', 'canPublishClientUpdate', 'canManageProjects');
      const project = await this.project(manager, actor, id, true);
      const version = this.version(body.version);
      if (Number(project.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      if (project.status === 'published' && project.published_at) return { item: project, unchanged: true, correlationId: context.correlationId };
      if (project.status !== 'ready_publish') throw new ConflictException('Il progetto non è pronto alla pubblicazione');
      const incomplete = await manager.query(`SELECT id FROM "${actor.schema}".project_qa_items WHERE project_id = $1 AND required = true AND completed_at IS NULL AND deleted_at IS NULL`, [id]);
      if (incomplete.length) throw new ConflictException('Checklist QA obbligatoria incompleta');
      const pending = await manager.query(`SELECT id FROM "${actor.schema}".tasks WHERE project_id = $1 AND deleted_at IS NULL AND work_status IN ('submitted','changes_requested')`, [id]);
      if (pending.length) throw new ConflictException('Esistono lavori non approvati');
      const publicationRows = await manager.query(`SELECT COALESCE(MAX(publication_version),0)::int + 1 AS version FROM "${actor.schema}".project_publications WHERE project_id = $1`, [id]);
      const publicationVersion = Number(publicationRows[0]?.version || 1);
      await manager.query(
        `INSERT INTO "${actor.schema}".project_publications
           (project_id,publication_version,artifact_url,notes,published_by,correlation_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, publicationVersion, this.text(body.artifact_url, 2_000) || null, this.text(body.notes, 4_000) || null, this.actorId(actor), context.correlationId],
      );
      const updated = await manager.query(
        `UPDATE "${actor.schema}".projects SET status = 'published', published_at = now(), published_by = $1,
           version = version + 1, updated_by = $1, updated_at = now()
         WHERE id = $2 AND version = $3 RETURNING *`, [this.actorId(actor), id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione progetto');
      const recipients = await manager.query(`SELECT user_id FROM "${actor.schema}".project_members WHERE project_id = $1 AND deleted_at IS NULL`, [id]);
      await this.event(context, { projectId: id, eventType: 'project_published', before: project, after: updated[0], metadata: { publication_version: publicationVersion, artifact_url: this.text(body.artifact_url, 2_000) || null }, recipients: recipients.map((row: any) => row.user_id) });
      return { item: updated[0], publication_version: publicationVersion, unchanged: false, correlationId: context.correlationId };
    });
  }

  async deliverProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.deliver', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canDeliverProject', 'canManageProjects');
      const project = await this.project(manager, actor, id, true);
      const version = this.version(body.version);
      if (Number(project.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      if (project.status === 'delivered' && project.delivered_at) return { item: project, unchanged: true, correlationId: context.correlationId };
      if (project.status !== 'published') throw new ConflictException('Pubblica il progetto prima della consegna');
      const [openPhases, openTasks, incompleteQa] = await Promise.all([
        manager.query(`SELECT id FROM "${actor.schema}".milestones WHERE project_id = $1 AND deleted_at IS NULL AND status <> 'completed'`, [id]),
        manager.query(`SELECT id FROM "${actor.schema}".tasks WHERE project_id = $1 AND deleted_at IS NULL AND status <> 'done'`, [id]),
        manager.query(`SELECT id FROM "${actor.schema}".project_qa_items WHERE project_id = $1 AND required = true AND completed_at IS NULL AND deleted_at IS NULL`, [id]),
      ]);
      if (openPhases.length || openTasks.length || incompleteQa.length) throw new ConflictException('Fasi, attività o QA non sono completi');
      const updated = await manager.query(
        `UPDATE "${actor.schema}".projects SET status = 'delivered', progress = 100, delivered_at = now(), delivered_by = $1,
           closed_at = COALESCE(closed_at, now()), version = version + 1, updated_by = $1, updated_at = now()
         WHERE id = $2 AND version = $3 RETURNING *`, [this.actorId(actor), id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione progetto');
      const recipients = await manager.query(`SELECT user_id FROM "${actor.schema}".project_members WHERE project_id = $1 AND deleted_at IS NULL`, [id]);
      await this.event(context, { projectId: id, eventType: 'project_delivered', before: project, after: updated[0], reason: this.text(body.notes, 4_000) || null, recipients: recipients.map((row: any) => row.user_id) });
      return { item: updated[0], unchanged: false, correlationId: context.correlationId };
    });
  }

  async supportProject(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.support', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canDeliverProject', 'canManageProjects');
      const project = await this.project(manager, actor, id, true);
      const version = this.version(body.version);
      if (Number(project.version) !== version) throw new ConflictException('Conflitto di versione progetto');
      if (project.status === 'support') return { item: project, unchanged: true, correlationId: context.correlationId };
      if (project.status !== 'delivered') throw new ConflictException('Il supporto segue la consegna');
      const updated = await manager.query(
        `UPDATE "${actor.schema}".projects SET status = 'support', support_started_at = now(),
           version = version + 1, updated_by = $1, updated_at = now()
         WHERE id = $2 AND version = $3 RETURNING *`, [this.actorId(actor), id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione progetto');
      await this.event(context, { projectId: id, eventType: 'project_support_started', before: project, after: updated[0], reason: body.reason });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async linkCommercialActivity(projectId: string, activityId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const activityIdValue = this.uuid(activityId, 'activity_id');
    return this.withOperation('project.activity.link', keyValue, { projectId: projectIdValue, activityId: activityIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      const project = await this.project(manager, actor, projectIdValue, true, true);
      const phaseId = body.phase_id ? this.uuid(body.phase_id, 'phase_id') : null;
      if (phaseId) {
        const phase = await manager.query(`SELECT 1 FROM "${actor.schema}".milestones WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [phaseId, projectIdValue]);
        if (!phase[0]) throw new BadRequestException('Fase non appartenente al progetto');
      }
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".commercial_activities WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [activityIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Attività globale non trovata');
      if (project.company_id && current.company_id && project.company_id !== current.company_id) throw new BadRequestException('Attività appartenente a un altro cliente');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione attività globale');
      if (current.project_id === projectIdValue && String(current.project_phase_id || '') === String(phaseId || '')) return { item: current, unchanged: true, correlationId: context.correlationId };
      const updated = await manager.query(
        `UPDATE "${actor.schema}".commercial_activities SET project_id = $1, project_phase_id = $2,
           version = version + 1, updated_by = $3, updated_at = now() WHERE id = $4 AND version = $5 RETURNING *`,
        [projectIdValue, phaseId, this.actorId(actor), activityIdValue, body.version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione attività globale');
      await this.event(context, { projectId: projectIdValue, phaseId, eventType: 'commercial_activity_linked', before: current, after: updated[0], metadata: { activity_id: activityIdValue } });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async unlinkCommercialActivity(projectId: string, activityId: string, body: Record<string, any>, keyValue: unknown) {
    const projectIdValue = this.uuid(projectId, 'project_id');
    const activityIdValue = this.uuid(activityId, 'activity_id');
    return this.withOperation('project.activity.unlink', keyValue, { projectId: projectIdValue, activityId: activityIdValue, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canManageProjectTasks', 'canManageProjects');
      await this.project(manager, actor, projectIdValue, true, true);
      const rows = await manager.query(`SELECT * FROM "${actor.schema}".commercial_activities WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE`, [activityIdValue, projectIdValue]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Attività collegata non trovata');
      if (Number(current.version) !== this.version(body.version)) throw new ConflictException('Conflitto di versione attività globale');
      const updated = await manager.query(`UPDATE "${actor.schema}".commercial_activities SET project_id = NULL, project_phase_id = NULL, version = version + 1, updated_by = $1, updated_at = now() WHERE id = $2 AND version = $3 RETURNING *`, [this.actorId(actor), activityIdValue, body.version]);
      if (!updated[0]) throw new ConflictException('Conflitto di versione attività globale');
      await this.event(context, { projectId: projectIdValue, eventType: 'commercial_activity_unlinked', before: current, after: updated[0], reason: body.reason, metadata: { activity_id: activityIdValue } });
      return { item: updated[0], correlationId: context.correlationId };
    });
  }

  async createComment(projectId: string, body: Record<string, any>, keyValue: unknown) {
    const id = this.uuid(projectId, 'project_id');
    return this.withOperation('project.comment.create', keyValue, { id, ...body }, async (context) => {
      const { actor, manager } = context;
      this.require(actor, 'canViewProjects', 'canViewAssignedProjects');
      await this.project(manager, actor, id, true, true);
      const taskId = body.task_id ? this.uuid(body.task_id, 'task_id') : null;
      const phaseId = body.phase_id ? this.uuid(body.phase_id, 'phase_id') : null;
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".project_comments
           (project_id,task_id,milestone_id,body,visibility,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6,now(),now()) RETURNING *`,
        [id, taskId, phaseId, this.text(body.body), body.visibility === 'private' ? 'private' : 'internal', this.actorId(actor)],
      );
      const recipients = await manager.query(`SELECT user_id FROM "${actor.schema}".project_members WHERE project_id = $1 AND user_id <> $2 AND deleted_at IS NULL`, [id, this.actorId(actor)]);
      await this.event(context, { projectId: id, taskId, phaseId, eventType: 'project_comment_created', after: rows[0], recipients: recipients.map((row: any) => row.user_id) });
      return { item: rows[0], correlationId: context.correlationId };
    });
  }

  async history(projectId: string, query: Record<string, unknown>) {
    const actor = await this.access.current();
    this.require(actor, 'canViewProjects', 'canViewAssignedProjects');
    await this.prepare(actor);
    const id = this.uuid(projectId, 'project_id');
    await this.project(this.dataSource.manager, actor, id);
    const limit = Math.max(1, Math.min(200, Number(query.limit || 100)));
    const rows = await this.dataSource.query(
      `SELECT e.*, u.full_name AS actor_name, u.email AS actor_email
       FROM "${actor.schema}".project_workflow_events e
       LEFT JOIN "${actor.schema}".users u ON u.id = e.actor_user_id
       WHERE e.project_id = $1 ORDER BY e.created_at DESC, e.id DESC LIMIT $2`, [id, limit],
    );
    return { items: rows };
  }

  async workload(query: Record<string, unknown>) {
    const actor = await this.access.current();
    this.require(actor, 'canViewGlobalWorkload', 'canManageProjects');
    await this.prepare(actor);
    const from = this.text(query.from, 30) || new Date().toISOString().slice(0, 10);
    const to = this.text(query.to, 30) || new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.dataSource.query(
      `SELECT u.id AS user_id, u.full_name, u.email,
              COALESCE(MAX(pm.capacity_minutes_week), 2400)::int AS capacity_minutes,
              COALESCE(SUM(t.estimated_minutes) FILTER (WHERE t.status <> 'done'), 0)::int AS estimated_open_minutes,
              COALESCE(SUM(t.actual_minutes), 0)::int AS recorded_minutes,
              COUNT(DISTINCT t.id) FILTER (WHERE t.status <> 'done')::int AS open_tasks,
              COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'blocked')::int AS blocked_tasks,
              COUNT(DISTINCT t.id) FILTER (WHERE t.work_status = 'submitted')::int AS qa_waiting,
              COUNT(DISTINCT t.id) FILTER (WHERE t.due_at::date BETWEEN $1::date AND $2::date)::int AS due_tasks
       FROM "${actor.schema}".users u
       LEFT JOIN "${actor.schema}".project_members pm ON pm.user_id = u.id AND pm.deleted_at IS NULL
       LEFT JOIN "${actor.schema}".tasks t ON (t.assignee_id = u.id OR EXISTS (
         SELECT 1 FROM "${actor.schema}".task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = u.id AND ta.deleted_at IS NULL
       )) AND t.deleted_at IS NULL
       WHERE u.is_active = true
       GROUP BY u.id, u.full_name, u.email ORDER BY estimated_open_minutes DESC, u.full_name`, [from, to],
    );
    return { items: rows, from, to };
  }
}
