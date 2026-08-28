import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';

type Queryable = { query(sql: string, parameters?: unknown[]): Promise<any> };

async function tableExists(target: Queryable, schema: string, table: string) {
  const rows = await target.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p')
     ) AS exists`,
    [schema, table],
  );
  return rows[0]?.exists === true;
}

async function provision(target: Queryable, schemaValue: string) {
  const schema = safeSchema(schemaValue, 'ensureTenantCustomerInboxMailTables');
  if (schema === 'public') throw new Error('Customer Inbox mail tables cannot be provisioned in public');
  await target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await target.query(`CREATE TABLE IF NOT EXISTS "${schema}".customer_inbox_mailbox_state (
    mailbox_key TEXT PRIMARY KEY,
    uid_validity TEXT,
    last_uid BIGINT NOT NULL DEFAULT 0,
    last_successful_sync_at TIMESTAMPTZ,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await target.query(`CREATE TABLE IF NOT EXISTS "${schema}".customer_inbox_unmatched_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mailbox_key TEXT NOT NULL,
    uid_validity TEXT NOT NULL,
    mailbox_uid BIGINT NOT NULL,
    message_id TEXT,
    from_email TEXT NOT NULL,
    recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    subject TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    body TEXT NOT NULL,
    match_status TEXT NOT NULL CHECK (match_status IN ('unmatched', 'ambiguous')),
    candidate_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    UNIQUE(mailbox_key, uid_validity, mailbox_uid)
  )`);
  await target.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_inbox_unmatched_message_id
    ON "${schema}".customer_inbox_unmatched_messages(message_id)
    WHERE message_id IS NOT NULL`);

  if (await tableExists(target, schema, 'commercial_communications')) {
    await target.query(`ALTER TABLE "${schema}".commercial_communications ADD COLUMN IF NOT EXISTS external_message_id TEXT`);
    await target.query(`ALTER TABLE "${schema}".commercial_communications ADD COLUMN IF NOT EXISTS mailbox_uid_validity TEXT`);
    await target.query(`ALTER TABLE "${schema}".commercial_communications ADD COLUMN IF NOT EXISTS mailbox_uid BIGINT`);
    await target.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_communications_external_message
      ON "${schema}".commercial_communications(external_message_id)
      WHERE external_message_id IS NOT NULL AND deleted_at IS NULL`);
    await target.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_communications_mailbox_uid
      ON "${schema}".commercial_communications(mailbox_uid_validity, mailbox_uid)
      WHERE mailbox_uid_validity IS NOT NULL AND mailbox_uid IS NOT NULL AND channel = 'Email' AND direction = 'incoming' AND deleted_at IS NULL`);
  }
}

export function ensureTenantCustomerInboxMailTables(target: Queryable, schema: string): Promise<void> {
  const safe = safeSchema(schema, 'ensureTenantCustomerInboxMailTables');
  return provisionSchemaOnce(target as never, `tenant-customer-inbox-mail:${safe}`, () => provision(target, safe));
}
