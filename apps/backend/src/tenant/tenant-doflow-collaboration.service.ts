import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { REQUEST } from "@nestjs/core";
import { Queue } from "bullmq";
import { createHash, randomBytes, randomUUID } from "crypto";
import { DataSource, EntityManager } from "typeorm";
import { isDoflowTenant } from "./tenant-context";
import {
  DOFLOW_ROLE_CAPABILITIES,
  ensureDoflowWorkspaceTables,
} from "./tenant-doflow-workspace.service";
import { ensureDoflowCollaborationTables } from "./tenant-doflow-collaboration-schema";
import {
  CreateCollaborationCommentDto,
  DeleteCollaborationCommentDto,
  ResolveCollaborationCommentDto,
  UpdateCollaborationCommentDto,
} from "./tenant-doflow-collaboration.dto";

export const DOFLOW_COLLABORATION_OUTBOX_QUEUE = "doflow-collaboration-outbox";
export const DOFLOW_COLLABORATION_OUTBOX_JOB = "dispatch";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORDS = {
  lead: {
    table: "opportunities",
    capability: "canViewAssignedLeads",
    owner: "assigned_to",
  },
  customer: { table: "companies", capability: "canViewCustomers" },
  project: { table: "projects", capability: "canViewProjects" },
  quote: { table: "quotes", capability: "canViewQuotes", owner: "created_by" },
  contract: { table: "contracts", capability: "canViewContracts" },
  order: {
    table: "orders",
    capability: "canViewOrders",
    owner: "salesperson_id",
  },
  payment: { table: "payments", capability: "canManagePayments" },
  invoice: { table: "invoices", capability: "canViewInvoices" },
  renewal: { table: "renewals", capability: "canViewRenewals" },
  document: { table: "documents", capability: "canViewProjects" },
  builder: {
    table: "site_proposals",
    capability: "canUseBuilder",
    owner: "created_by",
  },
} as const;
const REACTIONS = new Set(["👍", "❤️", "🎉"]);
const ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
type CollaborationUser = {
  id: string;
  email: string;
  role: string;
  schema: string;
};

@Injectable()
export class TenantDoflowCollaborationService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    @Optional()
    @InjectQueue(DOFLOW_COLLABORATION_OUTBOX_QUEUE)
    private readonly outboxQueue?: Queue,
  ) {}

  private user(): CollaborationUser {
    const source = this.request.user || this.request.authUser;
    const schema = String(
      source?.tenantId || source?.tenant_id || this.request.tenantId || "",
    ).toLowerCase();
    const id = String(source?.sub || source?.id || "");
    if (!UUID_RE.test(id) || !isDoflowTenant(schema))
      throw new ForbiddenException(
        "Collaborazione disponibile soltanto nel tenant doflow",
      );
    return {
      id,
      email: String(source.email || ""),
      role: String(source.role || "").toLowerCase(),
      schema,
    };
  }

  private uuid(value: unknown, label: string) {
    const id = String(value || "");
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private async ensure() {
    const user = this.user();
    await ensureDoflowCollaborationTables(this.dataSource, user.schema);
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    return user;
  }

  private async capabilities(user: CollaborationUser) {
    if (["owner", "admin"].includes(user.role)) return new Set<string>(["*"]);
    const [roles, explicit] = await Promise.all([
      this.dataSource.query(
        `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
        [user.id],
      ),
      this.dataSource.query(
        `SELECT capability FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1`,
        [user.id],
      ),
    ]);
    return new Set([
      ...roles.flatMap(
        (row: any) => DOFLOW_ROLE_CAPABILITIES[String(row.role)] || [],
      ),
      ...explicit.map((row: any) => String(row.capability)),
    ]);
  }

  private async isAdministrator(user: CollaborationUser) {
    if (["owner", "admin"].includes(user.role)) return true;
    const rows = await this.dataSource.query(
      `SELECT 1 FROM "${user.schema}".doflow_user_roles WHERE user_id = $1 AND role = 'administrator' LIMIT 1`,
      [user.id],
    );
    return Boolean(rows[0]);
  }

  private async assertRecord(recordTypeValue: unknown, recordIdValue: unknown) {
    const user = await this.ensure();
    const recordType = String(recordTypeValue || "") as
      keyof typeof RECORDS | "activity";
    const recordId = this.uuid(recordIdValue, "recordId");
    const capabilities = await this.capabilities(user);
    if (recordType === "activity") {
      if (!capabilities.has("*") && !capabilities.has("canViewActivities"))
        throw new ForbiddenException("Record non autorizzato");
      const assignedOnly =
        !capabilities.has("*") &&
        capabilities.has("canManageAssignedActivities") &&
        !capabilities.has("canManageProjects");
      const rows = await this.dataSource.query(
        `SELECT id FROM "${user.schema}".tasks t WHERE id = $1 AND deleted_at IS NULL
           ${assignedOnly ? `AND (t.assignee_id = $2 OR EXISTS (SELECT 1 FROM "${user.schema}".project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $2 AND pm.deleted_at IS NULL))` : ""}
         UNION ALL
         SELECT id FROM "${user.schema}".commercial_activities a WHERE id = $1 AND deleted_at IS NULL
           ${assignedOnly ? "AND (a.assigned_to = $2 OR a.created_by = $2)" : ""}
         LIMIT 1`,
        assignedOnly ? [recordId, user.id] : [recordId],
      );
      if (!rows[0]) throw new NotFoundException("Record non trovato");
      return { user, recordType, recordId };
    }
    const config = RECORDS[recordType as keyof typeof RECORDS];
    if (!config) throw new BadRequestException("recordType non valido");
    if (!capabilities.has("*") && !capabilities.has(config.capability))
      throw new ForbiddenException("Record non autorizzato");
    const ownerColumn = "owner" in config ? config.owner : undefined;
    const ownerRestricted =
      !capabilities.has("*") &&
      Boolean(ownerColumn) &&
      ((recordType === "lead" && !capabilities.has("canViewAllLeads")) ||
        (recordType === "order" &&
          capabilities.has("canManageOwnOrders") &&
          !capabilities.has("canViewGlobalCommerceValues")) ||
        (recordType === "quote" &&
          capabilities.has("canManageOwnQuotes") &&
          !capabilities.has("canViewAdministration")) ||
        (recordType === "builder" && !capabilities.has("canManageProjects")));
    const ownerFilter = ownerRestricted ? ` AND ${ownerColumn} = $2` : "";
    const assignedProjectFilter =
      recordType === "project" &&
      !capabilities.has("*") &&
      capabilities.has("canViewAssignedProjects") &&
      !capabilities.has("canManageProjects")
        ? ` AND (project_manager_id = $2 OR EXISTS (
          SELECT 1 FROM "${user.schema}".project_members pm
          WHERE pm.project_id = "${config.table}".id AND pm.user_id = $2 AND pm.deleted_at IS NULL
        ))`
        : "";
    const scopedFilter = ownerFilter || assignedProjectFilter;
    const rows = await this.dataSource.query(
      `SELECT id FROM "${user.schema}"."${config.table}" WHERE id = $1 AND deleted_at IS NULL${scopedFilter} LIMIT 1`,
      scopedFilter ? [recordId, user.id] : [recordId],
    );
    if (!rows[0]) throw new NotFoundException("Record non trovato");
    return { user, recordType, recordId };
  }

  private async audit(
    manager: EntityManager | DataSource,
    user: CollaborationUser,
    action: string,
    target: string,
    metadata: Record<string, unknown> = {},
  ) {
    await manager.query(
      `INSERT INTO "${user.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [user.email || null, user.role, action, target, JSON.stringify(metadata)],
    );
  }

  private async requireCapability(user: CollaborationUser, capability: string) {
    const capabilities = await this.capabilities(user);
    if (!capabilities.has("*") && !capabilities.has(capability))
      throw new ForbiddenException(
        "Operazione di collaborazione non autorizzata",
      );
    return capabilities;
  }

  private requestHash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private returnedRows(result: any): any[] {
    return Array.isArray(result?.[0]) ? result[0] : result;
  }

  private mutationContext(keyValue: unknown, correlationValue: unknown) {
    const key = String(keyValue || "").trim();
    if (key.length < 8 || key.length > 200)
      throw new BadRequestException("Idempotency-Key obbligatoria");
    const correlationId = correlationValue
      ? this.uuid(correlationValue, "x-correlation-id")
      : randomUUID();
    return { key, correlationId, operationId: randomUUID() };
  }

  private async beginIdempotency(
    manager: EntityManager,
    user: CollaborationUser,
    scope: string,
    key: string,
    hash: string,
    operationId: string,
    correlationId: string,
  ) {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${user.schema}:${scope}:${key}`,
    ]);
    const rows = await manager.query(
      `SELECT request_hash, response FROM "${user.schema}".collaboration_idempotency WHERE scope = $1 AND idempotency_key = $2`,
      [scope, key],
    );
    if (rows[0]) {
      if (rows[0].request_hash !== hash)
        throw new ConflictException(
          "Idempotency-Key riutilizzata con un payload differente",
        );
      return rows[0].response || null;
    }
    await manager.query(
      `INSERT INTO "${user.schema}".collaboration_idempotency
        (scope, idempotency_key, request_hash, operation_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [scope, key, hash, operationId, correlationId],
    );
    return null;
  }

  private async completeIdempotency(
    manager: EntityManager,
    user: CollaborationUser,
    scope: string,
    key: string,
    response: unknown,
  ) {
    await manager.query(
      `UPDATE "${user.schema}".collaboration_idempotency SET response = $3::jsonb WHERE scope = $1 AND idempotency_key = $2`,
      [scope, key, JSON.stringify(response)],
    );
  }

  private async history(
    manager: EntityManager,
    user: CollaborationUser,
    comment: any,
    eventType: string,
    operationId: string,
    correlationId: string,
    previousState?: unknown,
    nextState?: unknown,
    reason?: string,
  ) {
    await manager.query(
      `INSERT INTO "${user.schema}".collaboration_history
        (record_type, record_id, comment_id, event_type, actor_id, operation_id, correlation_id, previous_state, next_state, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
       ON CONFLICT (operation_id, event_type, comment_id) DO NOTHING`,
      [
        comment.record_type,
        comment.record_id,
        comment.id,
        eventType,
        user.id,
        operationId,
        correlationId,
        previousState === undefined ? null : JSON.stringify(previousState),
        nextState === undefined ? null : JSON.stringify(nextState),
        reason || null,
      ],
    );
  }

  private async outbox(
    manager: EntityManager,
    user: CollaborationUser,
    comment: any,
    eventType: string,
    operationId: string,
    correlationId: string,
    recipientUserId?: string,
    extra: Record<string, unknown> = {},
  ) {
    const dedupeKey = `${operationId}:${eventType}:${recipientUserId || "actor"}`;
    const rows = await manager.query(
      `INSERT INTO "${user.schema}".collaboration_outbox
        (event_type, recipient_user_id, aggregate_type, aggregate_id, operation_id, correlation_id, dedupe_key, payload)
       VALUES ($1, $2, 'comment', $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (dedupe_key) DO UPDATE SET dedupe_key = excluded.dedupe_key
       RETURNING id`,
      [
        eventType,
        recipientUserId || user.id,
        comment.id,
        operationId,
        correlationId,
        dedupeKey,
        JSON.stringify({
          type: eventType,
          operationId,
          correlationId,
          recordType: comment.record_type,
          recordId: comment.record_id,
          commentId: comment.id,
          ...extra,
        }),
      ],
    );
    return String(rows[0].id);
  }

  private async dispatch(schema: string, outboxIds: string[]) {
    if (!this.outboxQueue) return;
    await Promise.all(
      outboxIds.map((outboxId) =>
        this.outboxQueue!.add(
          DOFLOW_COLLABORATION_OUTBOX_JOB,
          { schema, outboxId },
          {
            jobId: outboxId,
            attempts: 5,
            backoff: { type: "exponential", delay: 500 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        ).catch(() => undefined),
      ),
    );
  }

  private deepLink(recordType: string, recordId: string, commentId: string) {
    const route: Record<string, string> = {
      lead: `/dashboard/commercial/leads/${recordId}`,
      customer: `/dashboard/clienti/${recordId}?tab=timeline`,
      activity: `/dashboard/attivita?activityId=${recordId}`,
      project: `/dashboard/progetti/${recordId}?tab=timeline`,
      quote: "/dashboard/preventivi",
      contract: "/dashboard/contratti",
      order: `/dashboard/ordini/${recordId}`,
      payment: "/dashboard/pagamenti",
      invoice: "/dashboard/fatture",
      renewal: "/dashboard/rinnovi",
      document: "/dashboard/documenti",
      builder: `/commercial/site-proposals/${recordId}`,
    };
    const base = route[recordType] || "/dashboard";
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}collaboration=${recordType}:${recordId}&commentId=${commentId}`;
  }

  private async recipientCanAccess(
    manager: EntityManager,
    user: CollaborationUser,
    recipientId: string,
    recordType: string,
    recordId: string,
  ) {
    const users = await manager.query(
      `SELECT id, role FROM "${user.schema}".users WHERE id = $1 AND is_active = true LIMIT 1`,
      [recipientId],
    );
    if (!users[0]) return false;
    const role = String(users[0].role || "").toLowerCase();
    if (["owner", "admin", "superadmin"].includes(role)) return true;
    const [roles, explicit] = await Promise.all([
      manager.query(
        `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
        [recipientId],
      ),
      manager.query(
        `SELECT capability FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1`,
        [recipientId],
      ),
    ]);
    const capabilities = new Set<string>([
      ...roles.flatMap(
        (row: any) => DOFLOW_ROLE_CAPABILITIES[String(row.role)] || [],
      ),
      ...explicit.map((row: any) => String(row.capability)),
    ]);
    if (!capabilities.has("canReadComments")) return false;
    if (recordType === "activity") return capabilities.has("canViewActivities");
    const config = RECORDS[recordType as keyof typeof RECORDS];
    if (!config || !capabilities.has(config.capability)) return false;
    if (recordType === "lead" && !capabilities.has("canViewAllLeads")) {
      const rows = await manager.query(
        `SELECT 1 FROM "${user.schema}".opportunities WHERE id = $1 AND assigned_to = $2 AND deleted_at IS NULL`,
        [recordId, recipientId],
      );
      return Boolean(rows[0]);
    }
    if (
      recordType === "project" &&
      capabilities.has("canViewAssignedProjects") &&
      !capabilities.has("canManageProjects")
    ) {
      const rows = await manager.query(
        `SELECT 1 FROM "${user.schema}".projects p WHERE p.id = $1 AND p.deleted_at IS NULL
         AND (p.project_manager_id = $2 OR EXISTS (SELECT 1 FROM "${user.schema}".project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2 AND pm.deleted_at IS NULL))`,
        [recordId, recipientId],
      );
      return Boolean(rows[0]);
    }
    return true;
  }

  private async createNotification(
    manager: EntityManager,
    user: CollaborationUser,
    comment: any,
    recipientId: string,
    type: "comment_mention" | "comment_reply",
    operationId: string,
    correlationId: string,
  ) {
    if (
      recipientId === user.id ||
      !(await this.recipientCanAccess(
        manager,
        user,
        recipientId,
        comment.record_type,
        comment.record_id,
      ))
    )
      return null;
    const fingerprint = `${type}:${comment.id}:${recipientId}`;
    const rows = await manager.query(
      `INSERT INTO "${user.schema}".notifications
        (recipient_user_id, title, body, type, priority, entity_type, entity_id, link_url, fingerprint,
         created_by, comment_id, operation_id, correlation_id)
       VALUES ($1, $2, $3, $4, 'medium', $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING RETURNING id`,
      [
        recipientId,
        type === "comment_mention"
          ? "Menzione in un commento"
          : "Nuova risposta al commento",
        type === "comment_mention"
          ? "Sei stato menzionato in una conversazione."
          : "Qualcuno ha risposto alla tua conversazione.",
        type,
        comment.record_type,
        comment.record_id,
        this.deepLink(comment.record_type, comment.record_id, comment.id),
        fingerprint,
        user.id,
        comment.id,
        operationId,
        correlationId,
      ],
    );
    if (rows[0]) return String(rows[0].id);
    const existing = await manager.query(
      `SELECT id FROM "${user.schema}".notifications WHERE fingerprint = $1 AND deleted_at IS NULL LIMIT 1`,
      [fingerprint],
    );
    return existing[0] ? String(existing[0].id) : null;
  }

  private async hydrateComments(
    user: CollaborationUser,
    where = "",
    params: unknown[] = [],
  ) {
    const comments = await this.dataSource.query(
      `SELECT * FROM "${user.schema}".record_comments ${where} ORDER BY created_at ASC LIMIT 1000`,
      params,
    );
    const ids = comments.map((comment: any) => comment.id);
    if (!ids.length) return [];
    const [mentions, attachments, reactions] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${user.schema}".record_comment_mentions WHERE comment_id = ANY($1::uuid[])`,
        [ids],
      ),
      this.dataSource.query(
        `SELECT id, comment_id, name, mime_type, size, document_id, checksum, created_at FROM "${user.schema}".record_comment_attachments WHERE comment_id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY created_at`,
        [ids],
      ),
      this.dataSource.query(
        `SELECT * FROM "${user.schema}".record_comment_reactions WHERE comment_id = ANY($1::uuid[]) ORDER BY created_at`,
        [ids],
      ),
    ]);
    return comments.map((comment: any) => ({
      ...comment,
      body: comment.deleted_at ? null : comment.body,
      is_deleted: Boolean(comment.deleted_at),
      mention_user_ids: mentions
        .filter((row: any) => row.comment_id === comment.id)
        .map((row: any) => row.user_id),
      attachments: attachments.filter(
        (row: any) => row.comment_id === comment.id,
      ),
      reactions: Object.values(
        reactions
          .filter((row: any) => row.comment_id === comment.id)
          .reduce((result: Record<string, any>, row: any) => {
            result[row.emoji] ||= { emoji: row.emoji, user_ids: [] };
            result[row.emoji].user_ids.push(row.user_id);
            return result;
          }, {}),
      ),
    }));
  }

  async listComments(query: Record<string, unknown>) {
    const user = await this.ensure();
    await this.requireCapability(user, "canReadComments");
    if (!query.recordType || !query.recordId) {
      await this.requireCapability(user, "canReadAdministrativeAudit");
      return { items: await this.hydrateComments(user) };
    }
    const record = await this.assertRecord(query.recordType, query.recordId);
    return {
      items: await this.hydrateComments(
        user,
        "WHERE record_type = $1 AND record_id = $2",
        [record.recordType, record.recordId],
      ),
    };
  }

  async listRecordAudit(query: Record<string, unknown>) {
    const record = await this.assertRecord(query.recordType, query.recordId);
    await this.requireCapability(record.user, "canReadHistory");
    const rows = await this.dataSource.query(
      `SELECT id, actor_email, actor_role, action, target, metadata, created_at FROM "${record.user.schema}".audit_log
       WHERE target = $1 OR metadata->>'recordId' = $1 OR metadata->>'record_id' = $1 ORDER BY created_at DESC, id DESC LIMIT 500`,
      [record.recordId],
    );
    return { items: rows };
  }

  async listCommentHistory(idValue: string) {
    const user = await this.ensure();
    await this.requireCapability(user, "canReadHistory");
    const id = this.uuid(idValue, "id");
    const comments = await this.dataSource.query(
      `SELECT * FROM "${user.schema}".record_comments WHERE id = $1`,
      [id],
    );
    if (!comments[0]) throw new NotFoundException("Commento non trovato");
    await this.assertRecord(comments[0].record_type, comments[0].record_id);
    const items = await this.dataSource.query(
      `SELECT id, event_type, actor_id, operation_id, correlation_id, previous_state, next_state, reason, created_at
       FROM "${user.schema}".collaboration_history WHERE comment_id = $1 ORDER BY created_at ASC, id ASC`,
      [id],
    );
    return { items };
  }

  private async replaceMentionsAndAttachments(
    manager: EntityManager,
    user: CollaborationUser,
    comment: any,
    body: Record<string, any>,
    creating = false,
    operationId?: string,
    correlationId?: string,
  ) {
    const outboxIds: string[] = [];
    if (body.mentionUserIds !== undefined) {
      await this.requireCapability(user, "canMentionUsers");
      const ids = [
        ...new Set(
          (Array.isArray(body.mentionUserIds) ? body.mentionUserIds : []).map(
            (value: unknown) => this.uuid(value, "mentionUserId"),
          ),
        ),
      ];
      if (ids.length) {
        await manager.query(
          `DELETE FROM "${user.schema}".record_comment_mentions WHERE comment_id = $1 AND NOT (user_id = ANY($2::uuid[]))`,
          [comment.id, ids],
        );
      } else {
        await manager.query(
          `DELETE FROM "${user.schema}".record_comment_mentions WHERE comment_id = $1`,
          [comment.id],
        );
      }
      for (const mentioned of ids) {
        const existingMention = await manager.query(
          `SELECT 1 FROM "${user.schema}".record_comment_mentions WHERE comment_id = $1 AND user_id = $2`,
          [comment.id, mentioned],
        );
        if (existingMention[0]) continue;
        if (
          !(await this.recipientCanAccess(
            manager,
            user,
            mentioned,
            comment.record_type,
            comment.record_id,
          ))
        )
          throw new BadRequestException(
            "La persona menzionata non può accedere al record",
          );
        const notificationId = await this.createNotification(
          manager,
          user,
          comment,
          mentioned,
          "comment_mention",
          operationId!,
          correlationId!,
        );
        await manager.query(
          `INSERT INTO "${user.schema}".record_comment_mentions (comment_id, user_id, notification_id) VALUES ($1, $2, $3)`,
          [comment.id, mentioned, notificationId],
        );
        if (notificationId)
          outboxIds.push(
            await this.outbox(
              manager,
              user,
              comment,
              "notification.created",
              operationId!,
              correlationId!,
              mentioned,
              { notificationId },
            ),
          );
      }
    }
    if (creating && body.attachments !== undefined) {
      await this.requireCapability(user, "canAttachCommentFiles");
      for (const attachment of Array.isArray(body.attachments)
        ? body.attachments
        : []) {
        const reference = String(attachment.reference || "").trim();
        const documentId = reference.startsWith("document:")
          ? this.uuid(
              reference.slice("document:".length),
              "attachment.documentId",
            )
          : null;
        if (!documentId) throw new BadRequestException("Allegato non valido");
        const documents = await manager.query(
          `SELECT id, original_filename, mime_type, size_bytes, storage_key, checksum, entity_type, entity_id FROM "${user.schema}".documents
           WHERE id = $1 AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
          [documentId],
        );
        const document = documents[0];
        const size = Number(document?.size_bytes || 0);
        const mime = String(document?.mime_type || "").toLowerCase();
        if (
          !document ||
          size <= 0 ||
          size > 5_000_000 ||
          !ATTACHMENT_MIME_TYPES.has(mime)
        )
          throw new BadRequestException("Allegato non valido");
        if (
          document.entity_id &&
          String(document.entity_id) !== String(comment.record_id)
        )
          throw new ForbiddenException(
            "Allegato appartenente a un record diverso",
          );
        await manager.query(
          `INSERT INTO "${user.schema}".record_comment_attachments
            (comment_id, name, mime_type, size, storage_reference, document_id, storage_key, checksum, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            comment.id,
            String(document.original_filename || "Allegato"),
            mime,
            size,
            reference,
            documentId,
            document.storage_key,
            document.checksum || null,
            user.id,
          ],
        );
      }
    }
    return outboxIds;
  }

  async createComment(
    body: CreateCollaborationCommentDto,
    idempotencyKey?: string,
    correlationValue?: string,
  ) {
    const record = await this.assertRecord(body.recordType, body.recordId);
    await this.requireCapability(
      record.user,
      body.parentCommentId ? "canReplyComments" : "canCreateComments",
    );
    const text = String(body.text || "").trim();
    if (!text) throw new BadRequestException("Commento non valido");
    const parent = body.parentCommentId
      ? this.uuid(body.parentCommentId, "parentCommentId")
      : null;
    const context = this.mutationContext(idempotencyKey, correlationValue);
    const scope = `comment:create:${record.recordType}:${record.recordId}`;
    const hash = this.requestHash(body);
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.beginIdempotency(
        manager,
        record.user,
        scope,
        context.key,
        hash,
        context.operationId,
        context.correlationId,
      );
      if (replay) return replay;
      let parentComment: any = null;
      if (parent) {
        const parents = await manager.query(
          `SELECT * FROM "${record.user.schema}".record_comments WHERE id = $1 AND record_type = $2 AND record_id = $3 AND deleted_at IS NULL FOR UPDATE`,
          [parent, record.recordType, record.recordId],
        );
        if (!parents[0])
          throw new BadRequestException("Risposta non coerente con il record");
        parentComment = parents[0];
      }
      const rows = await manager.query(
        `INSERT INTO "${record.user.schema}".record_comments
          (record_type, record_id, parent_comment_id, author_id, body, operation_id, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          record.recordType,
          record.recordId,
          parent,
          record.user.id,
          text,
          context.operationId,
          context.correlationId,
        ],
      );
      const comment = rows[0];
      const outboxIds = await this.replaceMentionsAndAttachments(
        manager,
        record.user,
        comment,
        body,
        true,
        context.operationId,
        context.correlationId,
      );
      if (
        parentComment?.author_id &&
        parentComment.author_id !== record.user.id &&
        !(body.mentionUserIds || []).includes(parentComment.author_id)
      ) {
        const notificationId = await this.createNotification(
          manager,
          record.user,
          comment,
          parentComment.author_id,
          "comment_reply",
          context.operationId,
          context.correlationId,
        );
        if (notificationId)
          outboxIds.push(
            await this.outbox(
              manager,
              record.user,
              comment,
              "notification.created",
              context.operationId,
              context.correlationId,
              parentComment.author_id,
              { notificationId },
            ),
          );
      }
      await this.history(
        manager,
        record.user,
        comment,
        parent ? "comment_replied" : "comment_created",
        context.operationId,
        context.correlationId,
        undefined,
        { body: text, mentions: body.mentionUserIds || [] },
      );
      await this.audit(
        manager,
        record.user,
        parent
          ? "collaboration_comment_replied"
          : "collaboration_comment_created",
        comment.id,
        {
          recordType: record.recordType,
          recordId: record.recordId,
          operationId: context.operationId,
          correlationId: context.correlationId,
        },
      );
      const response = { commentId: comment.id, outboxIds, replayed: false };
      await this.completeIdempotency(
        manager,
        record.user,
        scope,
        context.key,
        response,
      );
      return response;
    });
    await this.dispatch(record.user.schema, result.outboxIds || []);
    const hydrated = (
      await this.hydrateComments(record.user, "WHERE id = $1", [
        result.commentId,
      ])
    )[0];
    return { ...hydrated, replayed: Boolean(result.replayed) };
  }

  async updateComment(
    idValue: string,
    body: UpdateCollaborationCommentDto,
    idempotencyKey?: string,
    correlationValue?: string,
  ) {
    const user = await this.ensure();
    const id = this.uuid(idValue, "id");
    const rows = await this.dataSource.query(
      `SELECT * FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    const comment = rows[0];
    if (!comment) throw new NotFoundException("Commento non trovato");
    await this.assertRecord(comment.record_type, comment.record_id);
    const administrator = await this.isAdministrator(user);
    const caps = await this.capabilities(user);
    if (
      comment.author_id !== user.id &&
      !administrator &&
      !caps.has("canModerateComments")
    )
      throw new ForbiddenException("Commento non modificabile");
    if (comment.author_id === user.id)
      await this.requireCapability(user, "canEditOwnComments");
    const text = String(body.text || "").trim();
    if (!text) throw new BadRequestException("Commento non valido");
    const context = this.mutationContext(idempotencyKey, correlationValue);
    const scope = `comment:update:${id}`;
    const hash = this.requestHash(body);
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.beginIdempotency(
        manager,
        user,
        scope,
        context.key,
        hash,
        context.operationId,
        context.correlationId,
      );
      if (replay) return replay;
      const locked = (
        await manager.query(
          `SELECT * FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        )
      )[0];
      if (!locked) throw new NotFoundException("Commento non trovato");
      if (Number(locked.optimistic_version) !== body.expectedVersion)
        throw new ConflictException(
          "Il commento è stato modificato da un altro utente",
        );
      let mentionsUnchanged = body.mentionUserIds === undefined;
      if (body.mentionUserIds !== undefined) {
        const currentMentions = await manager.query(
          `SELECT user_id FROM "${user.schema}".record_comment_mentions WHERE comment_id = $1 ORDER BY user_id`,
          [id],
        );
        const currentIds: string[] = currentMentions.map((row: any) =>
          String(row.user_id),
        );
        const requestedIds: string[] = [
          ...new Set(body.mentionUserIds.map((mentionId) => String(mentionId))),
        ].sort();
        mentionsUnchanged =
          currentIds.length === requestedIds.length &&
          currentIds.every(
            (mentionId, index) => mentionId === requestedIds[index],
          );
      }
      if (String(locked.body) === text && mentionsUnchanged) {
        const response = { commentId: id, outboxIds: [] };
        await this.completeIdempotency(
          manager,
          user,
          scope,
          context.key,
          response,
        );
        return response;
      }
      const updated = this.returnedRows(
        await manager.query(
          `UPDATE "${user.schema}".record_comments SET body = $2, optimistic_version = optimistic_version + 1,
         edited_at = now(), updated_at = now(), operation_id = $3, correlation_id = $4 WHERE id = $1 RETURNING *`,
          [id, text, context.operationId, context.correlationId],
        ),
      )[0];
      const outboxIds = await this.replaceMentionsAndAttachments(
        manager,
        user,
        updated,
        body,
        false,
        context.operationId,
        context.correlationId,
      );
      await this.history(
        manager,
        user,
        updated,
        "comment_edited",
        context.operationId,
        context.correlationId,
        { body: locked.body, version: locked.optimistic_version },
        { body: text, version: updated.optimistic_version },
      );
      await this.audit(manager, user, "collaboration_comment_updated", id, {
        recordType: updated.record_type,
        recordId: updated.record_id,
        operationId: context.operationId,
        correlationId: context.correlationId,
      });
      const response = { commentId: id, outboxIds };
      await this.completeIdempotency(
        manager,
        user,
        scope,
        context.key,
        response,
      );
      return response;
    });
    await this.dispatch(user.schema, result.outboxIds || []);
    return (await this.hydrateComments(user, "WHERE id = $1", [id]))[0];
  }

  async deleteComment(
    idValue: string,
    body: DeleteCollaborationCommentDto,
    idempotencyKey?: string,
    correlationValue?: string,
  ) {
    const user = await this.ensure();
    const id = this.uuid(idValue, "id");
    const rows = await this.dataSource.query(
      `SELECT * FROM "${user.schema}".record_comments WHERE id = $1`,
      [id],
    );
    const comment = rows[0];
    if (!comment) throw new NotFoundException("Commento non trovato");
    await this.assertRecord(comment.record_type, comment.record_id);
    const capabilities = await this.capabilities(user);
    if (
      comment.author_id !== user.id &&
      !capabilities.has("*") &&
      !capabilities.has("canModerateComments")
    )
      throw new ForbiddenException("Commento non eliminabile");
    if (comment.author_id === user.id)
      await this.requireCapability(user, "canEditOwnComments");
    const context = this.mutationContext(idempotencyKey, correlationValue);
    const scope = `comment:delete:${id}`;
    const hash = this.requestHash(body);
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.beginIdempotency(
        manager,
        user,
        scope,
        context.key,
        hash,
        context.operationId,
        context.correlationId,
      );
      if (replay) return replay;
      const locked = (
        await manager.query(
          `SELECT * FROM "${user.schema}".record_comments WHERE id = $1 FOR UPDATE`,
          [id],
        )
      )[0];
      if (locked.deleted_at) {
        const response = { commentId: id, outboxIds: [] };
        await this.completeIdempotency(
          manager,
          user,
          scope,
          context.key,
          response,
        );
        return response;
      }
      if (Number(locked.optimistic_version) !== body.expectedVersion)
        throw new ConflictException(
          "Il commento è stato modificato da un altro utente",
        );
      const updated = this.returnedRows(
        await manager.query(
          `UPDATE "${user.schema}".record_comments SET body = '', deleted_at = now(), deleted_by = $2,
         delete_reason = $3, optimistic_version = optimistic_version + 1, updated_at = now(), operation_id = $4, correlation_id = $5
         WHERE id = $1 RETURNING *`,
          [
            id,
            user.id,
            body.reason || null,
            context.operationId,
            context.correlationId,
          ],
        ),
      )[0];
      await this.history(
        manager,
        user,
        updated,
        "comment_deleted",
        context.operationId,
        context.correlationId,
        { body: locked.body, version: locked.optimistic_version },
        { deleted: true, version: updated.optimistic_version },
        body.reason,
      );
      await this.audit(manager, user, "collaboration_comment_deleted", id, {
        recordType: updated.record_type,
        recordId: updated.record_id,
        operationId: context.operationId,
        correlationId: context.correlationId,
      });
      const outboxIds = [
        await this.outbox(
          manager,
          user,
          updated,
          "collaboration.comment_deleted",
          context.operationId,
          context.correlationId,
        ),
      ];
      const response = { commentId: id, outboxIds };
      await this.completeIdempotency(
        manager,
        user,
        scope,
        context.key,
        response,
      );
      return response;
    });
    await this.dispatch(user.schema, result.outboxIds || []);
    return (await this.hydrateComments(user, "WHERE id = $1", [id]))[0];
  }

  async resolveComment(
    idValue: string,
    body: ResolveCollaborationCommentDto,
    idempotencyKey?: string,
    correlationValue?: string,
  ) {
    const user = await this.ensure();
    await this.requireCapability(user, "canResolveThreads");
    const id = this.uuid(idValue, "id");
    const current = (
      await this.dataSource.query(
        `SELECT record_type, record_id FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      )
    )[0];
    if (!current) throw new NotFoundException("Commento non trovato");
    await this.assertRecord(current.record_type, current.record_id);
    const context = this.mutationContext(idempotencyKey, correlationValue);
    const scope = `comment:resolve:${id}`;
    const hash = this.requestHash(body);
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.beginIdempotency(
        manager,
        user,
        scope,
        context.key,
        hash,
        context.operationId,
        context.correlationId,
      );
      if (replay) return replay;
      const locked = (
        await manager.query(
          `SELECT * FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        )
      )[0];
      if (!locked) throw new NotFoundException("Commento non trovato");
      if (Number(locked.optimistic_version) !== body.expectedVersion)
        throw new ConflictException(
          "Il commento è stato modificato da un altro utente",
        );
      if (Boolean(locked.resolved_at) === body.resolved) {
        const response = { commentId: id, outboxIds: [] };
        await this.completeIdempotency(
          manager,
          user,
          scope,
          context.key,
          response,
        );
        return response;
      }
      const updated = this.returnedRows(
        await manager.query(
          `UPDATE "${user.schema}".record_comments SET resolved_at = $2, resolved_by = $3,
         optimistic_version = optimistic_version + 1, updated_at = now(), operation_id = $4, correlation_id = $5
         WHERE id = $1 RETURNING *`,
          [
            id,
            body.resolved ? new Date().toISOString() : null,
            body.resolved ? user.id : null,
            context.operationId,
            context.correlationId,
          ],
        ),
      )[0];
      const eventType = body.resolved ? "comment_resolved" : "comment_reopened";
      await this.history(
        manager,
        user,
        updated,
        eventType,
        context.operationId,
        context.correlationId,
        { resolved_at: locked.resolved_at, version: locked.optimistic_version },
        {
          resolved_at: updated.resolved_at,
          version: updated.optimistic_version,
        },
      );
      await this.audit(manager, user, `collaboration_${eventType}`, id, {
        recordType: updated.record_type,
        recordId: updated.record_id,
        operationId: context.operationId,
        correlationId: context.correlationId,
      });
      const outboxIds = [
        await this.outbox(
          manager,
          user,
          updated,
          `collaboration.${eventType}`,
          context.operationId,
          context.correlationId,
        ),
      ];
      const response = { commentId: id, outboxIds };
      await this.completeIdempotency(
        manager,
        user,
        scope,
        context.key,
        response,
      );
      return response;
    });
    await this.dispatch(user.schema, result.outboxIds || []);
    return (await this.hydrateComments(user, "WHERE id = $1", [id]))[0];
  }

  async toggleReaction(
    idValue: string,
    emojiValue: unknown,
    idempotencyKey?: string,
    correlationValue?: string,
  ) {
    const user = await this.ensure();
    await this.requireCapability(user, "canReactComments");
    const id = this.uuid(idValue, "id");
    const emoji = String(emojiValue || "").trim();
    if (!REACTIONS.has(emoji))
      throw new BadRequestException("Reazione non valida");
    const current = (
      await this.dataSource.query(
        `SELECT record_type, record_id FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      )
    )[0];
    if (!current) throw new NotFoundException("Commento non trovato");
    await this.assertRecord(current.record_type, current.record_id);
    const context = this.mutationContext(idempotencyKey, correlationValue);
    const scope = `comment:reaction:${id}:${user.id}:${emoji}`;
    const hash = this.requestHash({ emoji });
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.beginIdempotency(
        manager,
        user,
        scope,
        context.key,
        hash,
        context.operationId,
        context.correlationId,
      );
      if (replay) return replay;
      const comment = (
        await manager.query(
          `SELECT * FROM "${user.schema}".record_comments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        )
      )[0];
      if (!comment) throw new NotFoundException("Commento non trovato");
      const existing = this.returnedRows(
        await manager.query(
          `DELETE FROM "${user.schema}".record_comment_reactions WHERE comment_id = $1 AND emoji = $2 AND user_id = $3 RETURNING comment_id`,
          [id, emoji, user.id],
        ),
      );
      const added = !existing[0];
      if (added)
        await manager.query(
          `INSERT INTO "${user.schema}".record_comment_reactions (comment_id, emoji, user_id) VALUES ($1, $2, $3)`,
          [id, emoji, user.id],
        );
      await this.history(
        manager,
        user,
        comment,
        added ? "reaction_added" : "reaction_removed",
        context.operationId,
        context.correlationId,
        undefined,
        { emoji },
      );
      await this.audit(
        manager,
        user,
        added
          ? "collaboration_reaction_added"
          : "collaboration_reaction_removed",
        id,
        {
          recordType: comment.record_type,
          recordId: comment.record_id,
          emoji,
          operationId: context.operationId,
          correlationId: context.correlationId,
        },
      );
      const outboxIds = [
        await this.outbox(
          manager,
          user,
          comment,
          added
            ? "collaboration.reaction_added"
            : "collaboration.reaction_removed",
          context.operationId,
          context.correlationId,
        ),
      ];
      const response = { commentId: id, outboxIds, added };
      await this.completeIdempotency(
        manager,
        user,
        scope,
        context.key,
        response,
      );
      return response;
    });
    await this.dispatch(user.schema, result.outboxIds || []);
    return (await this.hydrateComments(user, "WHERE id = $1", [id]))[0];
  }

  async createAttachmentAccess(idValue: string) {
    const user = await this.ensure();
    await this.requireCapability(user, "canReadComments");
    const id = this.uuid(idValue, "attachmentId");
    const attachments = await this.dataSource.query(
      `SELECT a.id, a.document_id, c.record_type, c.record_id FROM "${user.schema}".record_comment_attachments a
       JOIN "${user.schema}".record_comments c ON c.id = a.comment_id
       WHERE a.id = $1 AND a.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    const attachment = attachments[0];
    if (!attachment) throw new NotFoundException("Allegato non trovato");
    await this.assertRecord(attachment.record_type, attachment.record_id);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.dataSource.query(
      `INSERT INTO "${user.schema}".collaboration_attachment_tokens (token_hash, attachment_id, requested_by, expires_at)
       VALUES ($1, $2, $3, now() + interval '5 minutes')`,
      [tokenHash, id, user.id],
    );
    return {
      url: `/api/tenant/doflow/collaboration/attachments/access/${token}`,
      expiresInSeconds: 300,
    };
  }

  async resolveAttachmentAccess(tokenValue: string) {
    const user = await this.ensure();
    const token = String(tokenValue || "");
    if (token.length < 32 || token.length > 100)
      throw new NotFoundException("Link allegato non valido");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const rows = this.returnedRows(
      await this.dataSource.query(
        `DELETE FROM "${user.schema}".collaboration_attachment_tokens t
       USING "${user.schema}".record_comment_attachments a, "${user.schema}".record_comments c
       WHERE t.token_hash = $1 AND t.requested_by = $2 AND t.expires_at > now()
         AND a.id = t.attachment_id AND c.id = a.comment_id
       RETURNING a.document_id, c.record_type, c.record_id`,
        [tokenHash, user.id],
      ),
    );
    if (!rows[0])
      throw new NotFoundException("Link allegato scaduto o non valido");
    await this.assertRecord(rows[0].record_type, rows[0].record_id);
    return { documentId: String(rows[0].document_id) };
  }
}
