import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireFeature } from '../feature-access/feature-access.decorator';
import { TenantLivekitService } from './tenant-livekit.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';

@Controller('tenant/collaboration/calls')
@UseGuards(JwtAuthGuard, ThrottlerGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewTeam')
export class TenantLivekitController {
  constructor(private readonly service: TenantLivekitService) {}

  @Get('status')
  status() { return this.service.status(); }

  @Post('presence')
  @RequireFeature('collab.calls')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  heartbeat(@Body() body: Record<string, unknown>) { return this.service.heartbeat(body || {}); }

  @Post('presence/disconnect')
  @RequireFeature('collab.calls')
  disconnect(@Body() body: Record<string, unknown>) { return this.service.disconnect(body || {}); }

  @Post()
  @RequireFeature('collab.calls')
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  create(
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) { return this.service.create(body || {}, idempotencyKey); }

  @Post('guest-invites')
  @RequireFeature('collab.calls')
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  createGuest(
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) { return this.service.createGuestMeeting(body || {}, idempotencyKey); }

  @Delete('guest-invites/:inviteId')
  @RequireFeature('collab.calls')
  revokeGuest(@Param('inviteId') inviteId: string, @Body() body: Record<string, unknown>) {
    return this.service.revokeGuestInvite(inviteId, body || {});
  }

  @Get('incoming')
  @RequireFeature('collab.calls')
  incoming(@Query() query: Record<string, unknown>) { return this.service.incoming(query || {}); }

  @Get(':callId')
  @RequireFeature('collab.calls')
  detail(@Param('callId') callId: string, @Query() query: Record<string, unknown>) {
    return this.service.detail(callId, query || {});
  }

  @Post(':callId/accept')
  @RequireFeature('collab.calls')
  accept(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.accept(callId, body || {});
  }

  @Post(':callId/reject')
  @RequireFeature('collab.calls')
  reject(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.reject(callId, body || {});
  }

  @Post(':callId/cancel')
  @RequireFeature('collab.calls')
  cancel(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.cancel(callId, body || {});
  }

  @Post(':callId/end')
  @RequireFeature('collab.calls')
  end(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.end(callId, body || {});
  }

  @Post(':callId/fail')
  @RequireFeature('collab.calls')
  fail(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.fail(callId, body || {});
  }

  @Post(':callId/token')
  @RequireFeature('collab.calls')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  token(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.token(callId, body || {});
  }

  /** Compatibility with the hidden pre-1.1 client; still requires a live Desktop device. */
  @Delete(':callId')
  @RequireFeature('collab.calls')
  legacyEnd(@Param('callId') callId: string, @Body() body: Record<string, unknown>) {
    return this.service.end(callId, body || {});
  }
}
