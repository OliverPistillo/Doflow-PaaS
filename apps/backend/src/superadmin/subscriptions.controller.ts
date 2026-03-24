import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subsService: SubscriptionsService) {}

  @Get('revenue')
  getRevenueDashboard() {
    return this.subsService.getRevenueDashboard();
  }

  @Get()
  findAll() {
    return this.subsService.findAll();
  }

  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.subsService.findByTenant(tenantId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' },
  ) {
    return this.subsService.updateStatus(id, body.status);
  }
}
