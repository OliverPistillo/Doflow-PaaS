import { Controller, Get, Post, Body, UseGuards, Query, Param, Patch, Delete } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Invoice } from './entities/invoice.entity';

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

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
}