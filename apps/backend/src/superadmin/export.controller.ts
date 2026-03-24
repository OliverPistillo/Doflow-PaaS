import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get(':entity')
  async exportCsv(
    @Param('entity') entity: string,
    @Res() res: Response,
  ) {
    let csv: string;
    let filename: string;

    switch (entity) {
      case 'leads':
        csv = await this.exportService.exportLeads();
        filename = 'leads';
        break;
      case 'tickets':
        csv = await this.exportService.exportTickets();
        filename = 'tickets';
        break;
      case 'invoices':
        csv = await this.exportService.exportInvoices();
        filename = 'invoices';
        break;
      case 'tenants':
        csv = await this.exportService.exportTenants();
        filename = 'tenants';
        break;
      case 'deals':
        csv = await this.exportService.exportDeals();
        filename = 'deals';
        break;
      default:
        res.status(400).json({ error: `Entity '${entity}' non supportata. Disponibili: leads, tickets, invoices, tenants, deals` });
        return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=doflow_${filename}_${timestamp}.csv`);
    // BOM UTF-8 per Excel
    res.send('\uFEFF' + csv);
  }
}
