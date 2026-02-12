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
    private dataSource: DataSource, // Serve per eseguire SQL raw (CREATE/DROP SCHEMA)
  ) {}

  // --- LISTA TENANTS ---
  async findAll() {
    return this.tenantsRepo.find({ order: { createdAt: 'DESC' } });
  }

  // --- NUOVO METODO: AGGIORNAMENTO STATO (Sospendi/Attiva) ---
  async updateStatus(id: string, isActive: boolean) {
    // 1. Verifichiamo che il tenant esista
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${id} non trovato.`);
    }

    // 2. Aggiorniamo solo il campo isActive
    // Usiamo update invece di save per essere più efficienti e non toccare altri campi
    await this.tenantsRepo.update(id, { isActive });

    return { 
      message: `Tenant ${isActive ? 'riattivato' : 'sospeso'} con successo`, 
      id, 
      isActive 
    };
  }

  // --- CREAZIONE (CON PROVISIONING) ---
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
        planTier: dto.plan || 'STARTER',
        isActive: true, // Importante: nasce attivo!
      });
      
      const savedTenant = await queryRunner.manager.save(newTenant);

      // 3. PROVISIONING: Creiamo lo Schema Postgres Fisico
      // ATTENZIONE: Questo comando crea un "namespace" isolato nel database
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${dto.slug}"`);

      // 4. Creiamo le tabelle base nel nuovo schema
      // Esempio creazione tabella users minima nel nuovo schema
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${dto.slug}"."users" (
            "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
            "email" character varying NOT NULL,
            "password" character varying,
            "role" character varying DEFAULT 'admin',
            "created_at" timestamp without time zone DEFAULT now()
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
      // Se qualcosa va storto (es. schema già esiste ma tenant no), annulliamo tutto
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
    if (!tenant) return { message: "Tenant already deleted or not found" };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // 2. TENTATIVO DI ELIMINAZIONE SCHEMA (Connessioni + Dati)
      try {
        // Tenta di eliminare lo schema fisico e tutti i suoi dati (CASCADE)
        await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
      } catch (schemaErr) {
        console.warn(`Attenzione: Impossibile eliminare lo schema fisico "${tenant.schemaName}". Procedo comunque con la rimozione del record.`, schemaErr);
      }

      // 3. ELIMINA IL RECORD DAI METADATI (public.tenants)
      await queryRunner.manager.delete(Tenant, id);

      return { message: "Tenant deleted successfully" };

    } catch (err) {
      console.error("Errore critico eliminazione tenant:", err);
      throw new InternalServerErrorException("Errore durante l'eliminazione del record tenant");
    } finally {
      await queryRunner.release();
    }
  }
}