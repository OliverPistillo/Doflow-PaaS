import { Controller, Get, Post, Body, UseGuards, Delete, Param, Patch } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    // Restituiamo un oggetto { tenants: [...] } come si aspetta il frontend
    return { tenants: await this.tenantsService.findAll() };
  }

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    return this.tenantsService.create(body);
  }

  // 👇👇👇 AGGIUNGI QUESTO METODO 👇👇👇
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.tenantsService.updateStatus(id, body.isActive);
  }
  // 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}