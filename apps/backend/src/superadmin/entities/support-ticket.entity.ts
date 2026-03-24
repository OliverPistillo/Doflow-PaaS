import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_REPLY = 'WAITING_REPLY',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketCategory {
  BUG = 'BUG',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  BILLING = 'BILLING',
  ACCESS = 'ACCESS',
  PERFORMANCE = 'PERFORMANCE',
  GENERAL = 'GENERAL',
}

@Entity({ schema: 'public', name: 'support_tickets' })
@Index(['status'])
@Index(['priority'])
@Index(['tenantId'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Codice leggibile: TK-0001, TK-0002... */
  @Column({ name: 'ticket_code', unique: true })
  ticketCode!: string;

  @Column()
  subject!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: TicketCategory, default: TicketCategory.GENERAL })
  category!: TicketCategory;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status!: TicketStatus;

  /** Tenant che ha aperto il ticket */
  @Column({ name: 'tenant_id' })
  tenantId!: string;

  @Column({ name: 'tenant_name', nullable: true })
  tenantName!: string;

  /** Email di chi ha aperto il ticket */
  @Column({ name: 'reporter_email' })
  reporterEmail!: string;

  /** Superadmin assegnato */
  @Column({ name: 'assigned_to', nullable: true })
  assignedTo!: string;

  /** Risposte / thread come JSONB array */
  @Column({ type: 'jsonb', default: '[]' })
  replies!: {
    author: string;
    message: string;
    timestamp: string;
    isInternal: boolean;
  }[];

  /** Tempo SLA target in ore */
  @Column({ name: 'sla_hours', type: 'int', nullable: true })
  slaHours!: number;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
