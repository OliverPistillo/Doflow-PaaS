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

  // --- NUOVO METODO DELETE ---
  async delete(id: string) {
    // 1. Trova il tenant per sapere lo slug (che è il nome dello schema)
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant non trovato");

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. ELIMINA LO SCHEMA DAL DB (Distruttivo!)
      // CASCADE è fondamentale: rimuove tutte le tabelle e i dati dentro lo schema
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);

      // 3. Elimina il record dai metadati (public.tenants)
      await queryRunner.manager.delete(Tenant, id);

      await queryRunner.commitTransaction();
      return { message: "Tenant deleted successfully" };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error("Errore eliminazione tenant:", err);
      throw new InternalServerErrorException("Errore durante l'eliminazione del tenant");
    } finally {
      await queryRunner.release();
    }
  }
}