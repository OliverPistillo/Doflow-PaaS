import { MigrationInterface, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantCustomerInboxMailTables } from '../tenant/tenant-customer-inbox-mail-schema';

export class AddCustomerInboxMailAndNotificationSeen1870000000000 implements MigrationInterface {
  name = 'AddCustomerInboxMailAndNotificationSeen1870000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT DISTINCT t.schema_name FROM public.tenants t
      JOIN information_schema.schemata s ON s.schema_name=t.schema_name
      WHERE t.schema_name IS NOT NULL ORDER BY t.schema_name`);
    for (const row of schemas) {
      const schema = safeSchema(row.schema_name, this.name);
      if (schema === 'public') throw new Error('Refusing Customer Inbox provisioning in public');
      await ensureTenantCustomerInboxMailTables(queryRunner as never, schema);
      const notificationPreferences: Array<{ exists: boolean }> = await queryRunner.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname=$1 AND c.relname='notification_preferences' AND c.relkind IN ('r','p')
         ) AS exists`,
        [schema],
      );
      if (notificationPreferences[0]?.exists === true) {
        const lastSeenColumn: Array<{ exists: boolean }> = await queryRunner.query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema=$1 AND table_name='notification_preferences' AND column_name='last_seen_at'
           ) AS exists`,
          [schema],
        );
        if (lastSeenColumn[0]?.exists !== true) {
          await queryRunner.query(`ALTER TABLE "${schema}".notification_preferences ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
        }
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally non-destructive: imported mail and user watermarks are audit-relevant state.
  }
}
