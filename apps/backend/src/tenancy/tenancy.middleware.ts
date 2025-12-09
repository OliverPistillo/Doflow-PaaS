import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

function resolveTenantId(raw: string): string {
  if (!raw) return 'public';

  // es: "app.doflow.it", "api.doflow.it", "cliente1.doflow.it"
  const host = raw.toLowerCase().split(':')[0].trim();

  // domini "core" della piattaforma: UI + API → sempre schema public
  if (host === 'app.doflow.it' || host === 'api.doflow.it') {
    return 'public';
  }

  const firstLabel = host.split('.')[0];

  // www/app/api come primo label → comunque public
  if (['www', 'app', 'api'].includes(firstLabel)) {
    return 'public';
  }

  // es: cliente1.doflow.it → "cliente1"
  const cleaned = firstLabel.replace(/[^a-z0-9_]/g, '_');
  return cleaned || 'public';
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private static connectionMap = new Map<string, DataSource>();

  async use(req: Request, _res: Response, next: NextFunction) {
    // 1) header usato dal frontend (nuovo)
    const headerTenant =
      (req.headers['x-tenant'] as string | undefined) ||
      (req.headers['x-doflow-tenant-id'] as string | undefined);

    // 2) fallback su Host
    const hostHeader = (req.headers['host'] as string | undefined) || 'app.doflow.it';

    const raw = headerTenant && headerTenant.trim().length > 0
      ? headerTenant.trim()
      : hostHeader;

    const tenantId = resolveTenantId(raw);

    console.log('[TENANCY]', {
      rawHost: raw,
      hostHeader,
      tenantId,
    });

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
