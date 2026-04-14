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

  @Column({ nullable: true })
  employeeCount?: number;

  @Column({ nullable: true })
  annualRevenue?: string;

  @Column({ nullable: true })
  linkedinUrl?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ type: 'jsonb', nullable: true })
  techStack?: string[];

  @Column({ type: 'jsonb', nullable: true })
  fundingInfo?: Record<string, unknown>;

  /** Timestamp dell'ultimo arricchimento — usato per cache (TTL 24h) */
  @Column({ type: 'timestamp', nullable: true })
  enrichedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
