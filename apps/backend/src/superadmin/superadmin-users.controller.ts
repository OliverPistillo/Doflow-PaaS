import {
  Controller,
  Get,
  Req,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';

function assertSuperAdmin(req: Request) {
  const user = (req as any).authUser ?? (req as any).user;
  const role = String(user?.role ?? '').toLowerCase().trim();
  if (role !== 'superadmin' && role !== 'owner') {
    throw new ForbiddenException('SuperAdmin only');
  }
}

@Controller('superadmin')
export class SuperadminUsersController {
  private readonly logger = new Logger(SuperadminUsersController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Get('users')
  async list(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('tenant') tenant?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    assertSuperAdmin(req);

    const limit = Math.min(Math.max(parseInt(limitRaw || '200', 10) || 200, 1), 500);
    const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);

    const query = (q || '').trim();
    const tenantFilter = (tenant || '').trim().toLowerCase();

    try {
      await this.dataSource.query('select 1');

      const rows = await this.dataSource.query(
        `
        select
          id,
          email,
          role,
          tenant_id,
          is_active,
          created_at,
          updated_at
        from public.users
        where
          ($1 = '' or email ilike '%' || $1 || '%'
                 or role ilike '%' || $1 || '%'
                 or tenant_id ilike '%' || $1 || '%')
          and ($2 = '' or tenant_id = $2)
        order by created_at desc
        limit $3 offset $4
        `,
        [query, tenantFilter, limit, offset],
      );

      return { users: rows, limit, offset };
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.logger.error(`[GET /superadmin/users] ${msg}`, e?.stack || undefined);
      throw new InternalServerErrorException({
        error: 'INTERNAL_ERROR',
        where: 'GET /superadmin/users',
        message: msg,
        code: e?.code,
      });
    }
  }
}
