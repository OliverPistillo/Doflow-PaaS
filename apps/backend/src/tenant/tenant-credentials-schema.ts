import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export async function ensureTenantCredentialsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantCredentialsTables');
  await ds.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      provider TEXT NULL,
      account_label TEXT NULL,
      login_url TEXT NULL,
      domain_name TEXT NULL,
      environment TEXT NOT NULL DEFAULT 'production',
      status TEXT NOT NULL DEFAULT 'active',
      access_scope TEXT NOT NULL DEFAULT 'restricted',
      owner_user_id UUID NULL,
      expires_at TIMESTAMPTZ NULL,
      renewal_at TIMESTAMPTZ NULL,
      rotation_due_at TIMESTAMPTZ NULL,
      last_rotated_at TIMESTAMPTZ NULL,
      auto_renew BOOLEAN NOT NULL DEFAULT false,
      description TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by UUID NULL,
      updated_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ NULL
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_secrets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NOT NULL REFERENCES "${s}".credential_items(id) ON DELETE CASCADE,
      encrypted_payload TEXT NOT NULL,
      payload_iv TEXT NOT NULL,
      payload_auth_tag TEXT NOT NULL,
      encrypted_dek TEXT NOT NULL,
      dek_iv TEXT NOT NULL,
      dek_auth_tag TEXT NOT NULL,
      key_version TEXT NOT NULL,
      payload_version INTEGER NOT NULL DEFAULT 1,
      secret_version INTEGER NOT NULL DEFAULT 1,
      created_by UUID NULL,
      updated_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NOT NULL REFERENCES "${s}".credential_items(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      can_view_metadata BOOLEAN NOT NULL DEFAULT true,
      can_reveal_secret BOOLEAN NOT NULL DEFAULT false,
      can_edit BOOLEAN NOT NULL DEFAULT false,
      can_manage_permissions BOOLEAN NOT NULL DEFAULT false,
      granted_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ NULL
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NOT NULL REFERENCES "${s}".credential_items(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      relation TEXT NOT NULL DEFAULT 'related_to',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ NULL
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NULL REFERENCES "${s}".credential_items(id) ON DELETE SET NULL,
      actor_user_id UUID NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'success',
      reason TEXT NULL,
      request_id TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_rotation_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NOT NULL REFERENCES "${s}".credential_items(id) ON DELETE CASCADE,
      previous_secret_version INTEGER NULL,
      new_secret_version INTEGER NOT NULL,
      rotated_by UUID NULL,
      reason TEXT NULL,
      rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      next_rotation_due_at TIMESTAMPTZ NULL
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".credential_alert_dedupe (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credential_item_id UUID NOT NULL REFERENCES "${s}".credential_items(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL,
      threshold_key TEXT NOT NULL,
      recipient_user_id UUID NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_kind" ON "${s}".credential_items(kind)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_status" ON "${s}".credential_items(status)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_env" ON "${s}".credential_items(environment)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_owner" ON "${s}".credential_items(owner_user_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_dates" ON "${s}".credential_items(expires_at, renewal_at, rotation_due_at)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_items_deleted" ON "${s}".credential_items(deleted_at)`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_credential_secrets_item" ON "${s}".credential_secrets(credential_item_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_permissions_user" ON "${s}".credential_permissions(user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_credential_permissions_unique" ON "${s}".credential_permissions(credential_item_id, user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_links_entity" ON "${s}".credential_links(entity_type, entity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_credential_links_unique" ON "${s}".credential_links(credential_item_id, entity_type, entity_id, relation) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_audit_item" ON "${s}".credential_audit_log(credential_item_id, created_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_audit_actor" ON "${s}".credential_audit_log(actor_user_id, created_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_credential_rotation_item" ON "${s}".credential_rotation_history(credential_item_id, rotated_at DESC)`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_credential_alert_dedupe_unique" ON "${s}".credential_alert_dedupe(credential_item_id, alert_type, threshold_key, recipient_user_id)`);
}
