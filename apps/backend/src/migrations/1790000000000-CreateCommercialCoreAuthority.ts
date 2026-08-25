import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureTenantCrmCoreTables } from '../tenant/tenant-crm-schema';

/**
 * Additive rollout for existing schema-per-tenant CRM installations.
 * New tenant schemas use the same idempotent provisioner during bootstrap.
 */
export class CreateCommercialCoreAuthority1790000000000 implements MigrationInterface {
  name = 'CreateCommercialCoreAuthority1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ table_schema: string }> = await queryRunner.query(`
      SELECT table_schema
      FROM information_schema.tables
      WHERE table_name = 'opportunities'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
      GROUP BY table_schema
      ORDER BY table_schema
    `);

    for (const row of schemas) {
      const schema = String(row.table_schema || '');
      if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
        throw new Error(`Schema tenant non valido durante Commercial Core migration: ${schema}`);
      }
      await ensureTenantCrmCoreTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intenzionalmente non distruttiva: colonne, History e idempotency registry
    // possono contenere dati autorevoli e non vengono rimossi automaticamente.
  }
}
