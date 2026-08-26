import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantConversationsService } from './tenant-conversations.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';

@Controller('tenant/collaboration')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewTeam')
export class TenantConversationsController {
  constructor(private readonly service: TenantConversationsService) {}

  @Get('conversations') list(@Query() query: Record<string, unknown>) { return this.service.listConversations(query || {}); }
  @RequireTenantCapability('canCreateConversations')
  @Post('conversations') create(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.createConversation(body || {}, key); }
  @Get('conversations/:id') get(@Param('id') id: string) { return this.service.getConversation(id); }
  @RequireTenantCapability('canManageConversations')
  @Post('conversations/:id/participants') participants(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.addParticipants(id, body || {}, key); }
  @RequireTenantCapability('canManageConversations')
  @Delete('conversations/:id/participants/:userId') removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @Headers('idempotency-key') key?: string) { return this.service.removeParticipant(id, userId, key); }
  @Post('conversations/:id/leave') leave(@Param('id') id: string, @Headers('idempotency-key') key?: string) { return this.service.leaveConversation(id, key); }
  @Get('conversations/:id/messages') messages(@Param('id') id: string, @Query() query: Record<string, unknown>) { return this.service.listMessages(id, query || {}); }
  @RequireTenantCapability('canSendMessages')
  @Post('conversations/:id/messages') send(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.sendMessage(id, body || {}, key); }
  @RequireTenantCapability('canEditMessages')
  @Patch('conversations/:id/messages/:messageId') update(@Param('id') id: string, @Param('messageId') messageId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.updateMessage(id, messageId, body || {}, key); }
  @RequireTenantCapability('canDeleteMessages')
  @Delete('conversations/:id/messages/:messageId') remove(@Param('id') id: string, @Param('messageId') messageId: string, @Headers('idempotency-key') key?: string) { return this.service.deleteMessage(id, messageId, key); }
  @RequireTenantCapability('canReactMessages')
  @Post('conversations/:id/messages/:messageId/reactions') react(@Param('id') id: string, @Param('messageId') messageId: string, @Body() body: Record<string, unknown>) { return this.service.setReaction(id, messageId, body || {}, true); }
  @RequireTenantCapability('canReactMessages')
  @Delete('conversations/:id/messages/:messageId/reactions/:emoji') unreact(@Param('id') id: string, @Param('messageId') messageId: string, @Param('emoji') emoji: string) { return this.service.setReaction(id, messageId, emoji, false); }
  @Post('conversations/:id/messages/:messageId/read') read(@Param('id') id: string, @Param('messageId') messageId: string) { return this.service.markRead(id, messageId); }
  @Get('conversations/:id/messages/:messageId/revisions') revisions(@Param('id') id: string, @Param('messageId') messageId: string) { return this.service.revisions(id, messageId); }
}
