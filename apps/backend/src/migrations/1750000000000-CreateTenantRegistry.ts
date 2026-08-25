import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versioned public tenant registry required by auth, tenancy middleware and all
 * later per-tenant migrations. Production databases that already have the
 * registry are left untouched by the idempotent DDL.
 */
export class CreateTenantRegistry1750000000000 implements MigrationInterface {
  name = 'CreateTenantRegistry1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug             TEXT UNIQUE,
        name             TEXT,
        schema_name      TEXT,
        contact_email    TEXT,
        vat_number       TEXT,
        admin_email      TEXT,
        plan_tier        TEXT DEFAULT 'STARTER',
        is_active        BOOLEAN DEFAULT true,
        max_users        INTEGER DEFAULT 5,
        storage_used_mb  DOUBLE PRECISION DEFAULT 0,
        storage_limit_gb DOUBLE PRECISION DEFAULT 1,
        created_at       TIMESTAMP NOT NULL DEFAULT now(),
        updated_at       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug_not_null
         ON public.tenants(slug) WHERE slug IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenants_active
         ON public.tenants(is_active)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenants_schema_name
         ON public.tenants(schema_name)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenants`);
  }
}
