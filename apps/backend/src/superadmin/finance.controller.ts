import { Controller, Get, Post, Body, UseGuards, Query, Param, Patch, Delete, Res, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceMailService } from './invoice-mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Invoice } from './entities/invoice.entity';
import { Response } from 'express';

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly service: FinanceService,
    private readonly pdfService: InvoicePdfService,
    private readonly mailService: InvoiceMailService,
  ) {}

  @Get('invoices')
  async getAllInvoices(
    @Query('search') search?: string,
    @Query('status') status?: string
  ) {
    try {
      return await this.service.findAll(search, status);
    } catch (error) {
      console.error('[FinanceController] Error fetching invoices:', error);
      throw new InternalServerErrorException('Impossibile recuperare le fatture');
    }
  }

  @Get('dashboard')
  async getDashboard() {
    try {
      return await this.service.getDashboardStats();
    } catch (error) {
      console.error('[FinanceController] Error fetching dashboard stats:', error);
      throw new InternalServerErrorException('Impossibile recuperare le statistiche');
    }
  }

  @Post('invoices')
  async createInvoice(@Body() body: Partial<Invoice>) {
    try {
      return await this.service.create(body);
    } catch (error) {
      console.error('[FinanceController] Error creating invoice:', error);
      throw new InternalServerErrorException('Impossibile creare la fattura. Verifica i dati o lo schema DB.');
    }
  }

  // AGGIORNA FATTURA
  @Patch('invoices/:id')
  async updateInvoice(@Param('id') id: string, @Body() body: Partial<Invoice>) {
    try {
      return await this.service.update(id, body);
    } catch (error) {
      console.error(`[FinanceController] Error updating invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile aggiornare la fattura');
    }
  }

  // ELIMINA FATTURA
  @Delete('invoices/:id')
  async deleteInvoice(@Param('id') id: string) {
    try {
      return await this.service.delete(id);
    } catch (error) {
      console.error(`[FinanceController] Error deleting invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile eliminare la fattura');
    }
  }

  // DOWNLOAD PDF
  @Get('invoices/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.service.findOneWithItems(id);
    if (!invoice) throw new NotFoundException('Fattura non trovata');

    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fattura_${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // INVIA EMAIL CON PDF
  @Post('invoices/:id/send')
  async sendEmail(@Param('id') id: string, @Body('email') targetEmail: string) {
    const invoice = await this.service.findOneWithItems(id);
    if (!invoice) throw new NotFoundException('Fattura non trovata');

    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    
    if (!targetEmail) throw new Error('Email destination required');

    return this.mailService.sendInvoiceEmail(targetEmail, invoice.clientName, invoice.invoiceNumber, pdfBuffer);
  }

  // ── Anagrafica Clienti ────────────────────────────────────────────────────

  /** GET /api/superadmin/finance/clients — lista clienti salvati */
  @Get('clients')
  async getClients() {
    try {
      console.log('[FinanceController] GET clients');
      const result = await this.service.findAllClients();
      console.log(`[FinanceController] GET clients → ${result.length} records`);
      return result;
    } catch (error) {
      console.error('[FinanceController] Error fetching clients:', error);
      throw new InternalServerErrorException('Impossibile recuperare i clienti');
    }
  }

  /**
   * POST /api/superadmin/finance/clients/upsert
   * Inserisce un nuovo cliente o aggiorna i dati se già esiste (chiave: clientName).
   */
  @Post('clients/upsert')
  async upsertClient(@Body() body: {
    clientName: string;
    contactName?: string;
    clientVat?: string;
    clientFiscalCode?: string;
    clientSdi?: string;
    clientPec?: string;
    clientAddress?: string;
    clientCity?: string;
    clientZip?: string;
    paymentMethod?: string;
    notes?: string;
  }) {
    try {
      console.log('[FinanceController] POST clients/upsert →', body.clientName);
      if (!body.clientName?.trim()) {
        throw new Error('clientName è obbligatorio');
      }
      const result = await this.service.upsertClient(body);
      console.log('[FinanceController] upsert OK → id:', result.id);
      return result;
    } catch (error) {
      console.error('[FinanceController] Error upserting client:', error);
      throw new InternalServerErrorException('Impossibile salvare il cliente');
    }
  }
}