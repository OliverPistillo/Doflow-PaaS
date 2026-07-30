import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { getClientIpForRateLimit } from '../common/client-ip.utils';
import { PublicLeadIntakeDto } from './public-lead-intake.dto';
import { PublicLeadIntakeService, PublicLeadRateLimitException } from './public-lead-intake.service';

@Controller('public/lead-intake')
export class PublicLeadIntakeController {
  constructor(private readonly service: PublicLeadIntakeService) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: PublicLeadIntakeDto,
    @Headers('origin') origin: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.service.submit(tenantSlug, body, {
        origin: origin || null,
        ip: getClientIpForRateLimit(req),
      });
    } catch (error) {
      if (error instanceof PublicLeadRateLimitException) {
        res.setHeader('Retry-After', String(error.retryAfter));
      }
      throw error;
    }
  }

}
