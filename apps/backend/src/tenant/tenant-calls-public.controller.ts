import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { TenantCallsPublicService } from './tenant-calls-public.service';

@Controller('public/desktop-calls')
@UseGuards(ThrottlerGuard)
export class TenantCallsPublicController {
  constructor(private readonly service: TenantCallsPublicService) {}

  @Post('guest/resolve')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  preview(@Body() body: Record<string, unknown>) { return this.service.preview(body || {}); }

  @Post('guest/token')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  join(@Body() body: Record<string, unknown>) { return this.service.join(body || {}); }

  @Post('guest/token/renew')
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  renew(@Body() body: Record<string, unknown>) { return this.service.renew(body || {}); }

  @Post('webhook/livekit')
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('authorization') authorization?: string,
  ) { return this.service.webhook(request.rawBody, authorization); }
}
