import 'reflect-metadata';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { DOFLOW_ROLE_CAPABILITIES, ensureDoflowWorkspaceTables } from '../tenant/tenant-doflow-workspace.service';
import { syncTenantUsersToTeamMembers } from '../tenant/tenant-team-schema';

const ACCOUNTS = [
  {
    id: 'ce000000-0000-4000-8000-000000000001',
    email: 'executive-one@acceptance.invalid',
    name: 'Executive One Synthetic',
    provider: 'google',
    googleId: 'acceptance-google-executive-one',
    avatar: 'https://acceptance.invalid/avatar/executive-one.png',
    verifiedAt: '2024-01-02T09:00:00.000Z',
  },
  {
    id: 'ce000000-0000-4000-8000-000000000002',
    email: 'executive-two@acceptance.invalid',
    name: 'Executive Two Synthetic',
    provider: 'password',
    googleId: 'acceptance-google-executive-two',
    avatar: 'https://acceptance.invalid/avatar/executive-two.png',
    verifiedAt: '2024-01-03T09:00:00.000Z',
  },
] as const;

const COMPANY_ID = 'c1000000-0000-4000-8000-000000000001';
const PROJECT_ID = 'c2000000-0000-4000-8000-000000000001';

function requireIsolatedDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CEO preservation fixture requires NODE_ENV=test.');
  }
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required.');
  const parsed = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('CEO preservation fixture refuses a non-local PostgreSQL host.');
  }
  return value;
}

function requiredSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required and is never logged.`);
  return value;
}

function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function snapshot(dataSource: DataSource, email: string) {
  const tenantRows = await dataSource.query(
    `SELECT id::text, lower(email) AS email, password_hash, role, full_name,
            auth_provider, google_id, avatar_url,
            email_verified_at AT TIME ZONE 'UTC' AS email_verified_at,
            mfa_enabled, mfa_secret, is_active
       FROM doflow.users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  const publicRows = await dataSource.query(
    `SELECT id::text, lower(email) AS email, password_hash, role,
            tenant_id::text, full_name, auth_provider, google_id, avatar_url,
            email_verified_at AT TIME ZONE 'UTC' AS email_verified_at,
            mfa_enabled, mfa_secret, is_active
       FROM public.users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  const tenant = tenantRows[0];
  const mirror = publicRows[0];
  if (!tenant || !mirror) throw new Error(`Synthetic CEO mirror missing for ${email}.`);

  const [preferences, membership, roles, capabilities, references] = await Promise.all([
    dataSource.query(
      `SELECT preferences FROM doflow.doflow_user_preferences WHERE user_id = $1`,
      [tenant.id],
    ),
    dataSource.query(
      `SELECT user_id::text, lower(email) AS email, display_name, tenant_role,
              operational_role, employment_type, status, metadata
         FROM doflow.team_members
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY id`,
      [tenant.id],
    ),
    dataSource.query(
      `SELECT role FROM doflow.doflow_user_roles WHERE user_id = $1 ORDER BY role`,
      [tenant.id],
    ),
    dataSource.query(
      `SELECT capability FROM doflow.doflow_user_capabilities
        WHERE user_id = $1 ORDER BY capability`,
      [tenant.id],
    ),
    dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM doflow.companies WHERE owner_user_id = $1 AND deleted_at IS NULL) AS companies,
         (SELECT count(*)::int FROM doflow.projects WHERE project_manager_id = $1 AND deleted_at IS NULL) AS managed_projects,
         (SELECT count(*)::int FROM doflow.projects WHERE created_by = $1 OR updated_by = $1) AS touched_projects`,
      [tenant.id],
    ),
  ]);

  return {
    tenant,
    mirror,
    preferences: preferences[0]?.preferences ?? null,
    membership,
    roles: roles.map((row: { role: string }) => row.role),
    capabilities: capabilities.map((row: { capability: string }) => row.capability),
    references: references[0],
  };
}

async function prepare(dataSource: DataSource) {
  const password = requiredSecret('DOFLOW_ACCEPTANCE_PASSWORD');
  const mfaSecret = requiredSecret('DOFLOW_ACCEPTANCE_MFA_SECRET');
  const tenantRows = await dataSource.query(
    `SELECT id::text FROM public.tenants
      WHERE slug = 'doflow' AND schema_name = 'doflow' AND is_active = true LIMIT 1`,
  );
  if (!tenantRows[0]) throw new Error('Active isolated doflow tenant is required.');
  const tenantId = String(tenantRows[0].id);
  await ensureDoflowWorkspaceTables(dataSource, 'doflow');

  await dataSource.transaction(async (manager) => {
    await manager.query(
      `CREATE TABLE IF NOT EXISTS public.doflow_acceptance_ceo_baseline (
         email TEXT PRIMARY KEY,
         snapshot JSONB NOT NULL,
         checksum TEXT NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await manager.query(`DELETE FROM doflow.projects WHERE id = $1`, [PROJECT_ID]);
    await manager.query(`DELETE FROM doflow.companies WHERE id = $1`, [COMPANY_ID]);

    const existing = await manager.query(
      `SELECT id::text FROM doflow.users WHERE lower(email) = ANY($1::text[])`,
      [ACCOUNTS.map((account) => account.email)],
    );
    const userIds = Array.from(new Set([
      ...existing.map((row: { id: string }) => row.id),
      ...ACCOUNTS.map((account) => account.id),
    ]));
    await manager.query(`DELETE FROM doflow.doflow_user_preferences WHERE user_id = ANY($1::uuid[])`, [userIds]);
    await manager.query(`DELETE FROM doflow.doflow_user_roles WHERE user_id = ANY($1::uuid[])`, [userIds]);
    await manager.query(`DELETE FROM doflow.doflow_user_capabilities WHERE user_id = ANY($1::uuid[])`, [userIds]);
    await manager.query(`DELETE FROM doflow.team_members WHERE lower(email) = ANY($1::text[])`, [ACCOUNTS.map((account) => account.email)]);
    await manager.query(`DELETE FROM doflow.users WHERE lower(email) = ANY($1::text[])`, [ACCOUNTS.map((account) => account.email)]);
    await manager.query(`DELETE FROM public.users WHERE lower(email) = ANY($1::text[])`, [ACCOUNTS.map((account) => account.email)]);
    await manager.query(`DELETE FROM public.doflow_acceptance_ceo_baseline WHERE lower(email) = ANY($1::text[])`, [ACCOUNTS.map((account) => account.email)]);

    for (const [index, account] of ACCOUNTS.entries()) {
      const passwordHash = await bcrypt.hash(`${password}:${account.email}`, 12);
      const accountMfaSecret = `${mfaSecret}${index === 0 ? 'A' : 'B'}`;
      const values = [
        account.id,
        account.email,
        passwordHash,
        account.name,
        account.provider,
        account.googleId,
        account.avatar,
        account.verifiedAt,
        accountMfaSecret,
      ];
      await manager.query(
        `INSERT INTO doflow.users (
           id, email, password_hash, role, full_name, auth_provider, google_id,
           avatar_url, email_verified_at, mfa_enabled, mfa_secret, is_active,
           created_at, updated_at
         ) VALUES ($1, $2, $3, 'owner', $4, $5, $6, $7, $8, true, $9, true, now(), now())`,
        values,
      );
      await manager.query(
        `INSERT INTO public.users (
           id, email, password_hash, role, tenant_id, full_name, auth_provider,
           google_id, avatar_url, email_verified_at, mfa_enabled, mfa_secret,
           is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, 'owner', $10, $4, $5, $6, $7, $8, true, $9, true, now(), now())`,
        [...values, tenantId],
      );
      await manager.query(
        `INSERT INTO doflow.doflow_user_preferences (user_id, preferences, updated_at)
         VALUES ($1, $2::jsonb, now())`,
        [account.id, JSON.stringify({ locale: 'it-IT', theme: index === 0 ? 'light' : 'dark', synthetic: true })],
      );
      await manager.query(
        `INSERT INTO doflow.doflow_user_roles (user_id, role) VALUES ($1, 'administrator')`,
        [account.id],
      );
      for (const capability of DOFLOW_ROLE_CAPABILITIES.administrator) {
        await manager.query(
          `INSERT INTO doflow.doflow_user_capabilities (user_id, capability)
           VALUES ($1, $2)`,
          [account.id, capability],
        );
      }
    }
  });

  await syncTenantUsersToTeamMembers(dataSource, 'doflow');
  await dataSource.query(
    `UPDATE doflow.team_members
        SET operational_role = 'administrator', employment_type = 'admin',
            metadata = jsonb_build_object('synthetic', true), updated_at = now()
      WHERE lower(email) = ANY($1::text[]) AND deleted_at IS NULL`,
    [ACCOUNTS.map((account) => account.email)],
  );
  await dataSource.query(
    `INSERT INTO doflow.companies (
       id, name, status, source, owner_user_id, created_by, updated_by,
       created_at, updated_at
     ) VALUES ($1, 'Synthetic CEO Preservation Company', 'active_client',
       'acceptance_fixture', $2, $2, $3, now(), now())`,
    [COMPANY_ID, ACCOUNTS[0].id, ACCOUNTS[1].id],
  );
  await dataSource.query(
    `INSERT INTO doflow.projects (
       id, company_id, name, description, type, status, priority, progress,
       project_manager_id, created_by, updated_by, created_at, updated_at
     ) VALUES ($1, $2, 'Synthetic CEO Preservation Project',
       'Isolated migration reference fixture', 'custom', 'to_start', 'medium',
       0, $3, $4, $3, now(), now())`,
    [PROJECT_ID, COMPANY_ID, ACCOUNTS[1].id, ACCOUNTS[0].id],
  );

  for (const account of ACCOUNTS) {
    const value = await snapshot(dataSource, account.email);
    await dataSource.query(
      `INSERT INTO public.doflow_acceptance_ceo_baseline (email, snapshot, checksum)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (email) DO UPDATE SET snapshot = excluded.snapshot,
         checksum = excluded.checksum, created_at = now()`,
      [account.email, JSON.stringify(value), checksum(value)],
    );
  }
  process.stdout.write('[acceptance:ceo] Synthetic pre-migration identities prepared; sensitive values withheld.\n');
}

async function verify(dataSource: DataSource) {
  for (const account of ACCOUNTS) {
    const baselineRows = await dataSource.query(
      `SELECT snapshot, checksum FROM public.doflow_acceptance_ceo_baseline
        WHERE lower(email) = lower($1) LIMIT 1`,
      [account.email],
    );
    if (!baselineRows[0]) throw new Error(`Baseline missing for ${account.email}.`);
    const current = await snapshot(dataSource, account.email);
    const currentChecksum = checksum(current);
    if (currentChecksum !== String(baselineRows[0].checksum)) {
      throw new Error(`CEO identity preservation failed for ${account.email}.`);
    }
    if (current.tenant.id !== current.mirror.id || current.tenant.role !== 'owner' || current.tenant.is_active !== true) {
      throw new Error(`CEO owner/mirror invariant failed for ${account.email}.`);
    }
    if (current.membership.length !== 1 || current.capabilities.length !== DOFLOW_ROLE_CAPABILITIES.administrator.length) {
      throw new Error(`CEO membership/capability invariant failed for ${account.email}.`);
    }
  }
  process.stdout.write('[acceptance:ceo] PRESERVED=2 MIRRORS=2 MEMBERSHIPS=2 CAPABILITIES=complete\n');
}

async function main() {
  const mode = process.argv.includes('--prepare') ? 'prepare' : process.argv.includes('--verify') ? 'verify' : null;
  if (!mode) throw new Error('Use --prepare or --verify.');
  const dataSource = new DataSource({
    type: 'postgres',
    url: requireIsolatedDatabase(),
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();
  try {
    if (mode === 'prepare') await prepare(dataSource);
    else await verify(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`[acceptance:ceo] ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
});
