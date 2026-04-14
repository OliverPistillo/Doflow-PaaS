// apps/backend/src/sales-intelligence/entities/outreach-campaign.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Prospect } from './prospect.entity';

export type CampaignStatus = 'generated' | 'approved' | 'sent' | 'replied' | 'bounced';

export interface PainPoint {
  id: string;
  title: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
  ourSolution: string;
}

export interface OutreachHook {
  angle: 'curiosity' | 'direct' | 'value-first' | 'challenger';
  hook: string;
  whyItWorks: string;
}

export interface EmailVariant {
  variant: 'direct' | 'curiosity' | 'value-first';
  subject: string;
  body: string;
}

export interface StrategicAnalysis {
  painPoints: PainPoint[];
  outreachHooks: OutreachHook[];
  timingRecommendation: string;
  confidenceScore: number;
}

@Entity({ schema: 'public', name: 'si_campaigns' })
export class OutreachCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Prospect, { eager: true })
  @JoinColumn({ name: 'prospect_id' })
  prospect!: Prospect;

  @Column({ name: 'prospect_id' })
  prospectId!: string;

  /** Output step 5 — Gemini analisi strategica */
  @Column({ type: 'jsonb', nullable: true })
  strategicAnalysis?: StrategicAnalysis;

  /** Output step 6 — 3 varianti email generate da Gemini */
  @Column({ type: 'jsonb', default: [] })
  emailVariants!: EmailVariant[];

  @Column({ type: 'varchar', default: 'generated' })
  status!: CampaignStatus;

  /** ID del deal su HubSpot (futuro) */
  @Column({ nullable: true })
  crmDealId?: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  /** BullMQ job ID — utile per debug */
  @Column({ nullable: true })
  jobId?: string;

  @CreateDateColumn()
  generatedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
