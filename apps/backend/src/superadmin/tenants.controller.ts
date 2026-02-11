import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto'; // Importiamo il DTO vero
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    // Restituisce la lista wrappata in un oggetto { tenants: [...] }
    const tenants = await this.tenantsService.findAll();
    return { tenants };
  }

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    // Ora body è garantito essere valido e del tipo CreateTenantDto
    // grazie alla ValidationPipe nel main.ts
    return this.tenantsService.create(body);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}