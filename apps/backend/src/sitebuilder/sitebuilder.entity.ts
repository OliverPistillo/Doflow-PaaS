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

  /** Tipo di business (es. "Ristorante", "eCommerce", "Portfolio") */
  @Column({ type: 'varchar', name: 'business_type', default: 'Business' })
  businessType!: string;

  /** Descrizione del business — usata dall'LLM per generare i testi */
  @Column({ type: 'text', name: 'business_description', nullable: true })
  businessDescription!: string | null;

  /** Slug del tema Blocksy Starter Site selezionato */
  @Column({ type: 'varchar', name: 'starter_site', default: 'business' })
  starterSite!: string;

  /** Palette e font selezionati dall'utente (JSON) */
  @Column({ type: 'jsonb', name: 'design_scheme', default: {} })
  designScheme!: Record<string, unknown>;

  /** Pagine/sezioni da generare */
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

  /** URL del file ZIP scaricabile */
  @Column({ type: 'varchar', name: 'zip_filename', nullable: true })
  zipFilename!: string | null;

  @Column({ type: 'varchar', name: 'site_url', nullable: true })
  siteUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}