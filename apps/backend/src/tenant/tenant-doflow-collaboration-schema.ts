import { DataSource } from "typeorm";
import { safeSchema } from "../common/schema.utils";
import { isDoflowTenant } from "./tenant-context";
import { ensureTenantNotificationsTables } from "./tenant-notifications-schema";

export async function ensureDoflowCollaborationTables(
  dataSource: DataSource,
  schema: string,
) {
  const safe = safeSchema(schema, "ensureDoflowCollaborationTables");
  if (!isDoflowTenant(safe)) throw new Error("Collaboration is doflow-only");
  await ensureTenantNotificationsTables(dataSource, safe);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".record_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      record_type TEXT NOT NULL,
      record_id UUID NOT NULL,
      parent_comment_id UUID REFERENCES "${safe}".record_comments(id) ON DELETE SET NULL,
      author_id UUID NOT NULL,
      body TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'internal',
      optimistic_version INTEGER NOT NULL DEFAULT 1,
      edited_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolved_by UUID,
      deleted_by UUID,
      delete_reason TEXT,
      operation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
      correlation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
      legacy_source_type TEXT,
      legacy_source_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  for (const column of [
    "visibility TEXT NOT NULL DEFAULT 'internal'",
    "optimistic_version INTEGER NOT NULL DEFAULT 1",
    "edited_at TIMESTAMPTZ",
    "deleted_by UUID",
    "delete_reason TEXT",
    "operation_id UUID DEFAULT uuid_generate_v4()",
    "correlation_id UUID DEFAULT uuid_generate_v4()",
    "legacy_source_type TEXT",
    "legacy_source_id UUID",
  ])
    await dataSource.query(
      `ALTER TABLE "${safe}".record_comments ADD COLUMN IF NOT EXISTS ${column}`,
    );
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".record_comment_mentions (
      comment_id UUID NOT NULL REFERENCES "${safe}".record_comments(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      notification_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, user_id)
    )
  `);
  await dataSource.query(
    `ALTER TABLE "${safe}".record_comment_mentions ADD COLUMN IF NOT EXISTS notification_id UUID`,
  );
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".record_comment_attachments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      comment_id UUID NOT NULL REFERENCES "${safe}".record_comments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size BIGINT NOT NULL,
      storage_reference TEXT NOT NULL,
      document_id UUID,
      storage_key TEXT,
      checksum TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  for (const column of [
    "document_id UUID",
    "storage_key TEXT",
    "checksum TEXT",
    "created_by UUID",
    "deleted_at TIMESTAMPTZ",
  ]) {
    await dataSource.query(
      `ALTER TABLE "${safe}".record_comment_attachments ADD COLUMN IF NOT EXISTS ${column}`,
    );
  }
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".record_comment_reactions (
      comment_id UUID NOT NULL REFERENCES "${safe}".record_comments(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, emoji, user_id)
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".collaboration_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      record_type TEXT NOT NULL,
      record_id UUID NOT NULL,
      comment_id UUID,
      event_type TEXT NOT NULL,
      actor_id UUID NOT NULL,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      previous_state JSONB,
      next_state JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(operation_id, event_type, comment_id)
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".collaboration_idempotency (
      scope TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      response JSONB,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(scope, idempotency_key)
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".collaboration_outbox (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      event_type TEXT NOT NULL,
      recipient_user_id UUID,
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".collaboration_attachment_tokens (
      token_hash TEXT PRIMARY KEY,
      attachment_id UUID NOT NULL REFERENCES "${safe}".record_comment_attachments(id),
      requested_by UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  for (const column of [
    "comment_id UUID",
    "operation_id UUID",
    "correlation_id UUID",
  ]) {
    await dataSource.query(
      `ALTER TABLE "${safe}".notifications ADD COLUMN IF NOT EXISTS ${column}`,
    );
  }

  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_comments_record" ON "${safe}".record_comments(record_type, record_id, created_at) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_comments_parent" ON "${safe}".record_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL`,
  );
  await dataSource.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_comments_legacy" ON "${safe}".record_comments(legacy_source_type, legacy_source_id) WHERE legacy_source_id IS NOT NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_collaboration_history_record" ON "${safe}".collaboration_history(record_type, record_id, created_at DESC)`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_collaboration_outbox_pending" ON "${safe}".collaboration_outbox(available_at, created_at) WHERE processed_at IS NULL`,
  );
}
