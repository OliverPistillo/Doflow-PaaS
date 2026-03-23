// apps/backend/src/superadmin/public-schema-bootstrap.service.ts
// Crea le tabelle dello schema public che non sono gestite
// da TypeORM synchronize (che è disabilitato in produzione).
//
// Eseguito automaticamente ad ogni avvio — le istruzioni sono
// idempotenti (IF NOT EXISTS), quindi non causano problemi.
//
// AGGIORNAMENTO: Aggiunta creazione tabella quote_requests e tipo enum.

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PublicSchemaBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicSchemaBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureInvoiceClientsTable();
    await this.ensureQuoteRequestsTable();
  }

  private async ensureInvoiceClientsTable() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.invoice_clients (
          id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          client_name      TEXT        NOT NULL,
          contact_name     TEXT,
          client_vat       TEXT,
          client_fiscal_code TEXT,
          client_sdi       TEXT,
          client_pec       TEXT,
          client_address   TEXT,
          client_city      TEXT,
          client_zip       TEXT,
          payment_method   TEXT,
          notes            TEXT,
          invoice_count    INTEGER     NOT NULL DEFAULT 0,
          updated_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_invoice_clients_client_name UNIQUE (client_name)
        )
      `);
      this.logger.log('✅ public.invoice_clients — OK');
    } catch (err) {
      this.logger.error('❌ Errore creazione public.invoice_clients', err);
    }
  }

  /**
   * Crea la tabella quote_requests per le richieste di preventivo
   * ricevute dal sito web pubblico.
   */
  private async ensureQuoteRequestsTable() {
    try {
      // Creazione tipo enum (idempotente con DO $$ ... END $$)
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_request_status_enum') THEN
            CREATE TYPE quote_request_status_enum AS ENUM (
              'nuova',
              'in_lavorazione',
              'preventivo_inviato',
              'archiviata'
            );
          END IF;
        END $$
      `);

      // Creazione tabella
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.quote_requests (
          id               UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
          client_name      TEXT                      NOT NULL,
          client_email     TEXT                      NOT NULL,
          client_phone     TEXT,
          company_name     TEXT,
          subject          TEXT,
          message          TEXT,
          minio_prefix     TEXT,
          files_count      INTEGER                   NOT NULL DEFAULT 0,
          status           quote_request_status_enum NOT NULL DEFAULT 'nuova',
          admin_notes      TEXT,
          source_ip        TEXT,
          source_origin    TEXT,
          created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
        )
      `);

      // Indice per ricerche frequenti per email e stato
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_email
          ON public.quote_requests (client_email)
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_status
          ON public.quote_requests (status)
      `);
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_quote_requests_created
          ON public.quote_requests (created_at DESC)
      `);

      this.logger.log('✅ public.quote_requests — OK');
    } catch (err) {
      this.logger.error('❌ Errore creazione public.quote_requests', err);
    }
  }
}