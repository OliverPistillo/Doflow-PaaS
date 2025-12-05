import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('tenant')
export class TenantController {
  @Get('schema')
  getSchema(@Req() req: Request) {
    const tenantId = (req as any).tenantId ?? 'unknown';

    return {
      status: 'ok',
      tenantId,
    };
  }
}
