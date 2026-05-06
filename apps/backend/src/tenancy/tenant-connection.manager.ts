// apps/backend/src/tenancy/tenant-connection.manager.ts
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export class TenantConnectionManager {
  private static readonly logger = new Logger(TenantConnectionManager.name);

  private static connectionMap = new Map<string, DataSource>();

  static async getOrCreate(schema: string): Promise<DataSource> {
    const key = String(schema || 'public');

    const existing = this.connectionMap.get(key);
    if (existing) return existing;

    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: key,
      synchronize: false,
    });

    await ds.initialize();
    this.connectionMap.set(key, ds);

    // eslint-disable-next-line no-console
    this.logger.log(`✅ Tenant connection ready → schema: ${key}`);

    return ds;
  }
}
