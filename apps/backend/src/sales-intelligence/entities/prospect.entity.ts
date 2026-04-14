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

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true, name: 'job_title' })
  jobTitle?: string;

  @Column({ nullable: true })
  seniority?: string;

  @Column({ nullable: true, name: 'linkedin_url' })
  linkedinUrl?: string;

  @Column({ nullable: true })
  phone?: string;

  @ManyToOne(() => CompanyIntel, { eager: true, nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: CompanyIntel;

  @Column({ name: 'company_id', nullable: true })
  companyId?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_enrichment_data' })
  rawEnrichmentData?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}