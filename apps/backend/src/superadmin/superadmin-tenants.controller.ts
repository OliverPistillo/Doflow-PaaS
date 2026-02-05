import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Delete,
  Body,
  Req,
  Param,
  Patch,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { SystemStatsService } from './telemetry.service';

// --- Types ---
type CreateTenantBody = {
  slug: string;
  name: string;
  schema_name?: string;
  admin_email: string;
  admin_password: string;
  plan_tier?: string;
};

type UpdateTenantBody = {
  name?: string;
  plan_tier?: string;
  max_users?: number;
  is_active?: boolean;
};

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

@Controller('superadmin')
export class SuperadminTenantsController {
  private readonly logger = new Logger(SuperadminTenantsController.name);

  constructor(
    private readonly bootstrap: TenantBootstrapService,
    private readonly telemetry: SystemStatsService,
    private readonly dataSource: DataSource, // ✅ public/default datasource
  ) {}

  private assertSuperAdmin(req: Request) {
    const user = (req as any).authUser ?? (req as any).user;
    const role = String(user?.role ?? '').toLowerCase().trim();
    if (role !== 'superadmin' && role !== 'owner') {
      throw new ForbiddenException('SuperAdmin only');
    }
  }

  private async openTenantDs(schema: string): Promise<DataSource> {
    const s = safeSchema(schema);

    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Missing DATABASE_URL');

    const ds = new DataSource({
      type: 'postgres',
      url,
      schema: s,
      synchronize: false,
    });

    await ds.initialize();
    return ds;
  }

  private logAndThrow500(where: string, e: any): never {
    const msg = e?.message || String(e);
    const code = e?.code;
    this.logger.error(`[${where}] ${msg}`, e?.stack || undefined);

    throw new InternalServerErrorException({
      error: 'INTERNAL_ERROR',
      where,
      message: msg,
      code,
    });
  }

  // ==========================================
  // 1) SYSTEM HEALTH & METRICS
  // ==========================================
  @Get('system/stats')
  async getSystemStats(@Req() req: Request) {
    this.assertSuperAdmin(req);
    try {
      return await this.telemetry.getSystemStats();
    } catch (e) {
      this.logAndThrow500('GET /superadmin/system/stats', e);
    }
  }

  @Get('system/metrics')
  async getSystemMetrics(@Req() req: Request) {
    this.assertSuperAdmin(req);
    try {
      return await this.telemetry.getSystemMetrics();
    } catch (e) {
      this.logAndThrow500('GET /superadmin/system/metrics', e);
    }
  }

  // ==========================================
  // 2) TENANTS CRUD (PUBLIC SCHEMA) - ENTERPRISE SAFE
  // ==========================================
  @Get('tenants')
  async list(@Req() req: Request) {
    this.assertSuperAdmin(req);

    try {
      // sanity: datasource alive
      await this.dataSource.query('select 1');

      // tentativo "ricco"
      try {
        const rows = await this.dataSource.query(
          `
          select
            id, slug, name, schema_name, is_active,
            plan_tier, max_users, storage_used_mb, admin_email,
            created_at, updated_at
          from public.tenants
          order by created_at desc
          `,
        );
        return { tenants: rows };
      } catch (e: any) {
        this.logger.warn(
          `[GET /superadmin/tenants] rich_select_failed -> fallback. ${e?.message || e}`,
        );

        // fallback "minimo"
        const rows = await this.dataSource.query(
          `
          select
            id, slug, name, schema_name, is_active,
            admin_email,
            created_at
          from public.tenants
          order by created_at desc
          `,
        );

        return { tenants: rows, warning: 'fallback_select_minimal' };
      }
    } catch (e) {
      this.logAndThrow500('GET /superadmin/tenants', e);
    }
  }

  @Post('tenants')
  async create(@Req() req: Request, @Body() body: CreateTenantBody) {
    this.assertSuperAdmin(req);

    try {
      const slug = (body.slug || '').trim().toLowerCase();
      const schemaName = safeSchema((body.schema_name || slug).trim().toLowerCase());
      const plan = (body.plan_tier || 'STARTER').trim();

      if (!slug || !body.name || !body.admin_email || !body.admin_password) {
        throw new BadRequestException('Missing fields');
      }

      if (!/^[a-z0-9_]+$/.test(slug)) {
        throw new BadRequestException('Invalid slug format');
      }

      // duplicati
      const dup = await this.dataSource.query(
        `select 1 from public.tenants where slug = $1 limit 1`,
        [slug],
      );
      if (dup?.length) throw new ConflictException('Tenant slug already exists');

      // 1) registro tenant
      const rows = await this.dataSource.query(
        `
        insert into public.tenants (slug, name, schema_name, admin_email, plan_tier, is_active, created_at)
        values ($1, $2, $3, $4, $5, true, now())
        returning id, slug, schema_name
        `,
        [slug, body.name, schemaName, body.admin_email, plan],
      );
      const tenant = rows[0];

      // 2) bootstrap schema + admin
      try {
        await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

        const tenantDs = await this.openTenantDs(schemaName);
        try {
          await this.bootstrap.ensureTenantTables(tenantDs, schemaName);
          await this.bootstrap.seedFirstAdmin(
            tenantDs,
            schemaName,
            body.admin_email,
            body.admin_password,
          );
        } finally {
          if (tenantDs.isInitialized) await tenantDs.destroy();
        }
      } catch (e: any) {
        // rollback registro tenant
        await this.dataSource.query(`delete from public.tenants where id = $1`, [tenant.id]);
        throw new BadRequestException('Bootstrap failed: ' + (e?.message || 'unknown'));
      }

      return { status: 'ok', tenant };
    } catch (e) {
      if (
        e instanceof BadRequestException ||
        e instanceof ConflictException ||
        e instanceof ForbiddenException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      this.logAndThrow500('POST /superadmin/tenants', e);
    }
  }

  @Patch('tenants/:id')
  async updateTenant(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateTenantBody) {
    this.assertSuperAdmin(req);

    try {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (body.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(body.name);
      }
      if (body.plan_tier !== undefined) {
        updates.push(`plan_tier = $${idx++}`);
        values.push(body.plan_tier);
      }
      if (body.max_users !== undefined) {
        updates.push(`max_users = $${idx++}`);
        values.push(body.max_users);
      }
      if (body.is_active !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(body.is_active);
      }

      if (updates.length === 0) return { message: 'Nothing to update' };

      values.push(id);
      const sql = `UPDATE public.tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
      const res = await this.dataSource.query(sql, values);

      if (!res?.length) throw new NotFoundException('Tenant not found');
      return { tenant: res[0] };
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logAndThrow500('PATCH /superadmin/tenants/:id', e);
    }
  }

  // ==========================================
  // 3) TENANT USERS DEBUG
  // ==========================================
  @Get('tenants/:id/users-list-debug')
  async getTenantUsers(@Req() req: Request, @Param('id') tenantId: string) {
    this.assertSuperAdmin(req);

    try {
      const tRows = await this.dataSource.query(
        `select schema_name, slug from public.tenants where id = $1`,
        [tenantId],
      );
      if (!tRows.length) throw new NotFoundException('Tenant not found');

      const schema = safeSchema(tRows[0].schema_name);

      const tenantDs = await this.openTenantDs(schema);
      try {
        const users = await tenantDs.query(
          `
          SELECT id, email, role, created_at
          FROM "${schema}"."users"
          ORDER BY created_at DESC
          `,
        );
        return { users };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logAndThrow500('GET /superadmin/tenants/:id/users-list-debug', e);
    }
  }

  @Delete('tenants/:id/users/:userId')
  async deleteTenantUser(@Req() req: Request, @Param('id') tenantId: string, @Param('userId') userId: string) {
    this.assertSuperAdmin(req);

    try {
      const tRows = await this.dataSource.query(
        `select schema_name from public.tenants where id = $1`,
        [tenantId],
      );
      if (!tRows.length) throw new NotFoundException('Tenant not found');

      const schema = safeSchema(tRows[0].schema_name);

      const tenantDs = await this.openTenantDs(schema);
      try {
        await tenantDs.query(`DELETE FROM "${schema}"."users" WHERE id = $1`, [userId]);
        return { status: 'deleted' };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logAndThrow500('DELETE /superadmin/tenants/:id/users/:userId', e);
    }
  }

  // ==========================================
  // 4) IMPERSONATION
  // ==========================================
  @Post('tenants/:id/impersonate')
  async impersonate(@Req() req: Request, @Param('id') tenantId: string, @Body() body: { email: string }) {
    this.assertSuperAdmin(req);

    try {
      const tRows = await this.dataSource.query(
        `select schema_name, slug from public.tenants where id = $1`,
        [tenantId],
      );
      if (!tRows.length) throw new NotFoundException('Tenant not found');

      const schema = safeSchema(tRows[0].schema_name);
      const slug = String(tRows[0].slug || '').trim().toLowerCase();

      const tenantDs = await this.openTenantDs(schema);
      try {
        const uRows = await tenantDs.query(
          `select id, email, role from "${schema}"."users" where email = $1`,
          [body.email],
        );

        if (!uRows.length) throw new NotFoundException(`User ${body.email} not found in tenant ${slug}`);
        const targetUser = uRows[0];

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is not defined');

        const payload = {
          sub: targetUser.id,
          email: targetUser.email,
          tenantId: schema,
          tenantSlug: slug,
          role: targetUser.role,
          isImpersonated: true,
        };

        const token = jwt.sign(payload, secret, { expiresIn: '1h' });

        return { token, redirectUrl: `/${slug}/dashboard` };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logAndThrow500('POST /superadmin/tenants/:id/impersonate', e);
    }
  }

  // ==========================================
  // 5) RESET ADMIN PASSWORD
  // ==========================================
  @Post('tenants/:id/reset-admin-password')
  async resetAdminPwd(
    @Req() req: Request,
    @Param('id') tenantId: string,
    @Body() body: { email: string; newPassword?: string },
  ) {
    this.assertSuperAdmin(req);

    try {
      const tRows = await this.dataSource.query(
        `select schema_name from public.tenants where id = $1`,
        [tenantId],
      );
      if (!tRows.length) throw new NotFoundException('Tenant not found');

      const schema = safeSchema(tRows[0].schema_name);

      const password = body.newPassword || Math.random().toString(36).slice(-8) + 'Aa1!';
      const hash = await bcrypt.hash(password, 10);

      const tenantDs = await this.openTenantDs(schema);
      try {
        await tenantDs.query(
          `update "${schema}"."users" set password_hash = $1 where email = $2`,
          [hash, body.email],
        );
        return { status: 'success', email: body.email, tempPassword: password };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
      this.logAndThrow500('POST /superadmin/tenants/:id/reset-admin-password', e);
    }
  }
}
