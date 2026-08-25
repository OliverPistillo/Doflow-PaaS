import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureDoflowDocumentRevenueTables } from '../tenant/tenant-doflow-document-revenue-schema';

/** Additive, tenant-only rollout of the Doflow Document & Revenue authority. */
export class CreateDocumentRevenueCoreAuthority1820000000000
  implements MigrationInterface
{
  name = 'CreateDocumentRevenueCoreAuthority1820000000000';

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
        throw new Error(
          `Schema non valido durante Document & Revenue migration: ${schema}`,
        );
      }
      await ensureDoflowDocumentRevenueTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: document/revenue records are authoritative.
  }
}
