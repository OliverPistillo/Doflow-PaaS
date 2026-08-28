import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { TenantBackendContractsService } from './tenant-backend-contracts.service';

@Controller('tenant/backend-contracts')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard)
export class TenantBackendContractsController {
  constructor(private readonly service: TenantBackendContractsService) {}
  private requiredKey(key?: string) { if (!String(key || '').trim()) throw new BadRequestException('Idempotency-Key obbligatoria'); return String(key).trim(); }

  @Get('calendar-integrations') calendarIntegrations() { return this.service.calendarIntegrations(); }
  @Patch('calendar-integrations') updateCalendarIntegrations(@Body() body: Record<string, unknown>) { return this.service.updateCalendarIntegrations(body || {}); }
  @Post('calendar-integrations/sync') syncCalendarProjection(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.syncCalendarProjection(body || {}, this.requiredKey(key)); }
  @Post('calendar-integrations/ics-token') rotateIcsToken() { return this.service.rotateIcsToken(); }
  @Post('calendar-integrations/ics-token/revoke') revokeIcsToken() { return this.service.revokeIcsToken(); }
  @Post('calendar-integrations/google/disconnect') disconnectGoogleCalendar() { return this.service.disconnectGoogleCalendar(); }

  @Get('commerce-settings') commerceSettings() { return this.service.commerceSettings(); }
  @Patch('commerce-settings') updateCommerceSettings(@Body() body: Record<string, unknown>) { return this.service.updateCommerceSettings(body || {}); }

  @Get('customers/:companyId/care') customerCare(@Param('companyId') companyId: string) { return this.service.customerCare(companyId); }
  @Get('customers-state') customerContractState() { return this.service.customerContractState(); }
  @Patch('customers/:companyId/care') updateCustomerCare(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>) { return this.service.updateCustomerCare(companyId, body || {}); }
  @Get('customers/:companyId/finance') customerFinance(@Param('companyId') companyId: string) { return this.service.customerFinance(companyId); }
  @Patch('customers/:companyId/finance') updateCustomerFinance(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.updateCustomerFinance(companyId, body || {}, this.requiredKey(key)); }
  @Get('customers/:companyId/documents') customerDocuments(@Param('companyId') companyId: string) { return this.service.customerDocuments(companyId); }
  @Post('customers/:companyId/documents') addCustomerDocument(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.addCustomerDocument(companyId, body || {}, key); }
  @Patch('customers/:companyId/documents/:documentId') updateCustomerDocument(@Param('companyId') companyId: string, @Param('documentId') documentId: string, @Body() body: Record<string, unknown>) { return this.service.updateCustomerDocument(companyId, documentId, body || {}); }
  @Delete('customers/:companyId/documents/:documentId') archiveCustomerDocument(@Param('companyId') companyId: string, @Param('documentId') documentId: string) { return this.service.archiveCustomerDocument(companyId, documentId); }

  @Get('inbox/state') inboxState() { return this.service.inboxState(); }
  @Patch('inbox/conversations/:companyId') updateInboxConversation(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.updateInboxConversation(companyId, body || {}, this.requiredKey(key)); }
  @Post('inbox/conversations/:companyId/messages') scheduleInboxMessage(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.scheduleInboxMessage(companyId, body || {}, this.requiredKey(key)); }
  @Post('inbox/conversations/:companyId/email') sendInboxEmail(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.sendInboxEmail(companyId, body || {}, this.requiredKey(key)); }
  @Put('inbox/conversations/:companyId/draft') saveInboxDraft(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>) { return this.service.saveInboxDraft(companyId, body || {}); }
  @Post('inbox/conversations/:companyId/read') markInboxRead(@Param('companyId') companyId: string) { return this.service.markInboxRead(companyId); }
  @Put('inbox/filters') saveInboxFilters(@Body() body: Record<string, unknown>) { return this.service.saveInboxFilters(body || {}); }

  @Get('guided-calls') guidedCalls() { return this.service.guidedCalls(); }
  @Post('guided-calls') startGuidedCall(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.startGuidedCall(body || {}, this.requiredKey(key)); }
  @Patch('guided-calls/:id') updateGuidedCall(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.updateGuidedCall(id, body || {}, this.requiredKey(key)); }
  @Post('guided-calls/:id/messages') addGuidedCallMessage(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.addGuidedCallMessage(id, body || {}, this.requiredKey(key)); }
  @Patch('guided-calls/:id/messages/:messageId') updateGuidedCallMessage(@Param('id') id: string, @Param('messageId') messageId: string, @Body() body: Record<string, unknown>) { return this.service.updateGuidedCallMessage(id, messageId, body || {}); }
  @Post('guided-calls/:id/complete') completeGuidedCall(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.completeGuidedCall(id, body || {}, this.requiredKey(key)); }

  @Get('team-duties') teamDuties() { return this.service.teamDuties(); }
  @Post('team-duties') createTeamDuty(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.createTeamDuty(body || {}, this.requiredKey(key)); }
  @Patch('team-duties/:id') updateTeamDuty(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.updateTeamDuty(id, body || {}, this.requiredKey(key)); }
  @Post('team-duties/:id/approve') approveTeamDuty(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.approveTeamDuty(id, body || {}, this.requiredKey(key)); }
  @Get('team-duties/:id/history') teamDutyHistory(@Param('id') id: string) { return this.service.teamDutyHistory(id); }
  @Post('team-duties/:id/read') markTeamDutyRead(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.markTeamDutyRead(id, body || {}); }
}
