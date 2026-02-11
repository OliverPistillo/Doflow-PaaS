import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    const tenants = await this.tenantsService.findAll();
    return { tenants };
  }

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    return this.tenantsService.create(body);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}