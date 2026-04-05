import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  // ─── Catalogo moduli ────────────────────────────────────────

  @Get()
  findAll() {
    return this.modulesService.findAllModules();
  }

  @Post()
  create(@Body() dto: any) {
    return this.modulesService.createModule(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.modulesService.updateModule(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.modulesService.deleteModule(id);
  }

  // ─── Matrice tenant / moduli ────────────────────────────────

  @Get('matrix')
  getMatrix() {
    return this.modulesService.getTenantMatrix();
  }

  @Get('tenant/:tenantId')
  getByTenant(@Param('tenantId') tenantId: string) {
    return this.modulesService.getModulesByTenant(tenantId);
  }

  @Post('tenant/:tenantId/toggle')
  toggle(
    @Param('tenantId') tenantId: string,
    @Body() body: { moduleKey: string; enable: boolean },
  ) {
    return this.modulesService.toggleModule(tenantId, body.moduleKey, body.enable);
  }
}
