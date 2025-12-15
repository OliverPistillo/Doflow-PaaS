// C:\Doflow\apps\backend\src\tenancy\tenancy.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private static connectionMap = new Map<string, DataSource>();

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const hdr = (req.headers['x-doflow-tenant-id'] as string | undefined)?.trim();

    /**
     * 0) HEADER SLUG-ONLY MODE (standard consigliato)
     * Supporta: "public" | "demo" | "acme_1"
     * NOTA: Se passa "demo.doflow.it" non entra qui e finisce nel ramo host-based.
     */
    if (hdr && /^[a-z0-9_]+$/i.test(hdr)) {
      const slugOrPublic = hdr.toLowerCase();

      if (slugOrPublic === 'public') {
        return this.attachTenant(req, next, 'public');
      }

      // Cache (slug -> schema)
      const cacheKey = `tenant:slug:${slugOrPublic}`;
      const cachedSchema = await this.redis.get(cacheKey);

      if (cachedSchema) {
        if (cachedSchema === '__404__') {
          return res.status(404).json({
            error: 'Tenant not found or inactive (cached)',
            tenant: slugOrPublic,
          });
        }
        return this.attachTenant(req, next, cachedSchema);
      }

      // DB lookup su public.tenants
      const publicDs = await this.getOrCreateConnection('public');
      const rows = await publicDs.query(
        `
        select schema_name
        from public.tenants
        where slug = $1
          and is_active = true
        limit 1
        `,
        [slugOrPublic],
      );

      if (!rows[0]) {
        await this.redis.set(cacheKey, '__404__', 60);
        return res.status(404).json({
          error: 'Tenant not found or inactive',
          tenant: slugOrPublic,
        });
      }

      const schemaName = rows[0].schema_name as string;
      await this.redis.set(cacheKey, schemaName, 60);
      return this.attachTenant(req, next, schemaName);
    }

    /**
     * 1) HOST MODE (fallback)
     * Qui gestiamo: "app.doflow.it", "api.doflow.it", "demo.doflow.it", "localhost", "custom domains"
     */
    const rawHost =
      hdr ||
      (req.headers['host'] as string | undefined) ||
      'app.doflow.it';

    const host = rawHost.split(':')[0].toLowerCase();

    // Reserved / Local
    if (
      host === 'localhost' ||
      host === 'app.doflow.it' ||
      host === 'api.doflow.it'
    ) {
      return this.attachTenant(req, next, 'public');
    }

    const APP_DOMAIN = (process.env.APP_DOMAIN || 'doflow.it').toLowerCase();
    const isSystemDomain = host.endsWith(`.${APP_DOMAIN}`);

    /**
     * 2) CUSTOM DOMAIN LOOKUP
     * Se NON finisce con .doflow.it => dominio custom
     */
    if (!isSystemDomain) {
      const publicDs = await this.getOrCreateConnection('public');

      // NOTE: questo richiede tabella public.tenant_domains (se non esiste, togli questo ramo)
      const rows = await publicDs.query(
        `
        select t.schema_name
        from public.tenant_domains d
        join public.tenants t on t.slug = d.tenant_slug
        where d.domain = $1
          and t.is_active = true
        limit 1
        `,
        [host],
      );

      if (!rows[0]) {
        return res.status(404).json({
          error: 'Tenant not found for custom domain',
          domain: host,
        });
      }

      return this.attachTenant(req, next, rows[0].schema_name);
    }

    /**
     * 3) SUBDOMAIN LOOKUP (con Redis cache)
     * Esempio: demo.doflow.it -> subdomain = "demo"
     */
    const subdomain = host.split('.')[0];

    // parole riservate (safe)
    if (['app', 'api', 'www'].includes(subdomain)) {
      return this.attachTenant(req, next, 'public');
    }

    const cacheKey = `tenant:slug:${subdomain}`;
    const cachedSchema = await this.redis.get(cacheKey);

    if (cachedSchema) {
      if (cachedSchema === '__404__') {
        return res.status(404).json({
          error: 'Tenant not found or inactive (cached)',
          tenant: subdomain,
        });
      }
      return this.attachTenant(req, next, cachedSchema);
    }

    const publicDs = await this.getOrCreateConnection('public');
    const rows = await publicDs.query(
      `
      select schema_name
      from public.tenants
      where slug = $1
        and is_active = true
      limit 1
      `,
      [subdomain],
    );

    if (!rows[0]) {
      await this.redis.set(cacheKey, '__404__', 60);
      return res.status(404).json({
        error: 'Tenant not found or inactive',
        tenant: subdomain,
      });
    }

    const schemaName = rows[0].schema_name as string;
    await this.redis.set(cacheKey, schemaName, 60);

    return this.attachTenant(req, next, schemaName);
  }

  // --- Helpers ---

  private async attachTenant(req: Request, next: NextFunction, schema: string) {
    const ds = await this.getOrCreateConnection(schema);
    (req as any).tenantConnection = ds;
    (req as any).tenantId = schema;
    next();
  }

  private async getOrCreateConnection(schema: string): Promise<DataSource> {
    if (TenancyMiddleware.connectionMap.has(schema)) {
      return TenancyMiddleware.connectionMap.get(schema)!;
    }

    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema,
      synchronize: false, // MAI true in SaaS multi-tenant
    });

    await ds.initialize();
    TenancyMiddleware.connectionMap.set(schema, ds);

    console.log(`✅ Tenant connection ready → schema: ${schema}`);
    return ds;
  }
}
