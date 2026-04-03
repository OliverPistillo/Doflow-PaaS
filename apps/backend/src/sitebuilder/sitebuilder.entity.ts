// apps/backend/src/sitebuilder/sitebuilder.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
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

  @Column({ type: 'text', array: true, name: 'content_topics' })
  contentTopics!: string[];

  @Column({ type: 'text', array: true, name: 'plugins', default: '{}' })
  plugins!: string[];

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

  // type: 'varchar' esplicito — senza di esso TypeORM inferisce "Object"
  // dal tipo union string | null e lancia DataTypeNotSupportedError
  @Column({ type: 'varchar', name: 'site_url', nullable: true })
  siteUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}