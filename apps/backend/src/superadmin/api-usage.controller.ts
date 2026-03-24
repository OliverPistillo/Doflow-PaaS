import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiUsageService } from './api-usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/api-usage')
@UseGuards(JwtAuthGuard)
export class ApiUsageController {
  constructor(private readonly apiUsageService: ApiUsageService) {}

  @Get('dashboard')
  getDashboard() {
    return this.apiUsageService.getUsageDashboard();
  }

  @Get('rate-limits')
  getRateLimits() {
    return this.apiUsageService.getRateLimitStatus();
  }
}
