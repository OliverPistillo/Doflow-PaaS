// apps/backend/src/sitebuilder/sitebuilder.entity.ts

import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum SitebuilderJobStatus {
  PENDING     = 'PENDING',
  RUNNING     = 'RUNNING',
  DONE        = 'DONE',
  FAILED      = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

@Entity({ schema: 'public', name: 'sitebuilder_jobs' })
@Index(['status'])
@Index(['tenantId'])
@Index(['importToken'], { unique: true, where: '"import_token" IS NOT NULL' })
export class SitebuilderJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', name: 'site_domain' })
  siteDomain!: string;

  @Column({ type: 'varchar', name: 'site_title' })
  siteTitle!: string;

  @Column({ type: 'varchar', name: 'admin_email' })
  adminEmail!: string;

  @Column({ type: 'varchar', name: 'business_type', default: 'Business' })
  businessType!: string;

  @Column({ type: 'text', name: 'business_description', nullable: true })
  businessDescription!: string | null;

  @Column({ type: 'varchar', name: 'starter_site', default: 'business' })
  starterSite!: string;

  @Column({ type: 'jsonb', name: 'design_scheme', default: {} })
  designScheme!: Record<string, unknown>;

  // BUG FIX: rimosso doppio ;; a riga 55
  @Column({ type: 'text', array: true, name: 'content_topics' })
  contentTopics!: string[];

  @Column({ type: 'varchar', default: 'it' })
  locale!: string;

  @Column({
    type: 'enum',
    enum: SitebuilderJobStatus,
    default: SitebuilderJobStatus.PENDING,
  })
  status!: SitebuilderJobStatus;

  @Column({ type: 'jsonb', default: [] })
  logs!: string[];

  @Column({ type: 'int', name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ type: 'varchar', name: 'zip_filename', nullable: true })
  zipFilename!: string | null;

  @Column({ type: 'varchar', name: 'site_url', nullable: true })
  siteUrl!: string | null;

  @Column({ type: 'varchar', name: 'import_token', nullable: true, unique: true })
  importToken!: string | null;

  @Column({ type: 'jsonb', name: 'wp_data', nullable: true })
  wpData!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}