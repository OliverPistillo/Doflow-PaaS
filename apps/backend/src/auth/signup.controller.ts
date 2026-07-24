// apps/backend/src/auth/signup.controller.ts
// Public endpoints (no auth) for self-service tenant signup + slug check.

import { Body, Controller, Get, Post, Query, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { SignupService } from './signup.service';
import { SignupTenantDto } from './dto/signup-tenant.dto';
import { AuditService } from '../audit.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class SignupController {
  constructor(
    private readonly signupService: SignupService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Public endpoint — verifica disponibilità slug per validazione live nel form.
   * Rate-limited a 30 chiamate/min per IP.
   */
  @Get('check-slug')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async checkSlug(@Query('slug') slug: string) {
    return this.signupService.checkSlugAvailability(slug || '');
  }

  /**
   * Public endpoint — crea nuovo tenant + schema + admin user.
   * Rate-limited a 5 signup/ora per IP per evitare abuse.
   */
  @Post('signup-tenant')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 5 } })
  async signupTenant(@Body() dto: SignupTenantDto, @Req() req: Request) {
    try {
      const result = await this.signupService.signup(dto);
      await this.auditService.log(req, {
        action: 'tenant_signup_success',
        targetEmail: dto.email,
        metadata: { slug: dto.slug, planTier: dto.planTier || 'STARTER' },
      });
      return result;
    } catch (err: any) {
      await this.auditService.log(req, {
        action: 'tenant_signup_failed',
        targetEmail: dto.email,
        metadata: { slug: dto.slug, reason: err?.message || 'unknown' },
      });
      throw err;
    }
  }
}
