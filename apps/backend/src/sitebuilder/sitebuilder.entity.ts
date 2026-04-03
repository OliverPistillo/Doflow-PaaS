// apps/backend/src/sitebuilder/sitebuilder.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// ─────────────────────────────────────────────
//  Enum: stati del job
// ─────────────────────────────────────────────
export enum SitebuilderJobStatus {
  PENDING   = 'PENDING',    // appena creato, in coda
  RUNNING   = 'RUNNING',    // il worker sta lavorando
  DONE      = 'DONE',       // completato con successo
  FAILED    = 'FAILED',     // fallito dopo tutti i retry
  ROLLED_BACK = 'ROLLED_BACK', // cleanup eseguito dopo fallimento
}

// ─────────────────────────────────────────────
//  Entity
// ─────────────────────────────────────────────
@Entity({ schema: 'public', name: 'sitebuilder_jobs' })
@Index(['status'])
@Index(['tenantId'])
export class SitebuilderJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Tenant/cliente per cui viene creato il sito */
  @Column({ name: 'tenant_id' })
  tenantId!: string;

  /** Dominio finale del sito WP (es. "demo.cliente.it") */
  @Column({ name: 'site_domain' })
  siteDomain!: string;

  /** Titolo del sito WordPress */
  @Column({ name: 'site_title' })
  siteTitle!: string;

  /** Email admin WP */
  @Column({ name: 'admin_email' })
  adminEmail!: string;

  /** Temi/argomenti da passare ad Anthropic per la generazione dei contenuti */
  @Column({ type: 'text', array: true, name: 'content_topics' })
  contentTopics!: string[];

  /** Slug dei plugin WP.org da installare (es. ["yoast-seo"]) */
  @Column({ type: 'text', array: true, name: 'plugins', default: '{}' })
  plugins!: string[];

  /** Lingua del sito (default: it) */
  @Column({ default: 'it' })
  locale!: string;

  /** Stato corrente del job */
  @Column({
    type: 'enum',
    enum: SitebuilderJobStatus,
    default: SitebuilderJobStatus.PENDING,
  })
  status!: SitebuilderJobStatus;

  /**
   * Log di esecuzione — array di stringhe append-only.
   * Salvato come JSONB per query flessibili dal superadmin.
   */
  @Column({ type: 'jsonb', default: [] })
  logs!: string[];

  /** Numero di tentativi eseguiti da BullMQ */
  @Column({ name: 'attempt_count', default: 0 })
  attemptCount!: number;

  /** URL del sito una volta completato con successo */
  @Column({ name: 'site_url', nullable: true })
  siteUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}