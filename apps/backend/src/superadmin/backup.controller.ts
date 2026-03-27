import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { BackupService, CreateScheduleDto } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupType } from './entities/system-backup.entity';

@Controller('superadmin/storage')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ─── Overview ────────────────────────────────────────────────────────────────

  @Get('overview')
  getOverview() {
    return this.backupService.getStorageOverview();
  }

  // ─── Backup CRUD ─────────────────────────────────────────────────────────────

  @Get('backups')
  findAllBackups() {
    return this.backupService.findAll();
  }

  @Get('backups/:id')
  findOneBackup(@Param('id') id: string) {
    return this.backupService.findOne(id);
  }

  @Post('backups/trigger')
  triggerBackup(@Body() body: { type?: string; tenantId?: string }) {
    const type = (body.type as BackupType) || BackupType.FULL;
    return this.backupService.triggerBackup(type, body.tenantId);
  }

  @Get('backups/:id/download')
  async downloadBackup(@Param('id') id: string, @Res() res: Response) {
    // MinIO non è esposto pubblicamente: proxiamo lo stream direttamente
    // attraverso il backend invece di fare redirect a una presigned URL.
    const { stream, filename, size } = await this.backupService.streamDownload(id);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    if (size) res.setHeader('Content-Length', size);

    stream.pipe(res);
  }

  @Post('backups/:id/restore')
  restoreBackup(@Param('id') id: string) {
    return this.backupService.restoreBackup(id);
  }

  @Delete('backups/:id')
  deleteBackup(@Param('id') id: string) {
    return this.backupService.deleteBackup(id);
  }

  // ─── Schedules CRUD ──────────────────────────────────────────────────────────

  @Get('schedules')
  findAllSchedules() {
    return this.backupService.findAllSchedules();
  }

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.backupService.createSchedule(dto);
  }

  @Put('schedules/:id')
  updateSchedule(@Param('id') id: string, @Body() dto: Partial<CreateScheduleDto>) {
    return this.backupService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id') id: string) {
    return this.backupService.deleteSchedule(id);
  }
}