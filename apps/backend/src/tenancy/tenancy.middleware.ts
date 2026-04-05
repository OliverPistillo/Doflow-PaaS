import { Injectable, NestMiddleware, Logger, OnModuleDestroy } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { safeSchemaOrPublic } from '../common/schema.utils';

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITETTURA POOL — v4 (search_path dinamico, pool condiviso)
//
// PROBLEMA PRECEDENTE:
//   Un DataSource separato per ogni schema tenant.
//   TypeORM apre 10 connessioni per DataSource → 20 tenant = 200 connessioni.
//   PostgreSQL default max_connections = 100 → overflow garantito.
//
// SOLUZIONE:
//   Un singolo DataSource condiviso (MAX_POOL_SIZE connessioni totali).
//   Per ogni request tenant, un proxy sovrascrive .query() iniettando
//   SET LOCAL search_path all'interno di una transazione implicita.
//   SET LOCAL è confinato alla transazione: la connessione torna al pool
//   pulita, senza search_path residuo per la richiesta successiva.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POOL_SIZE = 20;

@Injectable()
export class TenancyMiddleware implements NestMiddleware, OnModuleDestroy {
  private readonly logger        = new Logger(TenancyMiddleware.name);
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  private static sharedPool:      DataSource | null          = null;
  private static poolInitPromise: Promise<DataSource> | null = null;
  private static proxyMap = new Map<string, DataSource>();

  constructor(private readonly redis: RedisService) {}

  // ── Pool condiviso ───────────────────────────────────────────────────────

  private async getSharedPool(): Promise<DataSource> {
    if (TenancyMiddleware.sharedPool?.isInitialized) {
      return TenancyMiddleware.sharedPool;
    }

    if (!TenancyMiddleware.poolInitPromise) {
      TenancyMiddleware.poolInitPromise = (async () => {
        const ds = new DataSource({
          type:        'postgres',
          url:         process.env.DATABASE_URL,
          synchronize: false,
          extra: {
            max:                     MAX_POOL_SIZE,
            idleTimeoutMillis:       30_000,
            connectionTimeoutMillis:  5_000,
          },
        });
        await ds.initialize();
        this.logger.log(`Shared pool initialized — max ${MAX_POOL_SIZE} connections`);
        TenancyMiddleware.sharedPool = ds;
        return ds;
      })();
    }

    return TenancyMiddleware.poolInitPromise;
  }

  // ── Proxy per schema ─────────────────────────────────────────────────────
  //
  // Non apre nuove connessioni: preleva una connessione dal pool condiviso,
  // imposta SET LOCAL search_path (valido solo per la transazione corrente),
  // esegue la query, commit, restituisce la connessione al pool.

  private async getProxyForSchema(schema: string): Promise<DataSource> {
    const s = safeSchemaOrPublic(schema);

    if (TenancyMiddleware.proxyMap.has(s)) {
      return TenancyMiddleware.proxyMap.get(s)!;
    }

    const pool  = await this.getSharedPool();
    const proxy = Object.create(pool) as DataSource;

    proxy.query = async (sql: string, params?: any[]) => {
      const qr = pool.createQueryRunner();
      await qr.connect();
      try {
        await qr.startTransaction();
        await qr.query(`SET LOCAL search_path TO "${s}", public`);
        const result = await qr.query(sql, params);
        await qr.commitTransaction();
        return result;
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
    };

    TenancyMiddleware.proxyMap.set(s, proxy);
    this.logger.log(`Proxy registered → schema: ${s}`);
    return proxy;
  }

  // ── Middleware entry ─────────────────────────────────────────────────────

  async use(req: Request, res: Response, next: NextFunction) {
    const hdr = (req.headers['x-doflow-tenant-id'] as string | undefined)?.trim();

    // Modalità Header (priorità massima)
    // Nota: /^[a-z0-9_.]+$/i — il punto è ammesso per slug legacy tipo 'op1.servizi'
    if (hdr && /^[a-z0-9_.]+$/i.test(hdr)) {
      const slug = hdr.toLowerCase();

      if (slug === 'public') return this.attachTenant(req, next, 'public');

      const isWhitelisted = await this.checkWhitelist(slug);
      if (!isWhitelisted) {
        return res.status(404).json({ error: 'Tenant not found or inactive', tenant: slug });
      }

      const schema = await this.resolveSlugToSchema(slug, res);
      if (!schema) return;
      return this.attachTenant(req, next, schema);
    }

    // Modalità Host
    const rawHost = (req.headers['host'] as string | undefined) ?? 'app.doflow.it';
    const host    = rawHost.split(':')[0].toLowerCase();

    const RESERVED_HOSTS = ['localhost', 'app.doflow.it', 'admin.doflow.it', 'api.doflow.it'];
    if (RESERVED_HOSTS.includes(host)) return this.attachTenant(req, next, 'public');

    const APP_DOMAIN     = (process.env.APP_DOMAIN || 'doflow.it').toLowerCase();
    const isSystemDomain = host.endsWith(`.${APP_DOMAIN}`);

    // Custom domain lookup
    if (!isSystemDomain) {
      const pool = await this.getSharedPool();
      const rows = await pool.query(
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

  private async resolveSlugToSchema(slug: string, res: Response): Promise<string | null> {
    const cacheKey     = `tenant:slug:${slug}`;
    const cachedSchema = await this.redis.get(cacheKey);

    if (cachedSchema === '__404__') {
      res.status(404).json({ error: 'Tenant inactive (cached)', tenant: slug });
      return null;
    }
    if (cachedSchema) return cachedSchema;

    const pool = await this.getSharedPool();
    const rows = await pool.query(
      `SELECT schema_name FROM public.tenants WHERE slug = $1 AND is_active = true LIMIT 1`,
      [slug],
    );

    if (!rows[0]) {
      await this.redis.set(cacheKey, '__404__', 60);
      res.status(404).json({ error: 'Tenant not found or inactive', tenant: slug });
      return null;
    }

    const schemaName = safeSchemaOrPublic(rows[0].schema_name as string);
    await this.redis.set(cacheKey, schemaName, 300);
    return schemaName;
  }

  private async checkWhitelist(slug: string): Promise<boolean> {
    try {
      const exists = await this.redis.getClient().sismember(this.WHITELIST_KEY, slug);
      return !!exists;
    } catch (e) {
      this.logger.error('Redis Whitelist Check failed — fail-open', e);
      return true;
    }
  }

  private async attachTenant(req: Request, next: NextFunction, schema: string) {
    const proxy = await this.getProxyForSchema(schema);
    (req as any).tenantConnection = proxy;
    (req as any).tenantId         = safeSchemaOrPublic(schema);
    next();
  }

  // ── Cleanup all'arresto del server ───────────────────────────────────────

  async onModuleDestroy() {
    if (TenancyMiddleware.sharedPool?.isInitialized) {
      await TenancyMiddleware.sharedPool.destroy();
      TenancyMiddleware.sharedPool     = null;
      TenancyMiddleware.poolInitPromise = null;
      TenancyMiddleware.proxyMap.clear();
      this.logger.log('Shared pool destroyed');
    }
  }
}