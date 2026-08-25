import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureDoflowCommerceTables } from '../tenant/tenant-doflow-commerce-schema';

/** Additive, tenant-only rollout of the Doflow Commerce & Cash authority schema. */
export class CreateCommerceCashCoreAuthority1810000000000 implements MigrationInterface {
  name = 'CreateCommerceCashCoreAuthority1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT schema_name
        FROM information_schema.schemata
       WHERE lower(schema_name) = 'doflow'
       ORDER BY schema_name
    `);
    for (const row of schemas) {
      const schema = String(row.schema_name || '').toLowerCase();
      if (schema !== 'doflow') {
        throw new Error(`Schema non valido durante Commerce & Cash migration: ${schema}`);
      }
      await ensureDoflowCommerceTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: commerce and cash rows are authoritative records.
  }
}
