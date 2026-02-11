import { Controller, Get, Post, Body, UseGuards, Delete, Param, BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    return { tenants: await this.tenantsService.findAll() };
  }

  @Post()
  async createTenant(@Body() body: CreateTenantDto) {
    // --- DEBUG LOG ---
    console.log("📥 [POST /tenants] Body ricevuto:", body);
    
    // Controllo manuale per capire se è questo che lancia l'errore
    if (!body || !body.name || !body.slug || !body.email) {
        console.error("❌ Body incompleto:", body);
        throw new BadRequestException("Missing fields (Name, Slug or Email missing)");
    }

    return this.tenantsService.create(body);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}