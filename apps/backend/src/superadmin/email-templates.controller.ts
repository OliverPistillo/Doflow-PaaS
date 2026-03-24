import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly svc: EmailTemplatesService) {}

  @Get('stats')
  getStats() { return this.svc.getStats(); }

  @Get()
  findAll(@Query('category') category?: string) {
    return this.svc.findAll(category as any);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.delete(id); }

  @Post('preview')
  preview(@Body() body: { slug: string; testData: Record<string, string> }) {
    return this.svc.findBySlug(body.slug).then(tpl => this.svc.preview(tpl, body.testData));
  }

  @Post('send')
  send(@Body() body: { slug: string; to: string; variables: Record<string, string> }) {
    return this.svc.sendWithTemplate(body.slug, body.to, body.variables);
  }

  @Post('campaign')
  campaign(@Body() body: { slug: string; extraVars?: Record<string, string> }) {
    return this.svc.sendCampaign(body.slug, body.extraVars);
  }
}
