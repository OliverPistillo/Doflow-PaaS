import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantCrmService } from './tenant-crm.service';

@Controller('tenant/crm')
@UseGuards(JwtAuthGuard)
export class TenantCrmController {
  constructor(private readonly service: TenantCrmService) {}

  @Get('companies')
  listCompanies(@Query() query: Record<string, any>) {
    return this.service.list('companies', query);
  }

  @Post('companies')
  createCompany(@Body() body: Record<string, any>) {
    return this.service.create('companies', body);
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.service.findOne('companies', id);
  }

  @Patch('companies/:id')
  updateCompany(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('companies', id, body);
  }

  @Delete('companies/:id')
  deleteCompany(@Param('id') id: string) {
    return this.service.remove('companies', id);
  }

  @Get('contacts')
  listContacts(@Query() query: Record<string, any>) {
    return this.service.list('contacts', query);
  }

  @Post('contacts')
  createContact(@Body() body: Record<string, any>) {
    return this.service.create('contacts', body);
  }

  @Get('contacts/:id')
  getContact(@Param('id') id: string) {
    return this.service.findOne('contacts', id);
  }

  @Patch('contacts/:id')
  updateContact(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('contacts', id, body);
  }

  @Delete('contacts/:id')
  deleteContact(@Param('id') id: string) {
    return this.service.remove('contacts', id);
  }

  @Get('leads')
  listLeads(@Query() query: Record<string, any>) {
    return this.service.list('leads', query);
  }

  @Post('leads')
  createLead(@Body() body: Record<string, any>) {
    return this.service.create('leads', body);
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string) {
    return this.service.findOne('leads', id);
  }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('leads', id, body);
  }

  @Delete('leads/:id')
  deleteLead(@Param('id') id: string) {
    return this.service.remove('leads', id);
  }

  @Get('opportunities')
  listOpportunities(@Query() query: Record<string, any>) {
    return this.service.list('opportunities', query);
  }

  @Post('opportunities')
  createOpportunity(@Body() body: Record<string, any>) {
    return this.service.create('opportunities', body);
  }

  @Get('opportunities/:id')
  getOpportunity(@Param('id') id: string) {
    return this.service.findOne('opportunities', id);
  }

  @Patch('opportunities/:id')
  updateOpportunity(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('opportunities', id, body);
  }

  @Delete('opportunities/:id')
  deleteOpportunity(@Param('id') id: string) {
    return this.service.remove('opportunities', id);
  }

  @Patch('opportunities/:id/stage')
  updateOpportunityStage(@Param('id') id: string, @Body() body: { stage?: string }) {
    return this.service.updateOpportunityStage(id, String(body.stage || ''));
  }

  @Get('activities')
  listActivities(@Query() query: Record<string, any>) {
    return this.service.list('activities', query);
  }

  @Post('activities')
  createActivity(@Body() body: Record<string, any>) {
    return this.service.create('activities', body);
  }

  @Patch('activities/:id')
  updateActivity(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('activities', id, body);
  }

  @Delete('activities/:id')
  deleteActivity(@Param('id') id: string) {
    return this.service.remove('activities', id);
  }

  @Patch('activities/:id/complete')
  completeActivity(@Param('id') id: string) {
    return this.service.completeActivity(id);
  }

  @Get('pipeline')
  pipeline(@Query() query: Record<string, any>) {
    return this.service.pipeline(query);
  }
}
