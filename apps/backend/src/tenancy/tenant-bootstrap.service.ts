import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles';
import { RedisService } from '../redis/redis.service';
import { safeSchema } from '../common/schema.utils';

@Injectable()
export class TenantBootstrapService implements OnApplicationBootstrap {
  private readonly logger    = new Logger(TenantBootstrapService.name);
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Avvio app: hydration cache ───────────────────────────────────────────

  async onApplicationBootstrap() {
    await this.hydrateTenantCache();
  }

  async hydrateTenantCache() {
    this.logger.log('Hydrating Tenant Whitelist Cache...');
    try {
      const tenants = await this.dataSource.query(
        `SELECT slug FROM public.tenants WHERE is_active = true`,
      );

      const client   = this.redisService.getClient();
      const pipeline = client.pipeline();

      pipeline.del(this.WHITELIST_KEY);

      if (tenants.length > 0) {
        const slugs = tenants.map((t: any) => t.slug as string);
        pipeline.sadd(this.WHITELIST_KEY, ...slugs);
        this.logger.log(`Loaded ${slugs.length} tenants into Whitelist Cache.`);
      } else {
        this.logger.warn('No active tenants found in DB.');
      }

      await pipeline.exec();
    } catch (e) {
      this.logger.error('Failed to hydrate tenant cache. Fast-404 disabled.', e);
    }
  }

  async addTenantToCache(slug: string) {
    const client = this.redisService.getClient();
    await client.sadd(this.WHITELIST_KEY, slug);
  }

  async removeTenantFromCache(slug: string) {
    const client = this.redisService.getClient();
    await client.srem(this.WHITELIST_KEY, slug);
    await this.redisService.del(`tenant:slug:${slug}`);
  }

  // ── Provisioning schema ──────────────────────────────────────────────────

  async ensureTenantTables(ds: DataSource, schema: string) {
    // FIX: safeSchema unificato — lancia eccezione su slug non valido
    const s = safeSchema(schema, 'TenantBootstrapService.ensureTenantTables');

    this.logger.log(`Provisioning schema: "${s}"`);

    await ds.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`);

    // Tabelle clonate da public (eredita struttura + indici)
    await ds.query(`CREATE TABLE IF NOT EXISTS "${s}".users    (LIKE public.users    INCLUDING ALL)`);
    await ds.query(`CREATE TABLE IF NOT EXISTS "${s}".invites  (LIKE public.invites  INCLUDING ALL)`);
    await ds.query(`CREATE TABLE IF NOT EXISTS "${s}".audit_log(LIKE public.audit_log INCLUDING ALL)`);

    // Tabella file metadata (S3)
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "${s}".files (
        id            SERIAL PRIMARY KEY,
        key           TEXT        NOT NULL,
        original_name TEXT,
        content_type  TEXT,
        size          BIGINT,
        created_by    TEXT,
        created_at    TIMESTAMP   DEFAULT NOW()
      )
    `);

    // Tabella dashboard widgets
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "${s}".dashboard_widgets (
        id         UUID      DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id    UUID      NOT NULL,
        module_key TEXT      NOT NULL,
        x          INTEGER   DEFAULT 0,
        y          INTEGER   DEFAULT 0,
        w          INTEGER   DEFAULT 1,
        h          INTEGER   DEFAULT 1,
        settings   JSONB     DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await ds.query(
      `CREATE INDEX IF NOT EXISTS idx_widgets_user
       ON "${s}".dashboard_widgets(user_id)`,
    );

    this.logger.log(`Schema "${s}" provisioned successfully.`);
  }

  async seedFirstAdmin(ds: DataSource, schema: string, email: string, password: string) {
    const s = safeSchema(schema, 'TenantBootstrapService.seedFirstAdmin');

    const existing = await ds.query(
      `SELECT id FROM "${s}".users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash(password, 12);
    await ds.query(
      `INSERT INTO "${s}".users (email, password_hash, role) VALUES ($1, $2, $3)`,
      [email, passwordHash, 'owner' as Role],
    );
  }
}
