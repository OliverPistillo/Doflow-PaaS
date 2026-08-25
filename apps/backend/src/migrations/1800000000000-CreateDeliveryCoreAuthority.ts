import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureTenantDeliveryCoreTables } from '../tenant/tenant-delivery-schema';

/** Additive Delivery Core rollout for every existing tenant project schema. */
export class CreateDeliveryCoreAuthority1800000000000 implements MigrationInterface {
  name = 'CreateDeliveryCoreAuthority1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ table_schema: string }> = await queryRunner.query(`
      SELECT table_schema
      FROM information_schema.tables
      WHERE table_name = 'projects'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
      GROUP BY table_schema
      ORDER BY table_schema
    `);
    for (const row of schemas) {
      const schema = String(row.table_schema || '');
      if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
        throw new Error(`Schema tenant non valido durante Delivery Core migration: ${schema}`);
      }
      await ensureTenantDeliveryCoreTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: Delivery rows are authoritative records.
  }
}
