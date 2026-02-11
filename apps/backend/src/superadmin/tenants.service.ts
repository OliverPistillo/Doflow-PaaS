import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
    private dataSource: DataSource, // Serve per eseguire SQL raw (CREATE SCHEMA)
  ) {}

  async findAll() {
    return this.tenantsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateTenantDto) {
    // 1. Controllo unicità slug
    const existing = await this.tenantsRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Lo slug '${dto.slug}' è già in uso.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Creiamo il record nel Public Schema (Metadata)
      const newTenant = this.tenantsRepo.create({
        name: dto.name,
        slug: dto.slug,
        schemaName: dto.slug, // Lo schema avrà lo stesso nome dello slug
        adminEmail: dto.email,
        planTier: dto.plan,
      });
      
      const savedTenant = await queryRunner.manager.save(newTenant);

      // 3. PROVISIONING: Creiamo lo Schema Postgres Fisico
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${dto.slug}"`);

      // 4. Esempio creazione tabella users minima nel nuovo schema
      await queryRunner.query(`
        CREATE TABLE "${dto.slug}"."users" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "email" varchar NOT NULL,
            "password" varchar,
            "role" varchar DEFAULT 'admin',
            "created_at" timestamp DEFAULT now()
        );
      `);

      // 5. Creiamo l'utente Admin iniziale nel nuovo schema
      await queryRunner.query(`
        INSERT INTO "${dto.slug}"."users" ("email", "role")
        VALUES ($1, 'admin')
      `, [dto.email]);

      await queryRunner.commitTransaction();
      
      return savedTenant;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error("Errore creazione tenant:", err);
      throw new InternalServerErrorException("Errore durante il provisioning del tenant");
    } finally {
      await queryRunner.release();
    }
  }

  // --- METODO DELETE ROBUSTO ---
  async delete(id: string) {
    // 1. Trova il tenant per sapere lo slug
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    
    // Se non esiste nel DB principale, restituiamo successo per "idempotenza" 
    // (se non c'è, è come se fosse già cancellato)
    if (!tenant) return { message: "Tenant already deleted or not found" };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    // Non usiamo una transazione unica rigida qui, perché vogliamo 
    // che la cancellazione del record avvenga anche se il drop schema fallisce parzialmente.
    
    try {
      // 2. TENTATIVO DI ELIMINAZIONE SCHEMA (Connessioni + Dati)
      try {
        // Opzionale: Termina le connessioni attive a questo DB/Schema (Postgres specifico)
        // Nota: Questo comando varia in base alla versione di PG, ma CASCADE aiuta molto.
        
        // Drop brutale dello schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
      } catch (schemaErr) {
        console.warn(`Attenzione: Impossibile eliminare lo schema fisico "${tenant.schemaName}". Potrebbe non esistere o essere bloccato. Procedo comunque con la rimozione del record.`, schemaErr);
      }

      // 3. ELIMINA IL RECORD DAI METADATI (public.tenants)
      // Lo facciamo DOPO il tentativo di drop schema
      await this.tenantsRepo.delete(id);

      return { message: "Tenant deleted successfully" };

    } catch (err) {
      console.error("Errore critico eliminazione tenant:", err);
      throw new InternalServerErrorException("Errore durante l'eliminazione del tenant");
    } finally {
      await queryRunner.release();
    }
  }
}