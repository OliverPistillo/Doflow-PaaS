import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CreateCommercialCoreAuthority1790000000000 } from '../migrations/1790000000000-CreateCommercialCoreAuthority';

function isolatedDatabaseUrl(): string {
  if (process.env.NODE_ENV !== 'test' || String(process.env.DB_SYNC).toLowerCase() !== 'false') {
    throw new Error('Commercial Core acceptance migration requires NODE_ENV=test and DB_SYNC=false.');
  }
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required.');
  const parsed = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Commercial Core acceptance migration refuses a non-local PostgreSQL host.');
  }
  return value;
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: isolatedDatabaseUrl(),
    synchronize: false,
  });
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await new CreateCommercialCoreAuthority1790000000000().up(queryRunner);
    await queryRunner.commitTransaction();
    process.stdout.write('[acceptance:migration] Commercial Core migration applied idempotently to isolated tenant schemas.\n');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`[acceptance:migration] ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
});
