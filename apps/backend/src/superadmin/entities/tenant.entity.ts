import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'tenants', schema: 'public' })
@Index(['slug'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string;

  @Column()
  name!: string;

  @Column({ name: 'schema_name' })
  schemaName!: string;

  // --- Campi aggiunti per fixare l'errore 500 ---
  
  @Column({ name: 'contact_email', nullable: true })
  contactEmail!: string;

  @Column({ name: 'vat_number', nullable: true })
  vatNumber!: string;

  @Column({ name: 'admin_email', nullable: true })
  adminEmail!: string;

  // ----------------------------------------------

  @Column({ name: 'plan_tier', default: 'STARTER' })
  planTier!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'max_users', nullable: true, default: 5 })
  maxUsers!: number;

  @Column({ name: 'storage_used_mb', type: 'float', default: 0 })
  storageUsedMb!: number;

  @Column({ name: 'storage_limit_gb', type: 'float', default: 1 })
  storageLimitGb!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}