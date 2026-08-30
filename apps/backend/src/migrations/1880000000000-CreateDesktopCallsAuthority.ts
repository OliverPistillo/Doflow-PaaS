import { MigrationInterface, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensurePublicTenantCallTables, ensureTenantCallTables } from '../tenant/tenant-calls-schema';

/** Additive, tenant-safe authority for Desktop-first LiveKit call sessions. */
export class CreateDesktopCallsAuthority1880000000000 implements MigrationInterface {
  name = 'CreateDesktopCallsAuthority1880000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensurePublicTenantCallTables(queryRunner as never);
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT DISTINCT t.schema_name
      FROM public.tenants t
      JOIN information_schema.schemata s ON s.schema_name=t.schema_name
      WHERE t.schema_name IS NOT NULL
      ORDER BY t.schema_name
    `);
    for (const row of schemas) {
      const schema = safeSchema(row.schema_name, this.name);
      if (schema === 'public') throw new Error('Refusing to provision Desktop Calls in public');
      await ensureTenantCallTables(queryRunner as never, schema);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty: calls, guest revocations and audit events are authoritative records.
  }
}
