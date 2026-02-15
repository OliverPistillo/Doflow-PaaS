import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TenantsService {
  private readonly WHITELIST_KEY = 'df:sys:tenant_whitelist';

  constructor(
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
    private dataSource: DataSource, 
    private mailService: MailService,
    private redisService: RedisService,
    private bootstrap: TenantBootstrapService
  ) {}

  // --- LISTA TENANTS ---
  async findAll() {
    return this.tenantsRepo.find({ order: { createdAt: 'DESC' } });
  }

  // --- AGGIORNAMENTO STATO (Sospendi/Attiva + Redis) ---
  async updateStatus(id: string, isActive: boolean) {
    // 1. Verifichiamo che il tenant esista
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${id} non trovato.`);
    }

    // 2. Aggiorniamo solo il campo isActive nel DB
    await this.tenantsRepo.update(id, { isActive });

    // 3. AGGIORNAMENTO REDIS (v3.5)
    // Aggiorniamo la whitelist per il Fast-Path routing
    const client = this.redisService.getClient();
    if (isActive) {
        await client.sadd(this.WHITELIST_KEY, tenant.slug);
    } else {
        await client.srem(this.WHITELIST_KEY, tenant.slug);
    }

    return { 
      message: `Tenant ${isActive ? 'riattivato' : 'sospeso'} con successo`, 
      id, 
      isActive 
    };
  }

  // --- CREAZIONE (CON PROVISIONING, FILES, EMAIL E REDIS) ---
  async create(dto: CreateTenantDto) {
    // 1. Controllo unicità slug
    const existing = await this.tenantsRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Lo slug '${dto.slug}' è già in uso.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Generiamo una password temporanea per l'admin
    const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
    
    // Hash della password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    try {
      // 2. Creiamo il record nel Public Schema (Metadata)
      const newTenant = this.tenantsRepo.create({
        name: dto.name,
        slug: dto.slug,
        schemaName: dto.slug,
        adminEmail: dto.email,
        planTier: dto.plan || 'STARTER',
        isActive: true, 
      });
      
      const savedTenant = await queryRunner.manager.save(newTenant);

      // 3. PROVISIONING v3.5: Usiamo il Bootstrap Service per creare Schema + Tabelle Standard (inclusa "files")
      await this.bootstrap.ensureTenantTables(queryRunner.manager.connection, dto.slug);

      // 4. Creiamo l'utente Admin iniziale (Schema del Tenant)
      await queryRunner.query(`
        INSERT INTO "${dto.slug}"."users" ("email", "role", "password_hash", "is_active", "created_at", "updated_at")
        VALUES ($1, 'admin', $2, true, now(), now())
      `, [dto.email, hashedPassword]);

      // 5. FIX: Inseriamo l'Admin anche in PUBLIC.USERS (Directory Globale)
      // !!! AGGIUNTO IL CAMPO password_hash ANCHE QUI PER EVITARE L'ERRORE NOT NULL !!!
      await queryRunner.query(`
        INSERT INTO public.users ("email", "role", "password_hash", "tenant_id", "is_active", "created_at", "updated_at")
        VALUES ($1, 'admin', $2, $3, true, now(), now())
        ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, password_hash = EXCLUDED.password_hash
      `, [dto.email, hashedPassword, dto.slug]);

      await queryRunner.commitTransaction();

      // 6. AGGIORNAMENTO REDIS (v3.5)
      await this.bootstrap.addTenantToCache(dto.slug);

      // --- 7. INVIO EMAIL DI BENVENUTO (Fuori dalla transazione) ---
      try {
        await this.mailService.sendMail({
          to: dto.email,
          subject: 'Benvenuto in DoFlow - Il tuo spazio è pronto',
          text: `Ciao! Il tuo tenant "${dto.name}" è stato creato con successo.\n\nAccedi qui: https://${dto.slug}.doflow.it\nUsername: ${dto.email}\nPassword Provvisoria: ${tempPassword}\n\nTi consigliamo di cambiare la password al primo accesso.`
        });
        console.log(`📧 Email inviata a ${dto.email}`);
      } catch (mailErr) {
        console.error("⚠️ Tenant creato ma errore invio email:", mailErr);
      }
      
      // Restituiamo anche la password temporanea così il controller può passarla al frontend
      return { 
        ...savedTenant, 
        tempPassword 
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error("Errore creazione tenant:", err);
      throw new InternalServerErrorException("Errore durante il provisioning del tenant");
    } finally {
      await queryRunner.release();
    }
  }

  // --- METODO DELETE ROBUSTO (DB + REDIS) ---
  async delete(id: string) {
    // 1. Trova il tenant per sapere lo slug
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    
    // Se non esiste nel DB principale, restituiamo successo per "idempotenza" 
    if (!tenant) return { message: "Tenant already deleted or not found" };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // 2. TENTATIVO DI ELIMINAZIONE SCHEMA (Connessioni + Dati)
      try {
        await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
      } catch (schemaErr) {
        console.warn(`Attenzione: Impossibile eliminare lo schema fisico "${tenant.schemaName}". Procedo comunque con la rimozione del record.`, schemaErr);
      }

      // 3. ELIMINA IL RECORD DAI METADATI (public.tenants)
      await queryRunner.manager.delete(Tenant, id);

      // 4. RIMOZIONE DA REDIS (v3.5)
      // Rimuoviamo lo slug dalla whitelist per bloccare subito il traffico
      const client = this.redisService.getClient();
      await client.srem(this.WHITELIST_KEY, tenant.slug);

      return { message: "Tenant deleted successfully" };

    } catch (err) {
      console.error("Errore critico eliminazione tenant:", err);
      throw new InternalServerErrorException("Errore durante l'eliminazione del record tenant");
    } finally {
      await queryRunner.release();
    }
  }

  // --- NUOVO: RESET PASSWORD ADMIN (Per il modale del frontend) ---
  async resetAdminPassword(id: string, email: string) {
      const tenant = await this.tenantsRepo.findOne({ where: { id } });
      if (!tenant) throw new NotFoundException();

      const newPass = Math.random().toString(36).slice(-10) + "!!";
      
      const hash = await bcrypt.hash(newPass, 10);
      
      await this.dataSource.query(
          `UPDATE "${tenant.schemaName}".users SET password_hash = $1 WHERE email = $2`,
          [hash, email]
      );

      // Opzionale: sincronizza anche la password dell'utente globale se serve
      await this.dataSource.query(
          `UPDATE public.users SET password_hash = $1 WHERE email = $2`,
          [hash, email]
      );

      return { tempPassword: newPass };
  }
}