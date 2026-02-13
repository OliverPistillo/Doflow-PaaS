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

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.tenantsService.updateStatus(id, body.isActive);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }

  // --- ENDPOINT AGGIUNTIVI PER SUPPORTO COMPLETO FRONTEND ---

  @Post(':id/reset-admin-password')
  async resetPassword(@Param('id') id: string, @Body() body: { email: string }) {
    return this.tenantsService.resetAdminPassword(id, body.email);
  }

  @Post(':id/impersonate')
  async impersonate(@Param('id') id: string) {
      // Mock Implementation per la v3.5
      // Qui in futuro genereremo un JWT "impersonation token"
      return {
          token: "mock_impersonation_token",
          redirectUrl: "https://app.doflow.it"
      };
  }
}