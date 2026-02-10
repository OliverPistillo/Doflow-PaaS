import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'; // Aggiungi Post, Body
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Invoice } from './entities/invoice.entity'; // Importa l'entity

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboardStats();
  }

  // AGGIUNGI QUESTO ENDPOINT:
  @Post('invoices')
  createInvoice(@Body() body: Partial<Invoice>) {
    return this.service.create(body);
  }
}