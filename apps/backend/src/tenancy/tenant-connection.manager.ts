// apps/backend/src/tenancy/tenant-connection.manager.ts
import { DataSource } from 'typeorm';

export class TenantConnectionManager {
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
    console.log(`✅ Tenant connection ready → schema: ${key}`);

    return ds;
  }
}
