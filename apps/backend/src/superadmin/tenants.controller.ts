import { Controller, Get, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/v2/tenants') // 3. CAMBIAMO ROTTA IN V2 PER TEST
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    // Aggiungiamo un log che vedrai SICURAMENTE se il codice è nuovo
    console.log("🚀 CHIAMATA V2 RICEVUTA CON BODY:", JSON.stringify(body));
    return this.tenantsService.create(body);
  }
  
  @Get()
  async getTenants() {
    return { tenants: await this.tenantsService.findAll() };
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}