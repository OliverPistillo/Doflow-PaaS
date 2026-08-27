import { MigrationInterface, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantBackendContractTables } from '../tenant/tenant-backend-contracts-schema';

export class CompleteBackendContracts1860000000000 implements MigrationInterface {
  name = 'CompleteBackendContracts1860000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT DISTINCT t.schema_name FROM public.tenants t
      JOIN information_schema.schemata s ON s.schema_name=t.schema_name
      WHERE t.schema_name IS NOT NULL ORDER BY t.schema_name`);
    for (const row of schemas) {
      const schema = safeSchema(row.schema_name, this.name);
      if (schema === 'public') throw new Error('Refusing backend-contract provisioning in public');
      await ensureTenantBackendContractTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: contract history and financial metadata are authoritative.
  }
}
