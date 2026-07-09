import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantCrmCoreTables } from '../tenant/tenant-crm-schema';
import {
  ensureTenantBriefingQuoteTables,
  seedDoflowBriefingQuoteTemplates,
} from '../tenant/tenant-briefing-quotes-schema';
import { ensureTenantProjectsTables } from '../tenant/tenant-projects-schema';
import { ensureTenantFinanceTables } from '../tenant/tenant-finance-schema';
import {
  ensureTenantNotificationsTables,
  seedTenantNotificationRules,
} from '../tenant/tenant-notifications-schema';

const TENANT_SLUG = 'doflow';
const TENANT_SCHEMA = 'doflow';
const TENANT_NAME = 'doflow';
const PLAN_TIER = 'ENTERPRISE';
const CEO_EMAILS = ['oliver@doflow.it', 'daniele@doflow.it'];

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', '.env'), override: false });

type ErrorLike = Error & {
  code?: string;
  syscall?: string;
  address?: string;
  port?: number;
  detail?: string;
  hint?: string;
  table?: string;
  column?: string;
  constraint?: string;
  schema?: string;
  cause?: unknown;
  errors?: unknown[];
};

const SENSITIVE_ENV_KEYS = [
  'DATABASE_URL',
  'DOFLOW_CEO_PASSWORD',
  'JWT_SECRET',
  'REDIS_PASSWORD',
  'SMTP_PASS',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'S3_SECRET_ACCESS_KEY',
  'AWS_SECRET_ACCESS_KEY',
] as const;

function sanitizeForLog(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value ?? '');

  for (const key of SENSITIVE_ENV_KEYS) {
    const secret = process.env[key];
    if (secret) {
      text = text.split(secret).join(`[redacted:${key}]`);
    }
  }

  text = text.replace(/(postgres(?:ql)?:\/\/)([^:\s/@]+):([^@\s]+)@/gi, '$1$2:[redacted]@');
  text = text.replace(/(password|passwd|pwd|token|secret)=([^&\s]+)/gi, '$1=[redacted]');

  return text;
}

function getSafeDatabaseInfo(): { present: boolean; host?: string; database?: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { present: false };

  try {
    const url = new URL(raw);
    const database = url.pathname.replace(/^\//, '') || undefined;
    return {
      present: true,
      host: url.hostname || undefined,
      database,
    };
  } catch {
    return { present: true, host: 'unparseable', database: 'unparseable' };
  }
}

function logStartupDiagnostics() {
  const db = getSafeDatabaseInfo();
  console.log('[seed:doflow] Startup diagnostics:');
  console.log(`[seed:doflow]   NODE_ENV=${process.env.NODE_ENV || '(unset)'}`);
  console.log(`[seed:doflow]   DATABASE_URL present=${db.present ? 'yes' : 'no'}`);
  if (db.present) {
    console.log(`[seed:doflow]   DATABASE_URL host=${db.host || '(unknown)'}`);
    console.log(`[seed:doflow]   DATABASE_URL database=${db.database || '(unknown)'}`);
  }
  console.log(`[seed:doflow]   DOFLOW_CEO_PASSWORD present=${process.env.DOFLOW_CEO_PASSWORD ? 'yes' : 'no'}`);
  console.log('[seed:doflow]   dotenv override=false');
  console.log(`[seed:doflow]   tenant target=${TENANT_SLUG}`);
}

function logErrorDetails(err: unknown, label = '[seed:doflow] Failed') {
  const error = err as ErrorLike;
  const name = error?.name || typeof err;
  const message = error?.message ? sanitizeForLog(error.message) : sanitizeForLog(err);

  console.error(`${label}:`);
  console.error(`[seed:doflow]   name=${sanitizeForLog(name)}`);
  console.error(`[seed:doflow]   message=${message || '(empty)'}`);

  if (error?.code) console.error(`[seed:doflow]   code=${sanitizeForLog(error.code)}`);
  if (error?.syscall) console.error(`[seed:doflow]   syscall=${sanitizeForLog(error.syscall)}`);
  if (error?.address) console.error(`[seed:doflow]   address=${sanitizeForLog(error.address)}`);
  if (error?.port) console.error(`[seed:doflow]   port=${sanitizeForLog(error.port)}`);

  const pgFields: Array<keyof ErrorLike> = [
    'detail',
    'hint',
    'table',
    'column',
    'constraint',
    'schema',
  ];

  for (const field of pgFields) {
    const fieldValue = error?.[field];
    if (fieldValue) {
      console.error(`[seed:doflow]   postgres.${field}=${sanitizeForLog(fieldValue)}`);
    }
  }

  if (error?.cause) {
    const cause = error.cause as ErrorLike;
    console.error('[seed:doflow]   cause:');
    console.error(`[seed:doflow]     name=${sanitizeForLog(cause?.name || typeof error.cause)}`);
    console.error(`[seed:doflow]     message=${sanitizeForLog(cause?.message || error.cause) || '(empty)'}`);
    if (cause?.code) console.error(`[seed:doflow]     code=${sanitizeForLog(cause.code)}`);
  }

  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    console.error('[seed:doflow]   aggregate errors:');
    error.errors.forEach((nested, index) => {
      const nestedError = nested as ErrorLike;
      console.error(`[seed:doflow]     [${index}] name=${sanitizeForLog(nestedError?.name || typeof nested)}`);
      console.error(`[seed:doflow]     [${index}] message=${sanitizeForLog(nestedError?.message || nested) || '(empty)'}`);
      if (nestedError?.code) console.error(`[seed:doflow]     [${index}] code=${sanitizeForLog(nestedError.code)}`);
      if (nestedError?.syscall) console.error(`[seed:doflow]     [${index}] syscall=${sanitizeForLog(nestedError.syscall)}`);
      if (nestedError?.address) console.error(`[seed:doflow]     [${index}] address=${sanitizeForLog(nestedError.address)}`);
      if (nestedError?.port) console.error(`[seed:doflow]     [${index}] port=${sanitizeForLog(nestedError.port)}`);
    });
  }

  if (error?.stack) {
    console.error('[seed:doflow]   stack:');
    console.error(sanitizeForLog(error.stack));
  }
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to seed the doflow tenant.');
  }
  return url;
}

function getInitialPassword(): string {
  const configured = process.env.DOFLOW_CEO_PASSWORD;
  if (configured && configured.length >= 12) return configured;
  if (configured) {
    throw new Error('DOFLOW_CEO_PASSWORD must be at least 12 characters long.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DOFLOW_CEO_PASSWORD is required in production.');
  }

  console.warn(
    '[seed:doflow] WARNING: DOFLOW_CEO_PASSWORD is missing. ' +
      'A random development-only password will be set. Set DOFLOW_CEO_PASSWORD and rerun the seed before using these accounts.',
  );
  return `DoflowDev-${randomBytes(18).toString('base64url')}!`;
}

async function ensureTenantTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seed-doflow-tenant.ensureTenantTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await ds.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".users (
      id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      email         TEXT         NOT NULL UNIQUE,
      password_hash TEXT,
      role          TEXT         NOT NULL DEFAULT 'user',
      full_name     TEXT,
      auth_provider TEXT         NOT NULL DEFAULT 'password',
      google_id     TEXT,
      avatar_url    TEXT,
      email_verified_at TIMESTAMP,
      mfa_enabled   BOOLEAN      DEFAULT false,
      mfa_secret    TEXT,
      is_active     BOOLEAN      DEFAULT true,
      created_at    TIMESTAMP    DEFAULT NOW(),
      updated_at    TIMESTAMP    DEFAULT NOW()
    )
  `);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS full_name TEXT`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS google_id TEXT`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS mfa_secret TEXT`);
  await ds.query(`ALTER TABLE "${s}".users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_users_email" ON "${s}".users(lower(email))`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_users_google_id" ON "${s}".users(google_id) WHERE google_id IS NOT NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".invites (
      id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
      email       TEXT      NOT NULL,
      token       TEXT      NOT NULL UNIQUE,
      role        TEXT      NOT NULL DEFAULT 'user',
      accepted_at TIMESTAMP,
      expires_at  TIMESTAMP,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".audit_log (
      id          BIGSERIAL    PRIMARY KEY,
      actor_email TEXT,
      actor_role  TEXT,
      action      TEXT         NOT NULL,
      target      TEXT,
      target_email TEXT,
      ip          TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      metadata    JSONB        DEFAULT '{}'::jsonb,
      created_at  TIMESTAMP    DEFAULT NOW()
    )
  `);
  await ds.query(`ALTER TABLE "${s}".audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT`);
  await ds.query(`ALTER TABLE "${s}".audit_log ADD COLUMN IF NOT EXISTS target_email TEXT`);
  await ds.query(`ALTER TABLE "${s}".audit_log ADD COLUMN IF NOT EXISTS ip TEXT`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".files (
      id            SERIAL PRIMARY KEY,
      key           TEXT        NOT NULL,
      original_name TEXT,
      content_type  TEXT,
      size          BIGINT,
      created_by    TEXT,
      created_at    TIMESTAMP   DEFAULT NOW()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".dashboard_widgets (
      id         UUID      DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id    UUID      NOT NULL,
      module_key TEXT      NOT NULL,
      x          INTEGER   DEFAULT 0,
      y          INTEGER   DEFAULT 0,
      w          INTEGER   DEFAULT 1,
      h          INTEGER   DEFAULT 1,
      settings   JSONB     DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_widgets_user ON "${s}".dashboard_widgets(user_id)`);

  await ensureTenantCrmCoreTables(ds, s);
  await ensureTenantBriefingQuoteTables(ds, s);
  await ensureTenantProjectsTables(ds, s);
  await ensureTenantFinanceTables(ds, s);
  await ensureTenantNotificationsTables(ds, s);
  await seedTenantNotificationRules(ds, s);
}

async function ensureTenantRecord(ds: DataSource): Promise<{ id: string }> {
  const rows = await ds.query(
    `
    INSERT INTO public.tenants (
      slug, name, schema_name, contact_email, admin_email, plan_tier,
      is_active, max_users, storage_limit_gb, storage_used_mb,
      created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $4, $5, true, 999, 100, 0, now(), now())
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          schema_name = EXCLUDED.schema_name,
          contact_email = COALESCE(public.tenants.contact_email, EXCLUDED.contact_email),
          admin_email = COALESCE(public.tenants.admin_email, EXCLUDED.admin_email),
          plan_tier = EXCLUDED.plan_tier,
          is_active = true,
          max_users = GREATEST(COALESCE(public.tenants.max_users, 0), EXCLUDED.max_users),
          storage_limit_gb = GREATEST(COALESCE(public.tenants.storage_limit_gb, 0), EXCLUDED.storage_limit_gb),
          updated_at = now()
    RETURNING id
    `,
    [TENANT_SLUG, TENANT_NAME, TENANT_SCHEMA, CEO_EMAILS[0], PLAN_TIER],
  );

  return { id: rows[0].id };
}

async function ensureCeoUsers(ds: DataSource, tenantId: string, password: string) {
  const schema = safeSchema(TENANT_SCHEMA, 'seed-doflow-tenant.ensureCeoUsers');
  const passwordHash = await bcrypt.hash(password, 12);

  for (const email of CEO_EMAILS) {
    const tenantRows = await ds.query(
      `
      INSERT INTO "${schema}".users (
        email, password_hash, role, auth_provider, is_active, created_at, updated_at
      )
      VALUES ($1, $2, 'owner', 'password', true, now(), now())
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = 'owner',
            auth_provider = 'password',
            is_active = true,
            updated_at = now()
      RETURNING id, email, role
      `,
      [email, passwordHash],
    );

    await ds.query(
      `
      INSERT INTO public.users (
        id, email, password_hash, role, tenant_id, auth_provider,
        is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, 'owner', $4, 'password', true, now(), now())
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = 'owner',
            tenant_id = EXCLUDED.tenant_id,
            auth_provider = 'password',
            is_active = true,
            updated_at = now()
      `,
      [tenantRows[0].id, email, passwordHash, tenantId],
    );

    console.log(`[seed:doflow] CEO ensured: ${email} (role owner)`);
  }
}

async function ensureEnterpriseModules(ds: DataSource, tenantId: string) {
  const moduleTable = await ds.query(`SELECT to_regclass('public.platform_modules') AS table_name`);
  const subTable = await ds.query(`SELECT to_regclass('public.tenant_subscriptions') AS table_name`);
  if (!moduleTable[0]?.table_name || !subTable[0]?.table_name) {
    console.warn('[seed:doflow] platform_modules or tenant_subscriptions table missing; skipping module subscriptions.');
    return;
  }

  const rows = await ds.query(
    `
    INSERT INTO public.tenant_subscriptions (
      "tenantId", "moduleKey", status, "trialEndsAt", "expiresAt", "assignedAt"
    )
    SELECT $1, key, 'ACTIVE', NULL, NULL, now()
    FROM public.platform_modules
    ON CONFLICT ("tenantId", "moduleKey") DO UPDATE
      SET status = 'ACTIVE',
          "trialEndsAt" = NULL,
          "expiresAt" = NULL
    RETURNING "moduleKey"
    `,
    [tenantId],
  );

  console.log(`[seed:doflow] Active module subscriptions ensured: ${rows.length}`);
}

async function markOnboardingComplete(ds: DataSource, tenantId: string) {
  const table = await ds.query(`SELECT to_regclass('public.tenant_onboarding') AS table_name`);
  if (!table[0]?.table_name) {
    console.warn('[seed:doflow] tenant_onboarding table missing; skipping onboarding completion.');
    return;
  }

  const modules = await ds.query(
    `SELECT key FROM public.platform_modules ORDER BY key`,
  ).catch(() => [] as Array<{ key: string }>);

  await ds.query(
    `
    INSERT INTO public.tenant_onboarding (
      tenant_id, sector, completed_at, selected_modules, dashboard_layout, created_at, updated_at
    )
    VALUES ($1, 'web_agency', now(), $2::jsonb, '[]'::jsonb, now(), now())
    ON CONFLICT (tenant_id) DO UPDATE
      SET sector = EXCLUDED.sector,
          completed_at = COALESCE(public.tenant_onboarding.completed_at, EXCLUDED.completed_at),
          selected_modules = EXCLUDED.selected_modules,
          updated_at = now()
    `,
    [tenantId, JSON.stringify(modules.map((m: { key: string }) => m.key))],
  );

  console.log('[seed:doflow] Onboarding marked as completed.');
}

async function updateTenantWhitelistCache() {
  const host = process.env.REDIS_HOST;
  if (!host) {
    console.warn('[seed:doflow] REDIS_HOST not set; restart the backend or hydrate tenant cache to expose the new tenant immediately.');
    return;
  }

  const redis = new Redis({
    host,
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.sadd('df:sys:tenant_whitelist', TENANT_SLUG);
    await redis.del(`tenant:slug:${TENANT_SLUG}`);
    console.log('[seed:doflow] Redis tenant whitelist updated.');
  } catch (err) {
    console.warn('[seed:doflow] Could not update Redis tenant whitelist. Restarting the backend will refresh it.');
  } finally {
    redis.disconnect();
  }
}

async function main() {
  logStartupDiagnostics();
  const password = getInitialPassword();
  const ds = new DataSource({
    type: 'postgres',
    url: requireDatabaseUrl(),
    synchronize: false,
    logging: ['error', 'warn'],
  });

  await ds.initialize();
  try {
    console.log('[seed:doflow] Ensuring tenant record...');
    const tenant = await ensureTenantRecord(ds);

    console.log('[seed:doflow] Ensuring tenant schema/tables...');
    await ensureTenantTables(ds, TENANT_SCHEMA);
    await seedDoflowBriefingQuoteTemplates(ds, TENANT_SCHEMA);

    console.log('[seed:doflow] Ensuring CEO users...');
    await ensureCeoUsers(ds, tenant.id, password);

    await ensureEnterpriseModules(ds, tenant.id);
    await markOnboardingComplete(ds, tenant.id);
    await updateTenantWhitelistCache();

    console.log('[seed:doflow] Done.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  logErrorDetails(err);
  process.exitCode = 1;
});
