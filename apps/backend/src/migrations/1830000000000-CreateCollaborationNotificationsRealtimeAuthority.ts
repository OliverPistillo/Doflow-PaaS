import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureDoflowCollaborationTables } from '../tenant/tenant-doflow-collaboration-schema';

/** Additive, tenant-only rollout of the Doflow Phase 4A authority. */
export class CreateCollaborationNotificationsRealtimeAuthority1830000000000
  implements MigrationInterface
{
  name = 'CreateCollaborationNotificationsRealtimeAuthority1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE lower(schema_name) = 'doflow' ORDER BY schema_name
    `);
    for (const row of schemas) {
      const schema = String(row.schema_name || '').toLowerCase();
      if (schema !== 'doflow') throw new Error(`Schema non valido durante Collaboration migration: ${schema}`);
      await ensureDoflowCollaborationTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: collaboration/history/outbox data is authoritative.
  }
}
