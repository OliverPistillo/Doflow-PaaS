import { MigrationInterface, QueryRunner } from 'typeorm';

/** Runtime scheduler prerequisite; kept explicit because DB_SYNC must stay off. */
export class CreateBackupSchedules1780000000000 implements MigrationInterface {
  name = 'CreateBackupSchedules1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.backup_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR,
        tenant_slug VARCHAR,
        tenant_name VARCHAR,
        frequency TEXT NOT NULL DEFAULT 'DAILY',
        backup_type TEXT NOT NULL DEFAULT 'FULL',
        hour INTEGER NOT NULL DEFAULT 2,
        day_of_week INTEGER,
        day_of_month INTEGER,
        retention_days INTEGER NOT NULL DEFAULT 30,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_run_at TIMESTAMP,
        next_run_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_backup_schedules_active
         ON public.backup_schedules(is_active)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.backup_schedules`);
  }
}
