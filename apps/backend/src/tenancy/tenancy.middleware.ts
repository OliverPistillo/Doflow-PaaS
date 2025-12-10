import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private static connectionMap = new Map<string, DataSource>();

  async use(req: Request, _res: Response, next: NextFunction) {
    // 1) header custom (futuro: X-Doflow-Tenant-Id passato dal frontend / proxy)
    // 2) altrimenti Host
    // 3) default app.doflow.it
    const rawHost =
      (req.headers['x-doflow-tenant-id'] as string) ||
      (req.headers['host'] as string) ||
      'app.doflow.it';

    const hostHeader = rawHost.split(':')[0];        // es. "api.doflow.it"
    const firstLabel = hostHeader.split('.')[0];     // es. "api"

    const normalized = firstLabel.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // QUI LA PARTE IMPORTANTE:
    // sia "app.doflow.it" che "api.doflow.it" devono usare lo schema "public"
    const tenantId = ['app', 'api'].includes(normalized) ? 'public' : normalized;

    console.log('[TENANCY]', { rawHost, hostHeader, firstLabel, tenantId });

    if (!TenancyMiddleware.connectionMap.has(tenantId)) {
      const ds = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        schema: tenantId,
        synchronize: process.env.DB_SYNC_ON_BOOT === 'true',
      });
      await ds.initialize();
      TenancyMiddleware.connectionMap.set(tenantId, ds);
      console.log(`✅ Init tenant connection for schema: ${tenantId}`);
    }

    (req as any).tenantConnection =
      TenancyMiddleware.connectionMap.get(tenantId);
    (req as any).tenantId = tenantId;

    next();
  }
}
