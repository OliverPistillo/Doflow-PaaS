import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'tenants', schema: 'public' })
@Index(['slug'], { unique: true, where: '"slug" IS NOT NULL' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // nullable: true evita il crash TypeORM se esistono righe con slug = NULL in produzione.
  // Una volta migrati i dati, si può rimettere nullable: false.
  @Column({ unique: true, nullable: true })
  slug!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ name: 'schema_name', nullable: true })
  schemaName!: string;

  // --- Campi opzionali aggiuntivi ---

  @Column({ name: 'contact_email', nullable: true })
  contactEmail!: string;

  @Column({ name: 'vat_number', nullable: true })
  vatNumber!: string;

  @Column({ name: 'admin_email', nullable: true })
  adminEmail!: string;

  // ----------------------------------

  @Column({ name: 'plan_tier', nullable: true, default: 'STARTER' })
  planTier!: string;

  @Column({ name: 'is_active', nullable: true, default: true })
  isActive!: boolean;

  @Column({ name: 'max_users', nullable: true, default: 5 })
  maxUsers!: number;

  @Column({ name: 'storage_used_mb', type: 'float', nullable: true, default: 0 })
  storageUsedMb!: number;

  @Column({ name: 'storage_limit_gb', type: 'float', nullable: true, default: 1 })
  storageLimitGb!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}