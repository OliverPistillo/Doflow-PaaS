import { Controller, Get, Header, Param } from '@nestjs/common';
import { TenantBackendContractsService } from './tenant-backend-contracts.service';

@Controller('calendar-integrations')
export class TenantCalendarFeedController {
  constructor(private readonly service: TenantBackendContractsService) {}

  @Get('ics/:token')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, no-store')
  calendarFeed(@Param('token') token: string) {
    return this.service.calendarFeed(token);
  }
}
