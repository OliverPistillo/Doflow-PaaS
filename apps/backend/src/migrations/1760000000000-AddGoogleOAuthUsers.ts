import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleOAuthUsers1760000000000 implements MigrationInterface {
  name = 'AddGoogleOAuthUsers1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureUserOAuthColumns(queryRunner, 'public');
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id) WHERE google_id IS NOT NULL`,
    );

    const tenants = await queryRunner.query(
      `SELECT schema_name FROM public.tenants WHERE schema_name IS NOT NULL`,
    );

    for (const row of tenants as Array<{ schema_name: string }>) {
      const schema = String(row.schema_name || '').toLowerCase();
      if (!/^[a-z0-9_]+$/.test(schema) || schema === 'public') continue;
      await this.ensureUserOAuthColumns(queryRunner, schema);
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${schema}_users_google_id" ON "${schema}".users(google_id) WHERE google_id IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_google_id`);
    await this.dropUserOAuthColumns(queryRunner, 'public');

    const tenants = await queryRunner.query(
      `SELECT schema_name FROM public.tenants WHERE schema_name IS NOT NULL`,
    );

    for (const row of tenants as Array<{ schema_name: string }>) {
      const schema = String(row.schema_name || '').toLowerCase();
      if (!/^[a-z0-9_]+$/.test(schema) || schema === 'public') continue;
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_${schema}_users_google_id"`);
      await this.dropUserOAuthColumns(queryRunner, schema);
    }
  }

  private async ensureUserOAuthColumns(queryRunner: QueryRunner, schema: string): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS full_name TEXT`);
    await queryRunner.query(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'`);
    await queryRunner.query(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS google_id TEXT`);
    await queryRunner.query(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    await queryRunner.query(`ALTER TABLE "${schema}".users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP`);
  }

  private async dropUserOAuthColumns(queryRunner: QueryRunner, schema: string): Promise<void> {
    await queryRunner.query(`ALTER TABLE "${schema}".users DROP COLUMN IF EXISTS email_verified_at`);
    await queryRunner.query(`ALTER TABLE "${schema}".users DROP COLUMN IF EXISTS avatar_url`);
    await queryRunner.query(`ALTER TABLE "${schema}".users DROP COLUMN IF EXISTS google_id`);
    await queryRunner.query(`ALTER TABLE "${schema}".users DROP COLUMN IF EXISTS auth_provider`);
    await queryRunner.query(`ALTER TABLE "${schema}".users DROP COLUMN IF EXISTS full_name`);
  }
}
