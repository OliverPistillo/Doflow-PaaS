import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantFinanceService } from './tenant-finance.service';

@Controller('tenant/finance')
@UseGuards(JwtAuthGuard)
export class TenantFinanceController {
  constructor(private readonly service: TenantFinanceService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('invoices')
  listInvoices(@Query() query: Record<string, any>) {
    return this.service.list('invoices', query);
  }

  @Post('invoices')
  createInvoice(@Body() body: Record<string, any>) {
    return this.service.createInvoice(body || {});
  }

  @Post('invoices/from-quote/:quoteId')
  createInvoiceFromQuote(@Param('quoteId') quoteId: string, @Body() body: Record<string, any>) {
    return this.service.createInvoiceFromQuote(quoteId, body || {});
  }

  @Post('invoices/from-project/:projectId')
  createInvoiceFromProject(@Param('projectId') projectId: string, @Body() body: Record<string, any>) {
    return this.service.createInvoiceFromProject(projectId, body || {});
  }

  @Get('invoices/:id')
  findInvoice(@Param('id') id: string) {
    return this.service.findInvoice(id);
  }

  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateInvoice(id, body || {});
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string) {
    return this.service.deleteInvoice(id);
  }

  @Patch('invoices/:id/status')
  updateInvoiceStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateInvoiceStatus(id, String(body.status || ''));
  }

  @Post('invoices/:id/recalculate')
  recalculateInvoice(@Param('id') id: string) {
    return this.service.recalculateInvoice(id);
  }

  @Post('invoices/:id/items')
  addInvoiceItem(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.addInvoiceItem(id, body || {});
  }

  @Patch('invoices/:id/items/:itemId')
  updateInvoiceItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: Record<string, any>) {
    return this.service.updateInvoiceItem(id, itemId, body || {});
  }

  @Delete('invoices/:id/items/:itemId')
  deleteInvoiceItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.deleteInvoiceItem(id, itemId);
  }

  @Post('invoices/:id/payments')
  createInvoicePayment(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createPayment(body || {}, id);
  }

  @Get('payments')
  listPayments(@Query() query: Record<string, any>) {
    return this.service.list('payments', query);
  }

  @Post('payments')
  createPayment(@Body() body: Record<string, any>) {
    return this.service.createPayment(body || {});
  }

  @Get('payments/:id')
  findPayment(@Param('id') id: string) {
    return this.service.findPayment(id);
  }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updatePayment(id, body || {});
  }

  @Delete('payments/:id')
  deletePayment(@Param('id') id: string) {
    return this.service.deletePayment(id);
  }

  @Get('deadlines')
  listDeadlines(@Query() query: Record<string, any>) {
    return this.service.list('financial_deadlines', query);
  }

  @Post('deadlines')
  createDeadline(@Body() body: Record<string, any>) {
    return this.service.createDeadline(body || {});
  }

  @Patch('deadlines/:id')
  updateDeadline(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateDeadline(id, body || {});
  }

  @Delete('deadlines/:id')
  deleteDeadline(@Param('id') id: string) {
    return this.service.deleteDeadline(id);
  }

  @Patch('deadlines/:id/complete')
  completeDeadline(@Param('id') id: string) {
    return this.service.completeDeadline(id);
  }

  @Get('recurring-services')
  listRecurringServices(@Query() query: Record<string, any>) {
    return this.service.list('recurring_services', query);
  }

  @Post('recurring-services')
  createRecurringService(@Body() body: Record<string, any>) {
    return this.service.createRecurringService(body || {});
  }

  @Get('recurring-services/:id')
  findRecurringService(@Param('id') id: string) {
    return this.service.findRecurringService(id);
  }

  @Patch('recurring-services/:id')
  updateRecurringService(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateRecurringService(id, body || {});
  }

  @Delete('recurring-services/:id')
  deleteRecurringService(@Param('id') id: string) {
    return this.service.deleteRecurringService(id);
  }

  @Get('renewals')
  listRenewals(@Query() query: Record<string, any>) {
    return this.service.list('renewals', query);
  }

  @Post('renewals')
  createRenewal(@Body() body: Record<string, any>) {
    return this.service.createRenewal(body || {});
  }

  @Patch('renewals/:id')
  updateRenewal(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateRenewal(id, body || {});
  }

  @Delete('renewals/:id')
  deleteRenewal(@Param('id') id: string) {
    return this.service.deleteRenewal(id);
  }

  @Patch('renewals/:id/status')
  updateRenewalStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateRenewalStatus(id, String(body.status || ''));
  }

  @Get('projects/:projectId/status')
  getProjectFinancialStatus(@Param('projectId') projectId: string) {
    return this.service.getProjectFinancialStatus(projectId);
  }

  @Patch('projects/:projectId/status')
  updateProjectFinancialStatus(@Param('projectId') projectId: string, @Body() body: Record<string, any>) {
    return this.service.updateProjectFinancialStatus(projectId, body || {});
  }

  @Post('projects/:projectId/recalculate')
  recalculateProjectFinancialStatus(@Param('projectId') projectId: string) {
    return this.service.recalculateProjectFinancialStatus(projectId);
  }
}
