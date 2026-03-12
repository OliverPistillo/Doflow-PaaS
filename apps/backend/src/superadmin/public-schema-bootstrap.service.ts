import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Crea le tabelle dello schema public che non sono gestite
 * da TypeORM synchronize (che è disabilitato in produzione).
 *
 * Eseguito automaticamente ad ogni avvio — le istruzioni sono
 * idempotenti (IF NOT EXISTS), quindi non causano problemi.
 */
@Injectable()
export class PublicSchemaBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PublicSchemaBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureInvoiceClientsTable();
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
}
