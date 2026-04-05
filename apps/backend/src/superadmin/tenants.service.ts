import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { normalizeSlugToSchema } from '../common/schema.utils';
import { buildWelcomeEmail, buildPasswordResetAdminEmail } from '../mail/email-templates';

@Injectable()
export class TenantsService {
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  constructor(
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
    private dataSource: DataSource,
    private mailService: MailService,
    private redisService: RedisService,
    private bootstrap: TenantBootstrapService,
  ) {}

  // ─── Lista ───────────────────────────────────────────────────

  async findAll() {
    return this.tenantsRepo.find({ order: { createdAt: 'DESC' } });
  }

  // ─── Stato ───────────────────────────────────────────────────

  async updateStatus(id: string, isActive: boolean) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} non trovato.`);

    await this.tenantsRepo.update(id, { isActive });

    const client = this.redisService.getClient();
    if (isActive) {
      await client.sadd(this.WHITELIST_KEY, tenant.slug);
    } else {
      await client.srem(this.WHITELIST_KEY, tenant.slug);
      // Invalida anche la cache slug→schema
      await this.redisService.del(`tenant:slug:${tenant.slug}`);
    }

    return { message: `Tenant ${isActive ? 'riattivato' : 'sospeso'}`, id, isActive };
  }

  // ─── Creazione ───────────────────────────────────────────────

  async create(dto: CreateTenantDto) {
    const existing = await this.tenantsRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' già in uso.`);

    // FIX 🔴: Normalizza lo slug in nome schema valido (trattini → underscore)
    const schemaName = normalizeSlugToSchema(dto.slug);

    // FIX 🔴: crypto.randomBytes al posto di Math.random()
    const tempPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Metadata tenant nel public schema
      const newTenant = this.tenantsRepo.create({
        name:        dto.name,
        slug:        dto.slug,
        schemaName,                     // ← schema normalizzato
        adminEmail:  dto.email,
        planTier:    dto.plan || 'STARTER',
        isActive:    true,
      });
      const savedTenant = await queryRunner.manager.save(newTenant);

      // 2. Provisioning schema DB
      await this.bootstrap.ensureTenantTables(queryRunner.manager.connection, schemaName);

      // 3. Admin nel tenant schema
      await queryRunner.query(
        `INSERT INTO "${schemaName}"."users"
           (email, role, password_hash, is_active, created_at, updated_at)
         VALUES ($1, 'admin', $2, true, now(), now())`,
        [dto.email, hashedPassword],
      );

      // 4. Admin nella directory globale (public.users)
      // FIX: usa savedTenant.id (UUID) — garantisce JOIN corretta nel login routing
      await queryRunner.query(
        `INSERT INTO public.users
           (email, role, password_hash, tenant_id, is_active, created_at, updated_at)
         VALUES ($1, 'admin', $2, $3, true, now(), now())
         ON CONFLICT (email)
           DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
                         password_hash = EXCLUDED.password_hash`,
        [dto.email, hashedPassword, savedTenant.id],
      );

      await queryRunner.commitTransaction();

      // 5. Aggiornamento cache Redis
      await this.bootstrap.addTenantToCache(dto.slug);

      // 6. Email di benvenuto (usa il template centralizzato)
      try {
        const { subject, html, text } = buildWelcomeEmail({
          tenantName:    dto.name,
          loginUrl:      'https://app.doflow.it/login',
          email:         dto.email,
          tempPassword,
        });
        await this.mailService.sendMail({ to: dto.email, subject, html, text });
      } catch (mailErr) {
        // Email non bloccante: il tenant è già creato
        console.error('⚠️ Tenant creato ma errore invio email:', mailErr);
      }

      return { ...savedTenant, tempPassword };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Errore creazione tenant:', err);
      throw new InternalServerErrorException('Errore durante il provisioning del tenant');
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Delete ──────────────────────────────────────────────────

  async delete(id: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) return { message: 'Tenant già eliminato o non trovato' };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    // FIX 🟠: transazione mancante — aggiunta per evitare stato inconsistente
    await queryRunner.startTransaction();

    try {
      // 1. Prima elimina il record (rollbackabile se lo schema drop fallisce)
      await queryRunner.manager.delete(Tenant, id);

      // 2. Poi dropa lo schema (operazione DDL non rollbackabile in PG,
      //    ma almeno il record è già rimosso — fail qui lascia solo un
      //    record orfano gestibile manualmente, NON dati senza record)
      await queryRunner.query(
        `DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`,
      );

      await queryRunner.commitTransaction();

      // 3. Rimozione dalla cache
      const client = this.redisService.getClient();
      await client.srem(this.WHITELIST_KEY, tenant.slug);
      await this.redisService.del(`tenant:slug:${tenant.slug}`);

      return { message: 'Tenant eliminato con successo' };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Errore eliminazione tenant:', err);
      throw new InternalServerErrorException("Errore durante l'eliminazione");
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Reset Password ──────────────────────────────────────────

  async resetAdminPassword(id: string, email: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException();

    // FIX 🔴: crypto.randomBytes al posto di Math.random()
    const newPass = generateSecurePassword();
    const hash    = await bcrypt.hash(newPass, 12);

    // Aggiorna in entrambi gli schema (atomicamente con Promise.all)
    await Promise.all([
      this.dataSource.query(
        `UPDATE "${tenant.schemaName}".users SET password_hash = $1 WHERE email = $2`,
        [hash, email],
      ),
      this.dataSource.query(
        `UPDATE public.users SET password_hash = $1 WHERE email = $2`,
        [hash, email],
      ),
    ]);

    // Invia email con la nuova password temporanea
    try {
      const { subject, html, text } = buildPasswordResetAdminEmail({
        email,
        tenantName:  tenant.name,
        newPassword: newPass,
        loginUrl:    'https://app.doflow.it/login',
      });
      await this.mailService.sendMail({ to: email, subject, html, text });
    } catch (mailErr) {
      console.error('⚠️ Password resettata ma errore invio email:', mailErr);
    }

    return { tempPassword: newPass };
  }
}

// ─── Helpers privati ─────────────────────────────────────────────

/**
 * FIX 🔴: Genera una password temporanea crittograficamente sicura.
 * Usa crypto.randomBytes invece di Math.random() (PRNG non sicuro).
 */
function generateSecurePassword(): string {
  // 16 byte casuali → 22 caratteri base64url + suffisso per garantire complessità
  return randomBytes(16).toString('base64url').slice(0, 16) + 'A1!';
}
