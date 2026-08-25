// apps/backend/data-source.ts
// TypeORM CLI DataSource — used by `pnpm typeorm migration:*` commands.
// The runtime app config remains in app.module.ts (TypeOrmModule.forRoot).

import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // Schema migrations in this repository are explicit SQL migrations. Loading
  // every runtime entity here makes the CLI depend on decorator metadata before
  // it can run a migration and is unnecessary for migration:run/revert.
  entities: [],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'doflow_migrations',
  logging: ['error', 'warn', 'migration'],
  synchronize: false,
});
