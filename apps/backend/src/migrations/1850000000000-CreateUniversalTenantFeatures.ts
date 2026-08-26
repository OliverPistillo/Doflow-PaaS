import { MigrationInterface, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantUniversalFeatureTables } from '../tenant/tenant-universal-features-schema';

/**
 * Additive rollout of the shared collaboration feature authority for every
 * existing tenant schema. Runtime provisioning covers tenants created later.
 */
export class CreateUniversalTenantFeatures1850000000000 implements MigrationInterface {
  name = 'CreateUniversalTenantFeatures1850000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT DISTINCT t.schema_name
      FROM public.tenants t
      JOIN information_schema.schemata s ON s.schema_name = t.schema_name
      WHERE t.schema_name IS NOT NULL
      ORDER BY t.schema_name
    `);
    for (const row of schemas) {
      const schema = safeSchema(row.schema_name, 'CreateUniversalTenantFeatures1850000000000');
      if (schema === 'public') throw new Error('Refusing to provision universal tenant tables in public');
      await ensureTenantUniversalFeatureTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty: messages, audit records, ledgers and release reads are authoritative data.
  }
}
