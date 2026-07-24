import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantBriefingService } from './tenant-briefing.service';

@Controller('tenant/briefing')
@UseGuards(JwtAuthGuard)
export class TenantBriefingController {
  constructor(private readonly service: TenantBriefingService) {}

  @Get('templates')
  listTemplates(@Query() query: Record<string, any>) {
    return this.service.list('templates', query);
  }

  @Post('templates')
  createTemplate(@Body() body: Record<string, any>) {
    return this.service.create('templates', body);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('templates', id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.service.remove('templates', id);
  }

  @Get()
  listBriefings(@Query() query: Record<string, any>) {
    return this.service.list('briefings', query);
  }

  @Post()
  createBriefing(@Body() body: Record<string, any>) {
    return this.service.create('briefings', body);
  }

  @Get(':id')
  getBriefing(@Param('id') id: string) {
    return this.service.findOne('briefings', id);
  }

  @Patch(':id')
  updateBriefing(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('briefings', id, body);
  }

  @Delete(':id')
  deleteBriefing(@Param('id') id: string) {
    return this.service.remove('briefings', id);
  }

  @Patch(':id/status')
  updateBriefingStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateStatus(id, String(body.status || ''));
  }

  @Patch(':id/approve')
  approveBriefing(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Get(':id/materials')
  listMaterials(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.service.listMaterials(id, query);
  }

  @Post(':id/materials')
  createMaterial(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createMaterial(id, body);
  }

  @Patch('materials/:materialId')
  updateMaterial(@Param('materialId') materialId: string, @Body() body: Record<string, any>) {
    return this.service.update('materials', materialId, body);
  }

  @Delete('materials/:materialId')
  deleteMaterial(@Param('materialId') materialId: string) {
    return this.service.remove('materials', materialId);
  }
}
