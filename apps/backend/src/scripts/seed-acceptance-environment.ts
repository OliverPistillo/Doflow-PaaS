import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { ensureDoflowWorkspaceTables } from '../tenant/tenant-doflow-workspace.service';
import { syncTenantUsersToTeamMembers } from '../tenant/tenant-team-schema';

const DOFLOW_TENANT_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_TENANT_ID = '20000000-0000-4000-8000-000000000001';

type FixtureUser = {
  id: string;
  schema: 'doflow' | 'acceptance_secondary';
  tenantId: string;
  email: string;
  role: string;
  fullName: string;
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
};

function requireIsolatedDatabase(): string {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Acceptance seed requires NODE_ENV=test.');
  }
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required.');
  const parsed = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Acceptance seed refuses a non-local PostgreSQL host.');
  }
  return value;
}

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required and is never logged.`);
  return value;
}

async function upsertTenant(
  dataSource: DataSource,
  input: { id: string; slug: string; schema: string; name: string },
) {
  await dataSource.query(
    `INSERT INTO public.tenants
       (id, slug, name, schema_name, plan_tier, is_active, max_users,
        storage_used_mb, storage_limit_gb, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ENTERPRISE', true, 50, 0, 10, now(), now())
     ON CONFLICT (slug) DO UPDATE SET
       name = excluded.name,
       schema_name = excluded.schema_name,
       plan_tier = excluded.plan_tier,
       is_active = true,
       updated_at = now()`,
    [input.id, input.slug, input.name, input.schema],
  );
}

async function upsertUser(dataSource: DataSource, user: FixtureUser, passwordHash: string) {
  await dataSource.query(
    `INSERT INTO "${user.schema}".users
       (id, email, password_hash, role, full_name, auth_provider, google_id,
        avatar_url, email_verified_at, mfa_enabled, mfa_secret, is_active,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'password', NULL, NULL, now(), $6, $7, true, now(), now())
     ON CONFLICT (email) DO UPDATE SET
       id = excluded.id,
       password_hash = excluded.password_hash,
       role = excluded.role,
       full_name = excluded.full_name,
       auth_provider = excluded.auth_provider,
       email_verified_at = excluded.email_verified_at,
       mfa_enabled = excluded.mfa_enabled,
       mfa_secret = excluded.mfa_secret,
       is_active = true,
       updated_at = now()`,
    [
      user.id,
      user.email,
      passwordHash,
      user.role,
      user.fullName,
      user.mfaEnabled === true,
      user.mfaSecret ?? null,
    ],
  );

  await dataSource.query(
    `INSERT INTO public.users
       (id, email, password_hash, role, tenant_id, full_name, auth_provider,
        google_id, avatar_url, email_verified_at, mfa_enabled, mfa_secret,
        is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'password', NULL, NULL, now(), $7, $8, true, now(), now())
     ON CONFLICT (email) DO UPDATE SET
       id = excluded.id,
       password_hash = excluded.password_hash,
       role = excluded.role,
       tenant_id = excluded.tenant_id,
       full_name = excluded.full_name,
       auth_provider = excluded.auth_provider,
       email_verified_at = excluded.email_verified_at,
       mfa_enabled = excluded.mfa_enabled,
       mfa_secret = excluded.mfa_secret,
       is_active = true,
       updated_at = now()`,
    [
      user.id,
      user.email,
      passwordHash,
      user.role,
      user.tenantId,
      user.fullName,
      user.mfaEnabled === true,
      user.mfaSecret ?? null,
    ],
  );
}

async function main() {
  const databaseUrl = requireIsolatedDatabase();
  const password = requiredSecret('DOFLOW_ACCEPTANCE_PASSWORD');
  const mfaSecret = requiredSecret('DOFLOW_ACCEPTANCE_MFA_SECRET');
  const dataSource = new DataSource({ type: 'postgres', url: databaseUrl, synchronize: false });
  await dataSource.initialize();

  try {
    await upsertTenant(dataSource, {
      id: DOFLOW_TENANT_ID,
      slug: 'doflow',
      schema: 'doflow',
      name: 'Doflow Acceptance',
    });
    const bootstrap = new TenantBootstrapService({} as never, dataSource);
    await bootstrap.ensureTenantTables(dataSource, 'doflow');

    const doflow = await dataSource.query(
      `SELECT id::text FROM public.tenants WHERE slug = 'doflow' AND schema_name = 'doflow' LIMIT 1`,
    );
    if (!doflow[0]) throw new Error('Unable to provision the isolated doflow tenant.');

    // Keep the canonical tenant id created by seed:doflow, but use a stable id
    // for the secondary tenant so IDOR assertions can be deterministic.
    const doflowTenantId = String(doflow[0].id || DOFLOW_TENANT_ID);
    await upsertTenant(dataSource, {
      id: SECOND_TENANT_ID,
      slug: 'acceptance-secondary',
      schema: 'acceptance_secondary',
      name: 'Acceptance Secondary',
    });

    await bootstrap.ensureTenantTables(dataSource, 'acceptance_secondary');

    const passwordHash = await bcrypt.hash(password, 12);
    const users: FixtureUser[] = [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'visual.owner@acceptance.invalid',
        role: 'owner',
        fullName: 'Visual Owner',
        mfaEnabled: true,
        mfaSecret,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000002',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'visual.manager@acceptance.invalid',
        role: 'manager',
        fullName: 'Visual Manager',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000003',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'visual.editor@acceptance.invalid',
        role: 'editor',
        fullName: 'Visual Editor',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000004',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'visual.viewer@acceptance.invalid',
        role: 'viewer',
        fullName: 'Visual Viewer',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000005',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'visual.mfa-setup@acceptance.invalid',
        role: 'viewer',
        fullName: 'Visual MFA Setup',
        mfaEnabled: true,
        mfaSecret: null,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000006',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'final.admin@acceptance.invalid',
        role: 'admin',
        fullName: 'Final Tenant Admin',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000007',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'final.tenant-superadmin@acceptance.invalid',
        role: 'superadmin',
        fullName: 'Final Tenant Scoped Superadmin',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000008',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'final.manager@acceptance.invalid',
        role: 'manager',
        fullName: 'Final MFA Manager',
        mfaEnabled: true,
        mfaSecret,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000009',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'final.limited@acceptance.invalid',
        role: 'viewer',
        fullName: 'Final MFA Limited',
        mfaEnabled: true,
        mfaSecret,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000010',
        schema: 'doflow',
        tenantId: doflowTenantId,
        email: 'final.owner@acceptance.invalid',
        role: 'owner',
        fullName: 'Final Tenant Owner',
      },
      {
        id: 'b0000000-0000-4000-8000-000000000001',
        schema: 'acceptance_secondary',
        tenantId: SECOND_TENANT_ID,
        email: 'secondary.owner@acceptance.invalid',
        role: 'owner',
        fullName: 'Secondary Owner',
      },
      {
        id: 'b0000000-0000-4000-8000-000000000002',
        schema: 'acceptance_secondary',
        tenantId: SECOND_TENANT_ID,
        email: 'final.secondary@acceptance.invalid',
        role: 'owner',
        fullName: 'Final Secondary Owner',
        mfaEnabled: true,
        mfaSecret,
      },
    ];

    for (const user of users) await upsertUser(dataSource, user, passwordHash);
    await dataSource.query(
      `INSERT INTO public.users
         (id, email, password_hash, role, tenant_id, full_name, auth_provider,
          email_verified_at, mfa_enabled, mfa_secret, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'superadmin', NULL, $4, 'password', now(), true, $5, true, now(), now())
       ON CONFLICT (email) DO UPDATE SET
         id = excluded.id,
         password_hash = excluded.password_hash,
         role = 'superadmin',
         tenant_id = NULL,
         full_name = excluded.full_name,
         email_verified_at = excluded.email_verified_at,
         mfa_enabled = true,
         mfa_secret = excluded.mfa_secret,
         is_active = true,
         updated_at = now()`,
      [
        'c0000000-0000-4000-8000-000000000001',
        'platform.superadmin@acceptance.invalid',
        passwordHash,
        'Acceptance Platform Admin',
        mfaSecret,
      ],
    );
    await syncTenantUsersToTeamMembers(dataSource, 'doflow');
    await syncTenantUsersToTeamMembers(dataSource, 'acceptance_secondary');
    await ensureDoflowWorkspaceTables(dataSource, 'doflow');
    await dataSource.query(
      `INSERT INTO "doflow".doflow_user_roles (user_id, role)
       VALUES ($1, 'commercial'), ($1, 'project_manager'), ($2, 'web_developer'), ($3, 'project_manager')
       ON CONFLICT (user_id, role) DO NOTHING`,
      [
        'a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000003',
        'a0000000-0000-4000-8000-000000000008',
      ],
    );
    await dataSource.query(
      `INSERT INTO "doflow".doflow_user_capabilities (user_id, capability)
       VALUES ($1, 'canViewAllLeads'), ($2, 'canApproveProjectWork')
       ON CONFLICT (user_id, capability) DO NOTHING`,
      ['a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003'],
    );

    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 56379),
      lazyConnect: true,
    });
    try {
      await redis.connect();
      await redis.flushdb();
      await redis.sadd('df:sys:tenant_whitelist', 'doflow', 'acceptance-secondary');
      await redis.del('tenant:slug:doflow', 'tenant:slug:acceptance-secondary');
    } finally {
      redis.disconnect();
    }

    process.stdout.write('[seed:acceptance] Isolated tenants and synthetic users ready.\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`[seed:acceptance] ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
});
