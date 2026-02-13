import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TenantBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantBootstrapService.name);
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource 
  ) {}

  // --- v3.5: Caricamento Cache all'avvio ---
  async onApplicationBootstrap() {
    await this.hydrateTenantCache();
  }

  async hydrateTenantCache() {
    this.logger.log('🔄 Hydrating Tenant Whitelist Cache (Fast-Path 404)...');
    try {
      // Recupera tutti gli slug attivi. 
      const tenants = await this.dataSource.query(
        `SELECT slug FROM public.tenants WHERE is_active = true` 
      );

      const client = this.redisService.getClient();
      const pipeline = client.pipeline();
      
      // Pulizia totale e ricaricamento
      pipeline.del(this.WHITELIST_KEY);
      
      if (tenants.length > 0) {
        const slugs = tenants.map((t: any) => t.slug);
        pipeline.sadd(this.WHITELIST_KEY, ...slugs);
        this.logger.log(`✅ Loaded ${slugs.length} tenants into Whitelist Cache.`);
      } else {
        this.logger.warn('⚠️ No active tenants found in DB.');
      }

      await pipeline.exec();
    } catch (e) {
      this.logger.error('❌ Failed to hydrate tenant cache. Fast-404 disabled.', e);
    }
  }

  // Metodo helper per quando crei un nuovo tenant via API
  async addTenantToCache(slug: string) {
      const client = this.redisService.getClient();
      await client.sadd(this.WHITELIST_KEY, slug);
  }

  // --- I tuoi metodi esistenti (Invariati o adattati) ---
  async ensureTenantTables(ds: DataSource, schema: string) {
    await ds.query(`create schema if not exists ${schema}`);
    
    // Tabelle standard clonate da public
    await ds.query(`create table if not exists ${schema}.users (like public.users including all)`);
    await ds.query(`create table if not exists ${schema}.invites (like public.invites including all)`);
    await ds.query(`create table if not exists ${schema}.audit_log (like public.audit_log including all)`);

    // --- NUOVA TABELLA FILES (v3.5 Secure Storage) ---
    // Questa tabella traccia i metadati dei file su S3
    await ds.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.files (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        original_name TEXT,
        content_type TEXT,
        size BIGINT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  async seedFirstAdmin(ds: DataSource, schema: string, email: string, password: string) {
    const existing = await ds.query(
      `select id from ${schema}.users where email = $1 limit 1`,
      [email],
    );
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash(password, 10);
    const role: Role = 'owner' as any; 

    await ds.query(
      `insert into ${schema}.users (email, password_hash, role) values ($1, $2, $3)`,
      [email, passwordHash, role],
    );
  }
}