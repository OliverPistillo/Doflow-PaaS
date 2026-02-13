import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private static connectionMap = new Map<string, DataSource>();
  private readonly logger = new Logger(TenancyMiddleware.name);
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist'; // v3.5 Whitelist

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const hdr = (req.headers['x-doflow-tenant-id'] as string | undefined)?.trim();

    /**
     * 0) HEADER SLUG-ONLY MODE
     */
    if (hdr && /^[a-z0-9_]+$/i.test(hdr)) {
      const slugOrPublic = hdr.toLowerCase();

      if (slugOrPublic === 'public') {
        return this.attachTenant(req, next, 'public');
      }

      // --- v3.5 FAST-PATH CHECK ---
      const isWhitelisted = await this.checkWhitelist(slugOrPublic);
      if (!isWhitelisted) {
        return res.status(404).json({
          error: 'Tenant not found or inactive (Fast-Path)',
          tenant: slugOrPublic,
        });
      }
      // ----------------------------

      const cacheKey = `tenant:slug:${slugOrPublic}`;
      const cachedSchema = await this.redis.get(cacheKey);

      if (cachedSchema) {
        if (cachedSchema === '__404__') {
          return res.status(404).json({ error: 'Tenant inactive (cached)', tenant: slugOrPublic });
        }
        return this.attachTenant(req, next, cachedSchema);
      }

      const publicDs = await this.getOrCreateConnection('public');
      const rows = await publicDs.query(
        `select schema_name from public.tenants where slug = $1 and is_active = true limit 1`,
        [slugOrPublic],
      );

      if (!rows[0]) {
        await this.redis.set(cacheKey, '__404__', 60);
        return res.status(404).json({ error: 'Tenant not found or inactive', tenant: slugOrPublic });
      }

      const schemaName = safeSchema(rows[0].schema_name as string);
      await this.redis.set(cacheKey, schemaName, 60);
      return this.attachTenant(req, next, schemaName);
    }

    /**
     * 1) HOST MODE (fallback)
     */
    const rawHost = hdr || (req.headers['host'] as string | undefined) || 'app.doflow.it';
    const host = rawHost.split(':')[0].toLowerCase();

    // Reserved / Local
    if (
      host === 'localhost' ||
      host === 'app.doflow.it' ||
      host === 'admin.doflow.it' || 
      host === 'api.doflow.it'
    ) {
      return this.attachTenant(req, next, 'public');
    }

    const APP_DOMAIN = (process.env.APP_DOMAIN || 'doflow.it').toLowerCase();
    const isSystemDomain = host.endsWith(`.${APP_DOMAIN}`);

    /**
     * 2) CUSTOM DOMAIN LOOKUP (optional)
     */
    if (!isSystemDomain) {
      const publicDs = await this.getOrCreateConnection('public');
      const rows = await publicDs.query(
        `select t.schema_name from public.tenant_domains d 
         join public.tenants t on t.slug = d.tenant_slug 
         where d.domain = $1 and t.is_active = true limit 1`,
        [host],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: 'Tenant not found for custom domain', domain: host });
      }
      return this.attachTenant(req, next, safeSchema(rows[0].schema_name));
    }

    /**
     * 3) SUBDOMAIN LOOKUP (con Redis cache + v3.5 Whitelist)
     */
    const subdomain = host.split('.')[0];
    if (['app', 'api', 'www'].includes(subdomain)) {
      return this.attachTenant(req, next, 'public');
    }

    // --- v3.5 FAST-PATH CHECK ---
    const isWhitelisted = await this.checkWhitelist(subdomain);
    if (!isWhitelisted) {
      return res.status(404).json({
        error: 'Tenant not found (Fast-Path)',
        tenant: subdomain,
      });
    }
    // ----------------------------

    const cacheKey = `tenant:slug:${subdomain}`;
    const cachedSchema = await this.redis.get(cacheKey);

    if (cachedSchema) {
      if (cachedSchema === '__404__') {
        return res.status(404).json({ error: 'Tenant inactive (cached)', tenant: subdomain });
      }
      return this.attachTenant(req, next, cachedSchema);
    }

    const publicDs = await this.getOrCreateConnection('public');
    const rows = await publicDs.query(
      `select schema_name from public.tenants where slug = $1 and is_active = true limit 1`,
      [subdomain],
    );

    if (!rows[0]) {
      await this.redis.set(cacheKey, '__404__', 60);
      return res.status(404).json({ error: 'Tenant not found or inactive', tenant: subdomain });
    }

    const schemaName = safeSchema(rows[0].schema_name as string);
    await this.redis.set(cacheKey, schemaName, 60);
    return this.attachTenant(req, next, schemaName);
  }

  // --- v3.5 HELPER: Controllo Whitelist ---
  private async checkWhitelist(slug: string): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const exists = await client.sismember(this.WHITELIST_KEY, slug);
      return !!exists;
    } catch (e) {
      this.logger.error('Redis Whitelist Check failed', e);
      return true; // Fail-open: se Redis ha problemi, interroghiamo il DB per sicurezza
    }
  }

  private async attachTenant(req: Request, next: NextFunction, schema: string) {
    const ds = await this.getOrCreateConnection(schema);
    (req as any).tenantConnection = ds;
    (req as any).tenantId = schema;
    next();
  }

  private async getOrCreateConnection(schema: string): Promise<DataSource> {
    const s = safeSchema(schema);
    if (TenancyMiddleware.connectionMap.has(s)) {
      return TenancyMiddleware.connectionMap.get(s)!;
    }
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: s,
      synchronize: false,
    });
    await ds.initialize();
    TenancyMiddleware.connectionMap.set(s, ds);
    this.logger.log(`✅ Tenant connection ready → schema: ${s}`);
    return ds;
  }
}