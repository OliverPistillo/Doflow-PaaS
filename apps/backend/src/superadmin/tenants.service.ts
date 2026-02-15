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

  // --- AGGIORNAMENTO STATO ---
  async updateStatus(id: string, isActive: boolean) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${id} non trovato.`);
    }

    await this.tenantsRepo.update(id, { isActive });

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

  // --- CREAZIONE ---
  async create(dto: CreateTenantDto) {
    const existing = await this.tenantsRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Lo slug '${dto.slug}' è già in uso.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    try {
      // 1. Creazione Metadata Tenant (Public)
      const newTenant = this.tenantsRepo.create({
        name: dto.name,
        slug: dto.slug,
        schemaName: dto.slug,
        adminEmail: dto.email,
        planTier: dto.plan || 'STARTER',
        isActive: true, 
      });
      
      const savedTenant = await queryRunner.manager.save(newTenant);

      // 2. Provisioning DB (Schema Tenant)
      await this.bootstrap.ensureTenantTables(queryRunner.manager.connection, dto.slug);

      // 3. Creazione Admin nel Tenant Schema (Usa lo slug come nome schema)
      await queryRunner.query(`
        INSERT INTO "${dto.slug}"."users" ("email", "role", "password_hash", "is_active", "created_at", "updated_at")
        VALUES ($1, 'admin', $2, true, now(), now())
      `, [dto.email, hashedPassword]);

      // 4. Creazione Admin nel Public Schema (Directory Globale)
      // FIX CRITICO: Usiamo savedTenant.id (UUID) invece di dto.slug per il tenant_id.
      // Questo garantisce che il Login riesca a fare la JOIN corretta con la tabella tenants.
      await queryRunner.query(`
        INSERT INTO public.users ("email", "role", "password_hash", "tenant_id", "is_active", "created_at", "updated_at")
        VALUES ($1, 'admin', $2, $3, true, now(), now())
        ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, password_hash = EXCLUDED.password_hash
      `, [dto.email, hashedPassword, savedTenant.id]); // <--- QUI USIAMO L'UUID

      await queryRunner.commitTransaction();

      // 5. Aggiornamento Cache
      await this.bootstrap.addTenantToCache(dto.slug);

      // --- 6. INVIO EMAIL (Formattata e corretta) ---
      try {
        const loginUrl = "https://app.doflow.it/login";
        
        const htmlContent = `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #4f46e5;">Benvenuto in DoFlow! 🚀</h2>
            <p>Ciao,</p>
            <p>Il tuo spazio di lavoro <strong>${dto.name}</strong> è stato configurato con successo.</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>URL Accesso:</strong> <a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a></p>
              <p style="margin: 5px 0;"><strong>Username:</strong> ${dto.email}</p>
              <p style="margin: 5px 0;"><strong>Password Provvisoria:</strong> <code style="background: #eef2ff; padding: 2px 5px; border-radius: 4px; color: #4338ca;">${tempPassword}</code></p>
            </div>

            <p style="font-size: 13px; color: #666;">
              ⚠️ Per la tua sicurezza, ti chiediamo di modificare la password al primo accesso.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Team DoFlow</p>
          </div>
        `;

        await this.mailService.sendMail({
          to: dto.email,
          subject: `Benvenuto in DoFlow - Accesso per ${dto.name}`,
          html: htmlContent,
          text: `Benvenuto! Il tuo tenant ${dto.name} è pronto.\nAccedi su: ${loginUrl}\nUser: ${dto.email}\nPass: ${tempPassword}`
        });
        
        console.log(`📧 Email inviata a ${dto.email}`);
      } catch (mailErr) {
        console.error("⚠️ Tenant creato ma errore invio email:", mailErr);
      }
      
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

  // --- DELETE ---
  async delete(id: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) return { message: "Tenant already deleted or not found" };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      try {
        await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
      } catch (schemaErr) {
        console.warn(`Attenzione: Impossibile eliminare schema "${tenant.schemaName}".`, schemaErr);
      }

      await queryRunner.manager.delete(Tenant, id);

      const client = this.redisService.getClient();
      await client.srem(this.WHITELIST_KEY, tenant.slug);

      return { message: "Tenant deleted successfully" };

    } catch (err) {
      console.error("Errore eliminazione tenant:", err);
      throw new InternalServerErrorException("Errore durante l'eliminazione");
    } finally {
      await queryRunner.release();
    }
  }

  // --- RESET PASSWORD ---
  async resetAdminPassword(id: string, email: string) {
      const tenant = await this.tenantsRepo.findOne({ where: { id } });
      if (!tenant) throw new NotFoundException();

      const newPass = Math.random().toString(36).slice(-10) + "!!";
      const hash = await bcrypt.hash(newPass, 10);
      
      // Aggiorna nel tenant
      await this.dataSource.query(
          `UPDATE "${tenant.schemaName}".users SET password_hash = $1 WHERE email = $2`,
          [hash, email]
      );

      // Aggiorna nel globale
      await this.dataSource.query(
          `UPDATE public.users SET password_hash = $1 WHERE email = $2`,
          [hash, email]
      );

      return { tempPassword: newPass };
  }
}