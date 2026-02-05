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
    @Query('target_email') targetEmailRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    assertSuperAdmin(req);

    const limit = Math.min(Math.max(parseInt(limitRaw || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);

    // retrocompat: q generico, + filtro dedicato per target_email
    const query = (q || '').trim();
    const targetEmail = (targetEmailRaw || '').trim().toLowerCase();

    try {
      await this.dataSource.query('select 1');

      // Tentativo "ricco" (se la tabella ha queste colonne)
      try {
        // WHERE: se target_email presente => filtro stretto.
        // altrimenti: usa q come ricerca generica (retrocompat)
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
            -- filtro primario: target_email
            ($1 <> '' and lower(coalesce(target_email,'')) = $1)
            or
            -- fallback: ricerca generica q (solo se target_email non passato)
            ($1 = '' and (
              $2 = '' or
              action ilike '%' || $2 || '%' or
              coalesce(actor_email,'') ilike '%' || $2 || '%' or
              coalesce(target_email,'') ilike '%' || $2 || '%' or
              coalesce(ip,'') ilike '%' || $2 || '%'
            ))
          )
          order by created_at desc, id desc
          limit $3 offset $4
          `,
          [targetEmail, query, limit, offset],
        );

        // total per pagination (stessa logica filtri)
        const totalRows = await this.dataSource.query(
          `
          select count(*)::int as total
          from public.audit_log
          where (
            ($1 <> '' and lower(coalesce(target_email,'')) = $1)
            or
            ($1 = '' and (
              $2 = '' or
              action ilike '%' || $2 || '%' or
              coalesce(actor_email,'') ilike '%' || $2 || '%' or
              coalesce(target_email,'') ilike '%' || $2 || '%' or
              coalesce(ip,'') ilike '%' || $2 || '%'
            ))
          )
          `,
          [targetEmail, query],
        );

        return {
          logs: rows,
          limit,
          offset,
          total: totalRows?.[0]?.total ?? 0,
          target_email: targetEmail || null,
          q: query || null,
        };
      } catch (e: any) {
        // Fallback "minimo" se qualche colonna non esiste
        this.logger.warn(
          `[GET /superadmin/audit] rich_select_failed -> fallback: ${e?.message || e}`,
        );

        // NB: fallback mantiene comunque target_email se possibile
        if (targetEmail) {
          // se la tabella non ha target_email, questa query fallirà:
          // allora scendiamo al select * senza filtro, come ultimo fallback.
          try {
            const rows = await this.dataSource.query(
              `
              select *
              from public.audit_log
              where lower(coalesce(target_email,'')) = $1
              order by created_at desc, id desc
              limit $2 offset $3
              `,
              [targetEmail, limit, offset],
            );

            const totalRows = await this.dataSource.query(
              `
              select count(*)::int as total
              from public.audit_log
              where lower(coalesce(target_email,'')) = $1
              `,
              [targetEmail],
            );

            return {
              logs: rows,
              limit,
              offset,
              total: totalRows?.[0]?.total ?? 0,
              target_email: targetEmail,
              warning: 'fallback_select_star_filtered',
            };
          } catch (e2: any) {
            this.logger.warn(
              `[GET /superadmin/audit] fallback_filtered_failed -> select * no filter: ${e2?.message || e2}`,
            );
          }
        }

        const rows = await this.dataSource.query(
          `
          select *
          from public.audit_log
          order by created_at desc, id desc
          limit $1 offset $2
          `,
          [limit, offset],
        );

        // total "globale" nel fallback ultimo
        const totalRows = await this.dataSource.query(
          `select count(*)::int as total from public.audit_log`,
        );

        return {
          logs: rows,
          limit,
          offset,
          total: totalRows?.[0]?.total ?? 0,
          warning: 'fallback_select_star',
        };
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
