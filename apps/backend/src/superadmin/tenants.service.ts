import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
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
      // ATTENZIONE: Questo comando crea un "namespace" isolato nel database
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${dto.slug}"`);

      // 4. (Opzionale ma consigliato) Creiamo le tabelle base nel nuovo schema
      // Qui dovresti lanciare le migrazioni. Per semplicità ora creiamo solo una tabella users dummy.
      // In produzione useresti: await runMigrationsForSchema(dto.slug);
      
      // Esempio creazione tabella users minima nel nuovo schema
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
      // Se qualcosa va storto (es. schema già esiste ma tenant no), annulliamo tutto
      await queryRunner.rollbackTransaction();
      console.error("Errore creazione tenant:", err);
      throw new InternalServerErrorException("Errore durante il provisioning del tenant");
    } finally {
      await queryRunner.release();
    }
  }
}