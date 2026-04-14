// apps/backend/src/sales-intelligence/entities/prospect.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { CompanyIntel } from './company-intel.entity';

@Entity({ schema: 'public', name: 'si_prospects' })
export class Prospect {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  jobTitle?: string;

  @Column({ nullable: true })
  seniority?: string;

  @Column({ nullable: true })
  linkedinUrl?: string;

  @Column({ nullable: true })
  phone?: string;

  @ManyToOne(() => CompanyIntel, { eager: true, nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: CompanyIntel;

  @Column({ name: 'company_id', nullable: true })
  companyId?: string;

  /** JSON grezzo dall'API di enrichment (RocketReach / Apollo) */
  @Column({ type: 'jsonb', nullable: true })
  rawEnrichmentData?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
