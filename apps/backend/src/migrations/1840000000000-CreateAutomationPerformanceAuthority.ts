import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureDoflowAutomationPerformanceTables } from '../tenant/tenant-automation-performance-schema';
import { ensurePlatformOperationalTables } from '../superadmin/platform-operational-schema';

/** Additive, non-destructive Phase 4B rollout for the Doflow tenant only. */
export class CreateAutomationPerformanceAuthority1840000000000 implements MigrationInterface {
  name = 'CreateAutomationPerformanceAuthority1840000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensurePlatformOperationalTables(queryRunner);
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE lower(schema_name) = 'doflow' ORDER BY schema_name
    `);
    for (const row of schemas) {
      const schema = String(row.schema_name || '').toLowerCase();
      if (schema !== 'doflow') throw new Error(`Schema Phase 4B non valido: ${schema}`);
      await ensureDoflowAutomationPerformanceTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty: runs, ledger and ranking snapshots are authoritative records.
  }
}
