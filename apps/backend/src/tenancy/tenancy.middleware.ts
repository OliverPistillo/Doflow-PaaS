import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private static connectionMap = new Map<string, DataSource>();

  async use(req: Request, _res: Response, next: NextFunction) {
    // 1) prova da header custom passato da Nginx
    // 2) fallback su header Host
    // 3) default app.doflow.it
    const rawHost =
      (req.headers['x-doflow-tenant-id'] as string) ||
      (req.headers['host'] as string) ||
      'app.doflow.it';

    // rimuove eventuale :80
    const hostHeader = rawHost.split(':')[0];

    const firstLabel = hostHeader.split('.')[0];

    const tenantId =
      firstLabel === 'app'
        ? 'public'
        : firstLabel.replace(/[^a-zA-Z0-9_]/g, '_');

    // DEBUG (puoi toglierlo dopo che vedi che funziona)
    console.log('[TENANCY]', { rawHost, hostHeader, firstLabel, tenantId });

    if (!TenancyMiddleware.connectionMap.has(tenantId)) {
      const ds = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        schema: tenantId,
        synchronize: false,
      });
      await ds.initialize();
      TenancyMiddleware.connectionMap.set(tenantId, ds);
      console.log(`✅ Init tenant connection for schema: ${tenantId}`);
    }

    (req as any).tenantConnection = TenancyMiddleware.connectionMap.get(tenantId);
    (req as any).tenantId = tenantId;
    next();
  }
}
