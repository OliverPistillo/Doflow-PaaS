import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'tenants', schema: 'public' }) // Importante: sta sempre nello schema public
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string; // Es: "pizzeria-da-mario" (diventerà il nome dello schema DB)

  @Column()
  name!: string; // Es: "Pizzeria Da Mario"

  @Column({ name: 'admin_email' })
  adminEmail!: string;

  @Column({ name: 'schema_name' })
  schemaName!: string; // Solitamente uguale allo slug

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