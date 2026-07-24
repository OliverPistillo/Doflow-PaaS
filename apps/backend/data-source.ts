// apps/backend/data-source.ts
// TypeORM CLI DataSource — used by `pnpm typeorm migration:*` commands.
// The runtime app config remains in app.module.ts (TypeOrmModule.forRoot).

import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'doflow_migrations',
  logging: ['error', 'warn', 'migration'],
  synchronize: false,
});
