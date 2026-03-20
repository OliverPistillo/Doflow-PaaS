import { Controller, Get, Post, Body, UseGuards, Query, Param, Patch, Delete, Res, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { PreventivoPdfService } from './preventivo-pdf.service';
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
    private readonly preventivoPdfService: PreventivoPdfService,
    private readonly mailService: InvoiceMailService,
  ) {}

  @Get('invoices')
  async getAllInvoices(
    @Query('search')  search?: string,
    @Query('status')  status?: string,
    @Query('docType') docType?: string,
  ) {
    try {
      return await this.service.findAll(search, status, docType);
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
      throw new InternalServerErrorException('Impossibile creare il documento. Verifica i dati o lo schema DB.');
    }
  }

  @Patch('invoices/:id')
  async updateInvoice(@Param('id') id: string, @Body() body: Partial<Invoice>) {
    try {
      return await this.service.update(id, body);
    } catch (error) {
      console.error(`[FinanceController] Error updating invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile aggiornare il documento');
    }
  }

  @Delete('invoices/:id')
  async deleteInvoice(@Param('id') id: string) {
    try {
      return await this.service.delete(id);
    } catch (error) {
      console.error(`[FinanceController] Error deleting invoice ${id}:`, error);
      throw new InternalServerErrorException('Impossibile eliminare il documento');
    }
  }

  // ── PDF: routing automatico per tipo documento ─────────────────────────────

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

  // ── Email: invia il PDF corretto in base al tipo ───────────────────────────

  @Post('invoices/:id/send')
  async sendEmail(@Param('id') id: string, @Body('email') targetEmail: string) {
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

  // ── Anagrafica Clienti ────────────────────────────────────────────────────

  @Get('clients')
  async getClients() {
    try {
      return await this.service.findAllClients();
    } catch (error) {
      console.error('[FinanceController] Error fetching clients:', error);
      throw new InternalServerErrorException('Impossibile recuperare i clienti');
    }
  }

  @Post('clients/upsert')
  async upsertClient(@Body() body: {
    clientName: string; contactName?: string; clientVat?: string;
    clientFiscalCode?: string; clientSdi?: string; clientPec?: string;
    clientAddress?: string; clientCity?: string; clientZip?: string;
    paymentMethod?: string; notes?: string;
  }) {
    try {
      if (!body.clientName?.trim()) throw new Error('clientName è obbligatorio');
      return await this.service.upsertClient(body);
    } catch (error) {
      console.error('[FinanceController] Error upserting client:', error);
      throw new InternalServerErrorException('Impossibile salvare il cliente');
    }
  }
}