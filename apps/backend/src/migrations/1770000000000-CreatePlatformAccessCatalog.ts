import { MigrationInterface, QueryRunner } from 'typeorm';

/** Public feature catalog used by FeatureAccessGuard and the idempotent module seed. */
export class CreatePlatformAccessCatalog1770000000000 implements MigrationInterface {
  name = 'CreatePlatformAccessCatalog1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.platform_modules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'COMMERCIAL',
        "minTier" TEXT NOT NULL DEFAULT 'STARTER',
        "priceMonthly" NUMERIC(10, 2) NOT NULL DEFAULT 0,
        "isBeta" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        "moduleKey" TEXT NOT NULL REFERENCES public.platform_modules(key),
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        "trialEndsAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "assignedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_tenant_subscriptions_tenant_module UNIQUE ("tenantId", "moduleKey")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status
         ON public.tenant_subscriptions(status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenant_subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.platform_modules`);
  }
}
