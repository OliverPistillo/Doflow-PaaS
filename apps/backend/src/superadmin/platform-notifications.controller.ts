import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { PlatformNotificationsService } from './platform-notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/notifications')
@UseGuards(JwtAuthGuard)
export class PlatformNotificationsController {
  constructor(private readonly notifService: PlatformNotificationsService) {}

  @Get('stats')
  getStats() {
    return this.notifService.getStats();
  }

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('isRead') isRead?: string,
    @Query('search') search?: string,
  ) {
    return this.notifService.findAll({
      type: type as any,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      search,
    });
  }

  @Post()
  create(@Body() dto: any) {
    return this.notifService.create(dto);
  }

  @Post('broadcast')
  broadcast(@Body() dto: { title: string; message: string; type?: string }) {
    return this.notifService.broadcast(dto as any);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notifService.markAsRead(id);
  }

  @Patch('read-all')
  markAllAsRead() {
    return this.notifService.markAllAsRead();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notifService.delete(id);
  }

  @Delete()
  removeAll() {
    return this.notifService.deleteAll();
  }
}
