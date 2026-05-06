// apps/backend/src/migrations/1714752000000-InitialPublicSchema.ts
// Initial schema migration — replaces the runtime `CREATE TABLE LIKE public.users`
// pattern with explicit, versioned migrations.
//
// USAGE:
//   pnpm -C apps/backend typeorm migration:run
//
// To generate a new migration after entity changes:
//   pnpm -C apps/backend typeorm migration:generate src/migrations/Name -d data-source.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPublicSchema1714752000000 implements MigrationInterface {
  name = 'InitialPublicSchema1714752000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ─── public.users (directory across all tenants) ───────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         TEXT         NOT NULL UNIQUE,
        password_hash TEXT,
        role          TEXT         NOT NULL DEFAULT 'user',
        tenant_id     TEXT,
        mfa_enabled   BOOLEAN      DEFAULT false,
        mfa_secret    TEXT,
        is_active     BOOLEAN      DEFAULT true,
        created_at    TIMESTAMP    DEFAULT NOW(),
        updated_at    TIMESTAMP    DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(lower(email))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id)`,
    );

    // ─── public.invites ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.invites (
        id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         TEXT         NOT NULL,
        token         TEXT         NOT NULL UNIQUE,
        role          TEXT         NOT NULL DEFAULT 'user',
        accepted_at   TIMESTAMP,
        expires_at    TIMESTAMP,
        created_at    TIMESTAMP    DEFAULT NOW()
      )
    `);

    // ─── public.audit_log ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.audit_log (
        id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_email   TEXT,
        actor_id      TEXT,
        actor_role    TEXT,
        action        TEXT         NOT NULL,
        target_email  TEXT,
        target_id     TEXT,
        ip            TEXT,
        ip_address    TEXT,
        user_agent    TEXT,
        metadata      JSONB        DEFAULT '{}'::jsonb,
        created_at    TIMESTAMP    DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC)`,
    );

    // ─── public.tenant_onboarding ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
        tenant_id          UUID         PRIMARY KEY,
        sector             TEXT,
        completed_at       TIMESTAMP,
        selected_modules   JSONB        DEFAULT '[]'::jsonb,
        dashboard_layout   JSONB        DEFAULT '[]'::jsonb,
        created_at         TIMESTAMP    DEFAULT NOW(),
        updated_at         TIMESTAMP    DEFAULT NOW()
      )
    `);

    // ─── public.tenant_domains ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_domains (
        id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_slug   TEXT         NOT NULL,
        domain        TEXT         NOT NULL UNIQUE,
        is_verified   BOOLEAN      DEFAULT false,
        created_at    TIMESTAMP    DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenant_domains_slug ON public.tenant_domains(tenant_slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenant_domains CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenant_onboarding CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.audit_log CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.invites CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.users CASCADE`);
  }
}
