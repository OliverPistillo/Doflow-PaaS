import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupType } from './entities/system-backup.entity';

@Controller('superadmin/storage')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('overview')
  getOverview() {
    return this.backupService.getStorageOverview();
  }

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

  @Delete('backups/:id')
  deleteBackup(@Param('id') id: string) {
    return this.backupService.deleteBackup(id);
  }
}
