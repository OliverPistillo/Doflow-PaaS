import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export async function ensureTenantAuthSupportTables(
  dataSource: DataSource,
  schema: string,
) {
  const safe = safeSchema(schema, 'ensureTenantAuthSupportTables');

  await dataSource.query(
    `ALTER TABLE "${safe}".audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT`,
  );
  await dataSource.query(
    `ALTER TABLE "${safe}".audit_log ADD COLUMN IF NOT EXISTS actor_email TEXT`,
  );
  await dataSource.query(
    `ALTER TABLE "${safe}".audit_log ADD COLUMN IF NOT EXISTS target_email TEXT`,
  );
  await dataSource.query(
    `ALTER TABLE "${safe}".audit_log ADD COLUMN IF NOT EXISTS ip TEXT`,
  );

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".password_reset_tokens (
      id             BIGSERIAL PRIMARY KEY,
      token_hash     TEXT NOT NULL UNIQUE,
      email          TEXT NOT NULL,
      created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at     TIMESTAMP NOT NULL,
      used_at        TIMESTAMP,
      invalidated_at TIMESTAMP
    )
  `);
  await dataSource.query(
    `ALTER TABLE "${safe}".password_reset_tokens ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_password_reset_email" ON "${safe}".password_reset_tokens(lower(email), expires_at DESC)`,
  );
}
