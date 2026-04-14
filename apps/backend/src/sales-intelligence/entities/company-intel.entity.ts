// apps/backend/src/sales-intelligence/entities/company-intel.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ schema: 'public', name: 'si_companies' })
@Index(['domain'], { unique: true })
export class CompanyIntel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  domain!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true, name: 'employee_count' })
  employeeCount?: number;

  @Column({ nullable: true, name: 'annual_revenue' })
  annualRevenue?: string;

  @Column({ nullable: true, name: 'linkedin_url' })
  linkedinUrl?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'tech_stack' })
  techStack?: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'funding_info' })
  fundingInfo?: Record<string, unknown>;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'enriched_at' })
  enrichedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}