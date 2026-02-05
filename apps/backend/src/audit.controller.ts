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
export class SuperadminAuditController {
  private readonly logger = new Logger(SuperadminAuditController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Get('audit')
  async list(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    assertSuperAdmin(req);

    const limit = Math.min(Math.max(parseInt(limitRaw || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);
    const query = (q || '').trim();

    try {
      await this.dataSource.query('select 1');

      // Tentativo "ricco" (se la tabella ha queste colonne)
      try {
        const rows = await this.dataSource.query(
          `
          select
            id,
            action,
            actor_email,
            actor_role,
            target_email,
            metadata,
            ip,
            created_at
          from public.audit_log
          where (
            $1 = '' or
            action ilike '%' || $1 || '%' or
            coalesce(actor_email,'') ilike '%' || $1 || '%' or
            coalesce(target_email,'') ilike '%' || $1 || '%' or
            coalesce(ip,'') ilike '%' || $1 || '%'
          )
          order by created_at desc
          limit $2 offset $3
          `,
          [query, limit, offset],
        );

        return { logs: rows, limit, offset };
      } catch (e: any) {
        // Fallback "minimo" se qualche colonna non esiste
        this.logger.warn(`[GET /superadmin/audit] rich_select_failed -> fallback: ${e?.message || e}`);

        const rows = await this.dataSource.query(
          `
          select *
          from public.audit_log
          order by created_at desc
          limit $1 offset $2
          `,
          [limit, offset],
        );

        return { logs: rows, limit, offset, warning: 'fallback_select_star' };
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.logger.error(`[GET /superadmin/audit] ${msg}`, e?.stack || undefined);
      throw new InternalServerErrorException({
        error: 'INTERNAL_ERROR',
        where: 'GET /superadmin/audit',
        message: msg,
        code: e?.code,
      });
    }
  }
}
