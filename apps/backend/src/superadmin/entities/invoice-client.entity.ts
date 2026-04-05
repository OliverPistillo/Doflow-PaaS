import {
  Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Anagrafica clienti fatture — schema public (superadmin).
 * Viene popolata automaticamente ogni volta che si crea/modifica una fattura.
 * Chiave univoca: clientName (nome azienda).
 */
@Entity({ name: 'invoice_clients', schema: 'public' })
export class InvoiceClient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Nome azienda — chiave univoca */
  @Column({ name: 'client_name', unique: true })
  clientName!: string;

  /** Referente / persona di contatto */
  @Column({ name: 'contact_name', nullable: true })
  contactName!: string;

  /** Partita IVA */
  @Column({ name: 'client_vat', nullable: true })
  clientVat!: string;

  /** Codice Fiscale */
  @Column({ name: 'client_fiscal_code', nullable: true })
  clientFiscalCode!: string;

  /** Codice SDI (7 caratteri, fattura elettronica) */
  @Column({ name: 'client_sdi', nullable: true })
  clientSdi!: string;

  /** PEC */
  @Column({ name: 'client_pec', nullable: true })
  clientPec!: string;

  /** Indirizzo */
  @Column({ name: 'client_address', nullable: true })
  clientAddress!: string;

  /** Città */
  @Column({ name: 'client_city', nullable: true })
  clientCity!: string;

  /** CAP */
  @Column({ name: 'client_zip', nullable: true })
  clientZip!: string;

  /** Metodo di pagamento usato più di recente */
  @Column({ name: 'payment_method', nullable: true })
  paymentMethod!: string;

  /** Note libere sul cliente */
  @Column({ type: 'text', nullable: true })
  notes!: string;

  /** Numero di fatture emesse verso questo cliente */
  @Column({ name: 'invoice_count', default: 0 })
  invoiceCount!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
