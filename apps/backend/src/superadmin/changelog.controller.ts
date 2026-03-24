import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Admin endpoints (protetti) */
@Controller('superadmin/changelog')
@UseGuards(JwtAuthGuard)
export class ChangelogAdminController {
  constructor(private readonly svc: ChangelogService) {}

  @Get()
  findAll() { return this.svc.findAll(false); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Patch(':id/publish')
  publish(@Param('id') id: string) { return this.svc.publish(id); }

  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) { return this.svc.unpublish(id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.delete(id); }
}

/** Endpoint pubblico: changelog visibile ai tenant (solo published) */
@Controller('public/changelog')
export class ChangelogPublicController {
  constructor(private readonly svc: ChangelogService) {}

  @Get()
  findPublished() { return this.svc.findAll(true); }
}
