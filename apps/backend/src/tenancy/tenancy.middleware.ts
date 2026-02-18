import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { safeSchema, safeSchemaOrPublic } from '../common/schema.utils';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  /**
   * NOTA ARCHITETTURALE — Connection Pool:
   * L'attuale strategia crea un DataSource separato per ogni schema tenant.
   * Con molti tenant questo può saturare le connessioni PostgreSQL.
   * TODO (v4): Migrare a search_path dinamico su un singolo pool condiviso.
   * Ticket: #DOFLOW-POOL-REFACTOR
   */
  private static connectionMap = new Map<string, DataSource>();
  private readonly logger = new Logger(TenancyMiddleware.name);
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const hdr = (req.headers['x-doflow-tenant-id'] as string | undefined)?.trim();

    // ── Modalità Header (priorità massima) ─────────────────────────────────
    if (hdr && /^[a-z0-9_]+$/i.test(hdr)) {
      const slug = hdr.toLowerCase();

      if (slug === 'public') return this.attachTenant(req, next, 'public');

      const isWhitelisted = await this.checkWhitelist(slug);
      if (!isWhitelisted) {
        return res.status(404).json({ error: 'Tenant not found or inactive', tenant: slug });
      }

      const schema = await this.resolveSlugToSchema(slug, res);
      if (!schema) return; // risposta 404 già inviata
      return this.attachTenant(req, next, schema);
    }

    // ── Modalità Host ───────────────────────────────────────────────────────
    const rawHost = (req.headers['host'] as string | undefined) ?? 'app.doflow.it';
    const host    = rawHost.split(':')[0].toLowerCase();

    const RESERVED_HOSTS = ['localhost', 'app.doflow.it', 'admin.doflow.it', 'api.doflow.it'];
    if (RESERVED_HOSTS.includes(host)) return this.attachTenant(req, next, 'public');

    const APP_DOMAIN    = (process.env.APP_DOMAIN || 'doflow.it').toLowerCase();
    const isSystemDomain = host.endsWith(`.${APP_DOMAIN}`);

    // Custom domain lookup
    if (!isSystemDomain) {
      const publicDs = await this.getOrCreateConnection('public');
      const rows     = await publicDs.query(
        `SELECT t.schema_name
         FROM public.tenant_domains d
         JOIN public.tenants t ON t.slug = d.tenant_slug
         WHERE d.domain = $1 AND t.is_active = true
         LIMIT 1`,
        [host],
      );
      if (!rows[0]) {
        return res.status(404).json({ error: 'Tenant not found for custom domain', domain: host });
      }
      return this.attachTenant(req, next, safeSchemaOrPublic(rows[0].schema_name));
    }

    // Subdomain lookup
    const subdomain = host.split('.')[0];
    if (['app', 'api', 'www'].includes(subdomain)) {
      return this.attachTenant(req, next, 'public');
    }

    const isWhitelisted = await this.checkWhitelist(subdomain);
    if (!isWhitelisted) {
      return res.status(404).json({ error: 'Tenant not found', tenant: subdomain });
    }

    const schema = await this.resolveSlugToSchema(subdomain, res);
    if (!schema) return;
    return this.attachTenant(req, next, schema);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async resolveSlugToSchema(
    slug: string,
    res: Response,
  ): Promise<string | null> {
    const cacheKey    = `tenant:slug:${slug}`;
    const cachedSchema = await this.redis.get(cacheKey);

    if (cachedSchema === '__404__') {
      res.status(404).json({ error: 'Tenant inactive (cached)', tenant: slug });
      return null;
    }
    if (cachedSchema) return cachedSchema;

    const publicDs = await this.getOrCreateConnection('public');
    const rows     = await publicDs.query(
      `SELECT schema_name FROM public.tenants WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug],
    );

    if (!rows[0]) {
      await this.redis.set(cacheKey, '__404__', 60);
      res.status(404).json({ error: 'Tenant not found or inactive', tenant: slug });
      return null;
    }

    // FIX: safeSchema unificato (era duplicato qui con logica leggermente diversa)
    const schemaName = safeSchemaOrPublic(rows[0].schema_name as string);
    await this.redis.set(cacheKey, schemaName, 300); // TTL 5 min (era 60s)
    return schemaName;
  }

  private async checkWhitelist(slug: string): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const exists = await client.sismember(this.WHITELIST_KEY, slug);
      return !!exists;
    } catch (e) {
      this.logger.error('Redis Whitelist Check failed — fail-open', e);
      return true; // fail-open: se Redis è giù, interroghiamo il DB
    }
  }

  private async attachTenant(req: Request, next: NextFunction, schema: string) {
    const ds         = await this.getOrCreateConnection(schema);
    (req as any).tenantConnection = ds;
    (req as any).tenantId         = schema;
    next();
  }

  private async getOrCreateConnection(schema: string): Promise<DataSource> {
    const s = safeSchemaOrPublic(schema);

    if (TenancyMiddleware.connectionMap.has(s)) {
      return TenancyMiddleware.connectionMap.get(s)!;
    }

    const ds = new DataSource({
      type:        'postgres',
      url:         process.env.DATABASE_URL,
      schema:      s,
      synchronize: false,
    });
    await ds.initialize();
    TenancyMiddleware.connectionMap.set(s, ds);
    this.logger.log(`Tenant connection ready → schema: ${s}`);
    return ds;
  }
}
