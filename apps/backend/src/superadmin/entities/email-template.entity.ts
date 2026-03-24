import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum TemplateCategory {
  ONBOARDING = 'ONBOARDING',
  BILLING = 'BILLING',
  TRIAL_EXPIRY = 'TRIAL_EXPIRY',
  RENEWAL = 'RENEWAL',
  MARKETING = 'MARKETING',
  SYSTEM = 'SYSTEM',
  CUSTOM = 'CUSTOM',
}

@Entity({ schema: 'public', name: 'email_templates' })
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  slug!: string;

  @Column()
  name!: string;

  @Column()
  subject!: string;

  /** HTML body con variabili {{tenantName}}, {{expiryDate}}, etc. */
  @Column({ type: 'text' })
  htmlBody!: string;

  /** Testo plain per fallback */
  @Column({ type: 'text', nullable: true })
  textBody!: string;

  @Column({ type: 'enum', enum: TemplateCategory, default: TemplateCategory.CUSTOM })
  category!: TemplateCategory;

  /** Lista variabili disponibili (es. ["tenantName","expiryDate"]) */
  @Column({ type: 'jsonb', default: '[]' })
  variables!: string[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** Contatore invii */
  @Column({ name: 'send_count', type: 'int', default: 0 })
  sendCount!: number;

  @Column({ name: 'last_sent_at', type: 'timestamp', nullable: true })
  lastSentAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
