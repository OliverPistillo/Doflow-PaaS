import { Controller, Get, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.service.getDashboardStats();
  }
}