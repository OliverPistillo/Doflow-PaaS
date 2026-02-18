import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

@Controller('tenant')
export class TenantController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('schema')
  getSchema(@Req() req: Request) {
    const tenantId = (req as any).tenantId ?? 'unknown';
    return { status: 'ok', tenantId };
  }

  /**
   * GET /api/tenant/me
   * Restituisce il profilo completo del tenant corrente:
   * piano, limiti, storage, etc.
   * Usato dal frontend per il PlanContext.
   */
  @Get('me')
  async getMe(@Req() req: Request) {
    const schema = (req as any).tenantId as string | undefined;

    // Superadmin su public schema non hanno un tenant record
    if (!schema || schema === 'public') {
      return {
        id:             null,
        name:           'DoFlow Platform',
        slug:           'public',
        planTier:       'ENTERPRISE',
        isActive:       true,
        maxUsers:       9999,
        storageUsedMb:  0,
        storageLimitGb: 999,
      };
    }

    const safe = safeSchema(schema, 'TenantController.getMe');

    const rows = await this.dataSource.query(
      `SELECT
         id, name, slug, plan_tier AS "planTier",
         is_active AS "isActive",
         max_users AS "maxUsers",
         storage_used_mb AS "storageUsedMb",
         storage_limit_gb AS "storageLimitGb",
         admin_email AS "adminEmail",
         created_at AS "createdAt"
       FROM public.tenants
       WHERE schema_name = $1
       LIMIT 1`,
      [safe],
    );

    if (!rows[0]) {
      throw new UnauthorizedException('Tenant not found');
    }

    return rows[0];
  }
}
