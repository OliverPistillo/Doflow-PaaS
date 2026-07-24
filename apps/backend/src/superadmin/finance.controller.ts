// apps/backend/src/superadmin/finance.controller.ts
// MODIFICATO: aggiunti GET /services e POST /services per i preset righe fattura.
// Tutto il resto è invariato rispetto all'originale.

import {
  Controller, Get, Post, Body, UseGuards,
  Query, Param, Patch, Delete, Res,
  NotFoundException, InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { FinanceService }          from './finance.service';
import { InvoicePdfService }       from './invoice-pdf.service';
import { PreventivoPdfService }    from './preventivo-pdf.service';
import { InvoiceMailService }      from './invoice-mail.service';
import { JwtAuthGuard }            from '../auth/jwt-auth.guard';
import { Invoice }                  from './entities/invoice.entity';
import { Response }                 from 'express';

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(
    private readonly service:             FinanceService,
    private readonly pdfService:          InvoicePdfService,
    private readonly preventivoPdfService: PreventivoPdfService,
    private readonly mailService:         InvoiceMailService,
  ) {}

  // ── GET /superadmin/finance/invoices ─────────────────────────────────────
  @Get('invoices')
  async getAllInvoices(
    @Query('search')  search?:  string,
    @Query('status')  status?:  string,
    @Query('docType') docType?: string,
  ) {
    try {
      return await this.service.findAll(search, status, docType);
    } catch (error) {
      this.logger.error('[FinanceController] Error fetching invoices:', error);
      throw new InternalServerErrorException('Impossibile recuperare le fatture');
    }
  }

  // ── GET /superadmin/finance/dashboard ────────────────────────────────────
  @Get('dashboard')
  async getDashboard() {
    try {
      return await this.service.getDashboardStats();
    } catch (error) {
      this.logger.error('[FinanceController] Error fetching dashboard stats:', error);
      throw new InternalServerErrorException('Impossibile recuperare le statistiche');
    }
  }

  // ── POST /superadmin/finance/invoices ────────────────────────────────────
  @Post('invoices')
  async createInvoice(@Body() body: Partial<Invoice>) {
    try {
      return await this.service.create(body);
    } catch (error) {
      this.logger.error('[FinanceController] Error creating invoice:', error);
      throw new InternalServerErrorException(
        'Impossibile creare il documento. Verifica i dati o lo schema DB.',
      );
    }
  }

  // ── PATCH /superadmin/finance/invoices/:id ───────────────────────────────
  @Patch('invoices/:id')
  async updateInvoice(
    @Param('id') id: string,
    @Body()      body: Partial<Invoice>,
  ) {
    try {
      return await this.service.update(id, body);
    } catch (error) {
      this.logger.error(`[FinanceController] Error updating invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile aggiornare il documento');
    }
  }

  // ── DELETE /superadmin/finance/invoices/:id ──────────────────────────────
  @Delete('invoices/:id')
  async deleteInvoice(@Param('id') id: string) {
    try {
      return await this.service.delete(id);
    } catch (error) {
      this.logger.error(`[FinanceController] Error deleting invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile eliminare il documento');
    }
  }

  // ── GET /superadmin/finance/invoices/:id/pdf ─────────────────────────────
  // Routing automatico per tipo documento (fattura vs preventivo)
  @Get('invoices/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.service.findOneWithItems(id);
    if (!invoice) throw new NotFoundException('Documento non trovato');

    const isPreventivo = invoice.docType === 'preventivo';

    const pdfBuffer = isPreventivo
      ? await this.preventivoPdfService.generatePdf(invoice)
      : await this.pdfService.generateInvoicePdf(invoice);

    const filename = isPreventivo
      ? `Preventivo_${invoice.id}.pdf`
      : `Fattura_${invoice.invoiceNumber || invoice.id}.pdf`;

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  // ── POST /superadmin/finance/invoices/:id/send ───────────────────────────
  // Invia il PDF corretto in base al tipo (fattura o preventivo)
  @Post('invoices/:id/send')
  async sendEmail(
    @Param('id')       id:          string,
    @Body('email')     targetEmail: string,
  ) {
    const invoice = await this.service.findOneWithItems(id);
    if (!invoice) throw new NotFoundException('Documento non trovato');
    if (!targetEmail) throw new Error('Email destinatario obbligatoria');

    const isPreventivo = invoice.docType === 'preventivo';

    const pdfBuffer = isPreventivo
      ? await this.preventivoPdfService.generatePdf(invoice)
      : await this.pdfService.generateInvoicePdf(invoice);

    const docLabel = isPreventivo ? 'preventivo' : invoice.invoiceNumber;

    return this.mailService.sendInvoiceEmail(
      targetEmail,
      invoice.clientName,
      docLabel,
      pdfBuffer,
    );
  }

  // ── GET /superadmin/finance/clients ──────────────────────────────────────
  @Get('clients')
  async getClients() {
    try {
      return await this.service.findAllClients();
    } catch (error) {
      this.logger.error('[FinanceController] Error fetching clients:', error);
      throw new InternalServerErrorException('Impossibile recuperare i clienti');
    }
  }

  // ── POST /superadmin/finance/clients/upsert ──────────────────────────────
  @Post('clients/upsert')
  async upsertClient(
    @Body() body: {
      clientName: string;  contactName?: string; clientVat?: string;
      clientFiscalCode?: string; clientSdi?: string; clientPec?: string;
      clientAddress?: string; clientCity?: string; clientZip?: string;
      paymentMethod?: string; notes?: string;
    },
  ) {
    try {
      if (!body.clientName?.trim()) throw new Error('clientName è obbligatorio');
      return await this.service.upsertClient(body);
    } catch (error) {
      this.logger.error('[FinanceController] Error upserting client:', error);
      throw new InternalServerErrorException('Impossibile salvare il cliente');
    }
  }

  // ── GET /superadmin/finance/services ─────────────────────────────────────
  // NUOVO: ritorna i preset di righe fattura salvati in precedenza.
  // Usato dal dropdown "Scegli servizio" nel form Nuova Fattura/Preventivo.
  // Shape: SavedService[] = { id, description, unitPrice, quantity }[]
  @Get('services')
  async getServices() {
    try {
      return await this.service.findAllServices();
    } catch (error) {
      this.logger.error('[FinanceController] Error fetching services:', error);
      throw new InternalServerErrorException('Impossibile recuperare i servizi');
    }
  }

  // ── POST /superadmin/finance/services ────────────────────────────────────
  // NUOVO: salva una riga fattura come preset riutilizzabile.
  // Body: { description: string; unitPrice: number; quantity: number }
  // Se esiste già un preset con la stessa descrizione, lo aggiorna.
  @Post('services')
  async createService(
    @Body() body: { description: string; unitPrice: number; quantity: number },
  ) {
    try {
      if (!body.description?.trim()) {
        throw new Error('description è obbligatoria');
      }
      return await this.service.createService({
        description: body.description,
        unitPrice:   Number(body.unitPrice)  || 0,
        quantity:    Number(body.quantity)   || 1,
      });
    } catch (error) {
      this.logger.error('[FinanceController] Error saving service:', error);
      throw new InternalServerErrorException('Impossibile salvare il servizio');
    }
  }
}
