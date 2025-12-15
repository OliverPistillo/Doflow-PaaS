import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service'; // Assicurati che il path sia corretto

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  // Manteniamo la mappa statica per condividere le connessioni tra le richieste
  private static connectionMap = new Map<string, DataSource>();

  // Iniettiamo RedisService
  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const rawHost =
      (req.headers['x-doflow-tenant-id'] as string) ||
      (req.headers['host'] as string) ||
      'app.doflow.it';

    // Pulisci host (rimuovi porta)
    const host = rawHost.split(':')[0].toLowerCase();

    // 1. Gestione domini riservati / Localhost (vanno sempre su 'public')
    // Se siamo su localhost puro o su app/api.doflow.it -> Public
    if (host === 'localhost' || host === 'app.doflow.it' || host === 'api.doflow.it') {
      return this.attachTenant(req, next, 'public');
    }

    // Identifichiamo se è un dominio di sistema (.doflow.it) o un dominio custom
    const APP_DOMAIN = process.env.APP_DOMAIN || 'doflow.it';
    const isSystemDomain = host.endsWith(`.${APP_DOMAIN}`);

    // 2. CUSTOM DOMAIN LOOKUP
    // Se NON finisce con .doflow.it, è un dominio personalizzato (es. portale.azienda.com)
    if (!isSystemDomain) {
      const publicDs = await this.getOrCreateConnection('public');

      // Cerchiamo a quale tenant corrisponde questo dominio
      const rows = await publicDs.query(
        `
        select t.schema_name
        from public.tenant_domains d
        join public.tenants t on t.slug = d.tenant_slug
        where d.domain = $1 and t.is_active = true
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

      // Trovato! Attacchiamo il tenant
      return this.attachTenant(req, next, rows[0].schema_name);
    }

    // 3. SUBDOMAIN LOOKUP (con REDIS CACHE)
    // Se arriviamo qui, siamo su *.doflow.it. Estraiamo il terzo livello.
    const subdomain = host.split('.')[0];

    // Check rapido parole riservate (ridondante col punto 1 ma safe)
    if (['app', 'api', 'www'].includes(subdomain)) {
      return this.attachTenant(req, next, 'public');
    }

    // -- REDIS CACHE CHECK --
    const cacheKey = `tenant:slug:${subdomain}`;
    const cachedSchema = await this.redis.get(cacheKey);

    if (cachedSchema) {
      if (cachedSchema === '__404__') {
        // Cache hit negativa: sappiamo già che non esiste
        return res.status(404).json({
          error: 'Tenant not found or inactive (cached)',
          tenant: subdomain,
        });
      }
      // Cache hit positiva: abbiamo lo schema
      return this.attachTenant(req, next, cachedSchema);
    }

    // -- DB LOOKUP (Cache Miss) --
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
      // Tenant non esiste: cache negativa per evitare hammering sul DB
      await this.redis.set(cacheKey, '__404__', 60); // 60 secondi TTL
      return res.status(404).json({
        error: 'Tenant not found or inactive',
        tenant: subdomain,
      });
    }

    const schemaName = rows[0].schema_name;
    
    // Tenant esiste: cache positiva
    await this.redis.set(cacheKey, schemaName, 60); // 60 secondi TTL

    return this.attachTenant(req, next, schemaName);
  }

  // --- Helper Methods ---

  private async attachTenant(
    req: Request,
    next: NextFunction,
    schema: string,
  ) {
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
      synchronize: false, // ⚠️ MAI true in SaaS multi-tenant
    });

    await ds.initialize();
    TenancyMiddleware.connectionMap.set(schema, ds);

    console.log(`✅ Tenant connection ready → schema: ${schema}`);
    return ds;
  }
}