// apps/backend/src/superadmin/entities/quote-request.entity.ts
// Entità per salvare le richieste di preventivo dal sito web pubblico.
// Ogni record corrisponde a un singolo invio del form con relativi allegati su MinIO.

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stato di lavorazione della richiesta di preventivo.
 * - NUOVA: appena arrivata, non ancora vista dall'admin
 * - IN_LAVORAZIONE: l'admin l'ha presa in carico
 * - PREVENTIVO_INVIATO: è stato inviato un preventivo al cliente
 * - ARCHIVIATA: completata o scartata
 */
export enum QuoteRequestStatus {
  NUOVA = 'nuova',
  IN_LAVORAZIONE = 'in_lavorazione',
  PREVENTIVO_INVIATO = 'preventivo_inviato',
  ARCHIVIATA = 'archiviata',
}

@Entity('quote_requests')
export class QuoteRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // --- Dati anagrafici dal form ---
  @Column({ name: 'client_name', type: 'text' })
  clientName!: string;

  @Column({ name: 'client_email', type: 'text' })
  clientEmail!: string;

  @Column({ name: 'client_phone', type: 'text', nullable: true })
  clientPhone!: string | null;

  @Column({ name: 'company_name', type: 'text', nullable: true })
  companyName!: string | null;

  // --- Dettagli della richiesta ---
  @Column({ name: 'subject', type: 'text', nullable: true })
  subject!: string | null;

  @Column({ name: 'message', type: 'text', nullable: true })
  message!: string | null;

  // --- Riferimento ai file su MinIO ---
  // Prefisso della "cartella" su MinIO: es. "cliente@email.it/1711234567890/"
  // Tutti i file di questa richiesta sono salvati sotto questo prefisso.
  @Column({ name: 'minio_prefix', type: 'text', nullable: true })
  minioPrefix!: string | null;

  // Numero di file allegati (per mostrare un badge nel CRM)
  @Column({ name: 'files_count', type: 'int', default: 0 })
  filesCount!: number;

  // --- Stato lavorazione ---
  @Column({
    type: 'enum',
    enum: QuoteRequestStatus,
    default: QuoteRequestStatus.NUOVA,
  })
  status!: QuoteRequestStatus;

  // Note interne dell'admin (non visibili al cliente)
  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes!: string | null;

  // --- Metadati ---
  // Indirizzo IP del visitatore (utile per anti-spam)
  @Column({ name: 'source_ip', type: 'text', nullable: true })
  sourceIp!: string | null;

  // Dominio di provenienza (Referer header)
  @Column({ name: 'source_origin', type: 'text', nullable: true })
  sourceOrigin!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}