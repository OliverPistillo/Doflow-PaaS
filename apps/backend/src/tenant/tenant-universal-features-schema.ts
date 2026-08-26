import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';

type Queryable = { query(sql: string, parameters?: unknown[]): Promise<any> };

async function provision(target: Queryable, schemaValue: string) {
  const s = safeSchema(schemaValue, 'ensureTenantUniversalFeatureTables');
  if (s === 'public') throw new Error('Universal tenant tables cannot be provisioned in public');
  await target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  const statements = [
    `CREATE TABLE IF NOT EXISTS "${s}".universal_idempotency (
      scope TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
      actor_user_id UUID NOT NULL, response JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(scope,idempotency_key))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), kind TEXT NOT NULL DEFAULT 'group',
      title TEXT NOT NULL, created_by UUID NOT NULL, optimistic_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_participants (
      conversation_id UUID NOT NULL REFERENCES "${s}".conversations(id), user_id UUID NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), left_at TIMESTAMPTZ,
      last_read_at TIMESTAMPTZ, notification_level TEXT NOT NULL DEFAULT 'all',
      PRIMARY KEY(conversation_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES "${s}".conversations(id),
      parent_message_id UUID REFERENCES "${s}".conversation_messages(id), author_id UUID NOT NULL,
      body TEXT NOT NULL DEFAULT '', attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
      optimistic_version INTEGER NOT NULL DEFAULT 1, edited_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_message_reactions (
      message_id UUID NOT NULL REFERENCES "${s}".conversation_messages(id), user_id UUID NOT NULL,
      emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id,emoji))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_message_mentions (
      message_id UUID NOT NULL REFERENCES "${s}".conversation_messages(id), user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_message_receipts (
      message_id UUID NOT NULL REFERENCES "${s}".conversation_messages(id), user_id UUID NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_message_revisions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), message_id UUID NOT NULL REFERENCES "${s}".conversation_messages(id),
      version INTEGER NOT NULL, body TEXT NOT NULL, attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
      changed_by UUID NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(message_id,version))`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_system_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES "${s}".conversations(id),
      event_type TEXT NOT NULL, actor_user_id UUID, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".conversation_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID, message_id UUID,
      actor_user_id UUID NOT NULL, action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".flowboards (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), owner_user_id UUID NOT NULL, name TEXT NOT NULL,
      description TEXT, status TEXT NOT NULL DEFAULT 'active', nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
      edges JSONB NOT NULL DEFAULT '[]'::jsonb, viewport JSONB NOT NULL DEFAULT '{}'::jsonb,
      optimistic_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), archived_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}".flowboard_collaborators (
      board_id UUID NOT NULL REFERENCES "${s}".flowboards(id), user_id UUID NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(board_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".flowboard_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), board_id UUID NOT NULL REFERENCES "${s}".flowboards(id),
      parent_comment_id UUID REFERENCES "${s}".flowboard_comments(id), author_user_id UUID NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'board', target_id TEXT, body TEXT NOT NULL,
      optimistic_version INTEGER NOT NULL DEFAULT 1, resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}".flowboard_versions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), board_id UUID NOT NULL REFERENCES "${s}".flowboards(id),
      version INTEGER NOT NULL, snapshot JSONB NOT NULL, reason TEXT, created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(board_id,version))`,
    `CREATE TABLE IF NOT EXISTS "${s}".flowboard_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), board_id UUID NOT NULL, actor_user_id UUID NOT NULL,
      action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_policies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      current_version INTEGER NOT NULL DEFAULT 1, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_policy_versions (
      policy_id UUID NOT NULL REFERENCES "${s}".bonus_policies(id), version INTEGER NOT NULL,
      rules JSONB NOT NULL, reason TEXT NOT NULL, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(policy_id,version))`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_periods (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), label TEXT NOT NULL, starts_at DATE NOT NULL, ends_at DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(starts_at,ends_at))`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_wallets (
      user_id UUID PRIMARY KEY, balance NUMERIC(18,4) NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_ledger (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL, period_id UUID REFERENCES "${s}".bonus_periods(id),
      policy_id UUID REFERENCES "${s}".bonus_policies(id), policy_version INTEGER, amount NUMERIC(18,4) NOT NULL,
      entry_type TEXT NOT NULL, source_type TEXT NOT NULL, source_id UUID, reason TEXT NOT NULL,
      operation_key TEXT NOT NULL UNIQUE, actor_user_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL, period_id UUID REFERENCES "${s}".bonus_periods(id),
      points NUMERIC(18,4) NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      decided_by UUID, decided_at TIMESTAMPTZ, decision_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_request_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), request_id UUID NOT NULL REFERENCES "${s}".bonus_requests(id),
      status TEXT NOT NULL, actor_user_id UUID NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_approvals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), request_id UUID NOT NULL REFERENCES "${s}".bonus_requests(id),
      approver_user_id UUID NOT NULL, decision TEXT NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(request_id,approver_user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".bonus_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_user_id UUID NOT NULL, action TEXT NOT NULL,
      target_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".tenant_user_preferences (
      user_id UUID PRIMARY KEY, preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".app_release_reads (
      release_id UUID NOT NULL, user_id UUID NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(release_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".tenant_call_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES "${s}".conversations(id),
      room_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}".tenant_call_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), call_id UUID NOT NULL REFERENCES "${s}".tenant_call_sessions(id),
      actor_user_id UUID NOT NULL, action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".company_intelligence_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), owner_user_id UUID NOT NULL, domain TEXT NOT NULL,
      company_name TEXT, status TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'apollo',
      provider_configured BOOLEAN NOT NULL DEFAULT false, report JSONB, error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ)`,
  ];
  for (const sql of statements) await target.query(sql);
  const indexes = [
    `CREATE INDEX IF NOT EXISTS "idx_${s}_conversation_participants_user" ON "${s}".conversation_participants(user_id,conversation_id) WHERE left_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_conversation_messages_cursor" ON "${s}".conversation_messages(conversation_id,created_at DESC,id DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_flowboards_owner" ON "${s}".flowboards(owner_user_id,updated_at DESC) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_flowboard_comments_board" ON "${s}".flowboard_comments(board_id,created_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_bonus_ledger_user" ON "${s}".bonus_ledger(user_id,created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_bonus_requests_user" ON "${s}".bonus_requests(user_id,created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_intel_owner" ON "${s}".company_intelligence_reports(owner_user_id,created_at DESC) WHERE deleted_at IS NULL`,
  ];
  for (const sql of indexes) await target.query(sql);
}

export function ensureTenantUniversalFeatureTables(target: Queryable, schema: string): Promise<void> {
  const safe = safeSchema(schema, 'ensureTenantUniversalFeatureTables');
  return provisionSchemaOnce(target as object, `tenant-universal:${safe}`, () => provision(target, safe));
}
