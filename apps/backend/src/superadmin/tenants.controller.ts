import { Controller, Get, Post, Body, UseGuards, Delete, Param, BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
// import { CreateTenantDto } from './dto/create-tenant.dto'; // Commentalo per ora
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    return { tenants: await this.tenantsService.findAll() };
  }

  // MODIFICA QUI: Usa 'any' al posto del DTO
  @Post()
  async createTenant(@Body() body: any) { 
    
    // LOGGA TUTTO QUELLO CHE ARRIVA
    console.log("🔥 DEBUG RAW BODY:", JSON.stringify(body, null, 2));

    // Controllo manuale semplificato
    if (!body || Object.keys(body).length === 0) {
        throw new BadRequestException("Il Body è arrivato vuoto! Controlla Content-Type o il main.ts");
    }

    // Mappiamo a mano per essere sicuri
    const dto = {
        name: body.name,
        slug: body.slug,
        email: body.email,
        plan: body.plan || 'STARTER'
    };

    if (!dto.name || !dto.slug || !dto.email) {
        throw new BadRequestException(`Campi mancanti. Ricevuti: ${Object.keys(body).join(', ')}`);
    }

    // Passiamo il DTO "costruito a mano" al service
    return this.tenantsService.create(dto as any);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }
}