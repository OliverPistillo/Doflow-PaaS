import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum LeadSource {
  META = 'META',
  TIKTOK = 'TIKTOK',
  GOOGLE = 'GOOGLE',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  MANUAL = 'MANUAL',
  OTHER = 'OTHER',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  WON = 'WON',
  LOST = 'LOST',
}

@Entity({ schema: 'public', name: 'leads' })
@Index(['source'])
@Index(['status'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column({ nullable: true })
  email!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  company!: string;

  @Column({ type: 'enum', enum: LeadSource, default: LeadSource.MANUAL })
  source!: LeadSource;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status!: LeadStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  /** Punteggio di qualificazione 0-100 */
  @Column({ type: 'int', default: 0 })
  score!: number;

  /** ID esterno dalla piattaforma (es. Meta Lead ID) */
  @Column({ name: 'external_id', nullable: true })
  externalId!: string;

  /** JSON raw payload dal webhook */
  @Column({ type: 'jsonb', nullable: true, name: 'raw_payload' })
  rawPayload!: Record<string, unknown>;

  /** Eventuale tenant a cui è stato convertito */
  @Column({ name: 'converted_tenant_id', nullable: true })
  convertedTenantId!: string;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
