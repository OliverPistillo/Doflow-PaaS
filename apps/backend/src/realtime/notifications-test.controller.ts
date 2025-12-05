import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';

@Controller('realtime-test')
export class NotificationsTestController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('tenant')
  async tenantPing(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    body: {
      message: string;
    },
  ) {
    const authUser = (req as any).authUser as
      | { id: string; email?: string | null }
      | undefined;
    const tenantId = (req as any).tenantId as string | undefined;

    if (!authUser || !tenantId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await this.notifications.notifyTenant(tenantId, {
      kind: 'test',
      message: body.message ?? 'Test notification',
      fromUserId: authUser.id,
      ts: new Date().toISOString(),
    });

    return res.json({ ok: true });
  }

  @Post('user')
  async userPing(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    body: {
      message: string;
    },
  ) {
    const authUser = (req as any).authUser as
      | { id: string; email?: string | null }
      | undefined;
    const tenantId = (req as any).tenantId as string | undefined;

    if (!authUser || !tenantId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await this.notifications.notifyUser(authUser.id, {
      kind: 'test-user',
      message: body.message ?? 'Test user notification',
      tenantId,
      ts: new Date().toISOString(),
    });

    return res.json({ ok: true });
  }
}
