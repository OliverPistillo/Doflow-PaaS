// apps/backend/src/sitebuilder/sitebuilder.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DesignTokens, BreakpointConfig, ComponentDefinition, WpData } from './sitebuilder.types';

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

  // ════════════════════════════════════════════════════════════════
  //  DESIGN SYSTEM (nuovi campi)
  // ════════════════════════════════════════════════════════════════
  
  @Column({ type: 'jsonb', name: 'design_scheme', default: {} })
  designScheme!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'design_tokens', default: {} })
  designTokens!: Partial<DesignTokens>;

  @Column({ type: 'jsonb', name: 'global_styles', default: {} })
  globalStyles!: { cssVariables: Record<string, string>; customCSS?: string };

  @Column({ type: 'jsonb', name: 'breakpoints', default: {
    desktop: { minWidth: 1025, label: 'Desktop' },
    tablet: { minWidth: 768, maxWidth: 1024, label: 'Tablet' },
    mobile: { maxWidth: 767, label: 'Mobile' },
  }})
  breakpoints!: BreakpointConfig;

  @Column({ type: 'jsonb', name: 'components', default: [] })
  components!: ComponentDefinition[]; // Componenti usati nel sito

  // ════════════════════════════════════════════════════════════════
  //  CONTENT & STRUCTURE
  // ════════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════════
  //  WP DATA OUTPUT (struttura estesa)
  // ════════════════════════════════════════════════════════════════

  @Column({ type: 'jsonb', name: 'wp_data', nullable: true })
  wpData!: WpData | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}