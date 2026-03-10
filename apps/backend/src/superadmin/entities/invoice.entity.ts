import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { InvoiceTemplate } from './invoice-template.entity';

export enum InvoiceStatus {
  PAID = 'paid',       // Pagata
  PENDING = 'pending', // In attesa
  OVERDUE = 'overdue', // Scaduta
}

@Entity({ name: 'invoices', schema: 'public' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_number' })
  invoiceNumber!: string;

  @Column({ name: 'client_name' })
  clientName!: string;

  // DECIMAL(10,2) è standard per valute: 99999999.99
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'date', name: 'issue_date' })
  issueDate!: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING
  })
  status!: InvoiceStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 22.00 })
  taxRate!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @OneToMany(() => InvoiceLineItem, lineItem => lineItem.invoice, { cascade: true })
  lineItems!: InvoiceLineItem[];

  @ManyToOne(() => InvoiceTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template!: InvoiceTemplate;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}