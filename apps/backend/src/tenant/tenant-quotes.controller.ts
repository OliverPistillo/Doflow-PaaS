import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantQuotesService } from './tenant-quotes.service';

@Controller('tenant/quotes')
@UseGuards(JwtAuthGuard)
export class TenantQuotesController {
  constructor(private readonly service: TenantQuotesService) {}

  @Get('service-templates')
  listServiceTemplates(@Query() query: Record<string, any>) {
    return this.service.list('serviceTemplates', query);
  }

  @Post('service-templates')
  createServiceTemplate(@Body() body: Record<string, any>) {
    return this.service.create('serviceTemplates', body);
  }

  @Patch('service-templates/:id')
  updateServiceTemplate(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('serviceTemplates', id, body);
  }

  @Delete('service-templates/:id')
  deleteServiceTemplate(@Param('id') id: string) {
    return this.service.remove('serviceTemplates', id);
  }

  @Get()
  listQuotes(@Query() query: Record<string, any>) {
    return this.service.list('quotes', query);
  }

  @Post()
  createQuote(@Body() body: Record<string, any>) {
    return this.service.create('quotes', body);
  }

  @Get(':id')
  getQuote(@Param('id') id: string) {
    return this.service.findOne('quotes', id);
  }

  @Patch(':id')
  updateQuote(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update('quotes', id, body);
  }

  @Delete(':id')
  deleteQuote(@Param('id') id: string) {
    return this.service.remove('quotes', id);
  }

  @Patch(':id/status')
  updateQuoteStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateQuoteStatus(id, String(body.status || ''));
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.addItem(id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: Record<string, any>) {
    return this.service.updateItem(id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  deleteItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.deleteItem(id, itemId);
  }

  @Post(':id/recalculate')
  recalculate(@Param('id') id: string) {
    return this.service.recalculate(id);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.accept(id, body || {});
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
