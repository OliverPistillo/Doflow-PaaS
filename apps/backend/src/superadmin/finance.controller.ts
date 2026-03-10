import { Controller, Get, Post, Body, UseGuards, Query, Param, Patch, Delete, Res, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Invoice } from './entities/invoice.entity';
import { Response } from 'express';

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly service: FinanceService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  @Get('invoices')
  getAllInvoices(
    @Query('search') search?: string,
    @Query('status') status?: string
  ) {
    return this.service.findAll(search, status);
  }

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboardStats();
  }

  @Post('invoices')
  createInvoice(@Body() body: Partial<Invoice>) {
    return this.service.create(body);
  }

  // AGGIORNA FATTURA
  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() body: Partial<Invoice>) {
     return this.service.update(id, body);
  }

  // ELIMINA FATTURA
  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string) {
     return this.service.delete(id);
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
}