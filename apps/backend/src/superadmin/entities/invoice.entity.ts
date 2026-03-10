import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn,
  UpdateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { InvoiceTemplate } from './invoice-template.entity';

export enum InvoiceStatus {
  PAID    = 'paid',
  PENDING = 'pending',
  OVERDUE = 'overdue',
}

export enum TaxRegime {
  ORDINARIO   = 'ordinario',
  FORFETTARIO = 'forfettario',
}

@Entity({ name: 'invoices', schema: 'public' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_number' })
  invoiceNumber!: string;

  // ── Dati Cliente ─────────────────────────────────────────────────────
  @Column({ name: 'client_name' })
  clientName!: string;

  @Column({ name: 'client_address', nullable: true })
  clientAddress!: string;

  @Column({ name: 'client_city', nullable: true })
  clientCity!: string;

  @Column({ name: 'client_zip', nullable: true })
  clientZip!: string;

  @Column({ name: 'client_vat', nullable: true })
  clientVat!: string;          // Partita IVA cliente

  @Column({ name: 'client_fiscal_code', nullable: true })
  clientFiscalCode!: string;   // Codice Fiscale cliente

  @Column({ name: 'client_sdi', nullable: true })
  clientSdi!: string;          // Codice Destinatario SDI (7 caratteri)

  @Column({ name: 'client_pec', nullable: true })
  clientPec!: string;          // PEC cliente

  // ── Importi ──────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;             // Imponibile totale

  @Column({ type: 'date', name: 'issue_date' })
  issueDate!: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status!: InvoiceStatus;

  // ── Regime Fiscale ───────────────────────────────────────────────────
  @Column({
    name: 'tax_regime',
    type: 'enum',
    enum: TaxRegime,
    default: TaxRegime.ORDINARIO,
  })
  taxRegime!: TaxRegime;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 22.00 })
  taxRate!: number;            // % IVA (0 se forfettario)

  @Column({ name: 'inps_rate', type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  inpsRate!: number;           // % Rivalsa INPS (es. 4)

  @Column({ name: 'ritenuta_rate', type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  ritenutaRate!: number;       // % Ritenuta d'Acconto (es. 20)

  @Column({ name: 'stamp_duty', type: 'boolean', default: false })
  stampDuty!: boolean;         // Marca da Bollo 2€

  @Column({ type: 'text', nullable: true })
  notes!: string;

  // ── Relazioni ────────────────────────────────────────────────────────
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