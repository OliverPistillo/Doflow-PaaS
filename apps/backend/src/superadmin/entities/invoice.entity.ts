import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum InvoiceStatus {
  PAID = 'paid',       // Pagata
  PENDING = 'pending', // In attesa
  OVERDUE = 'overdue', // Scaduta
}

@Entity('invoices')
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}