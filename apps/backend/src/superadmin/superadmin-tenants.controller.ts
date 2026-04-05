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
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { SystemStatsService } from './telemetry.service';

// --- Types ---
type CreateTenantBody = {
  slug: string;
  name: string;
  schema_name?: string;
  admin_email: string;      // input UI / API: lo mappiamo su public.tenants.contact_email
  admin_password: string;
  plan_tier?: string;
};

type UpdateTenantBody = {
  name?: string;
  plan_tier?: string;
  max_users?: number;
  is_active?: boolean;
  contact_email?: string;   // opzionale: se vuoi aggiornare anche email contatto
  vat_number?: string;      // opzionale
};

// --- Helpers ---

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

function clampInt(n: any, def: number, min: number, max: number) {
  const v = Number.parseInt(String(n ?? ''), 10);
  if (Number.isNaN(v)) return def;
  return Math.min(max, Math.max(min, v));
}

function safeLike(q: string) {
  return q.replace(/[%_]/g, (m) => `\\${m}`);
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

  private actor(req: Request) {
    const user = (req as any).authUser ?? (req as any).user;
    return {
      email: user?.email ?? null,
      role: user?.role ?? null,
      ip: (req.ip as string | undefined) ?? null,
    };
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

  private async getTenantById(tenantId: string) {
    const rows = await this.dataSource.query(
      `
      select id, slug, name, schema_name, is_active
      from public.tenants
      where id = $1
      limit 1
      `,
      [tenantId],
    );
    return rows?.[0] ?? null;
  }

  private async auditTenant(
    tenantDs: DataSource,
    schema: string,
    req: Request,
    payload: { action: string; targetEmail?: string | null; metadata?: any },
  ) {
    try {
      const a = this.actor(req);
      await tenantDs.query(
        `
        insert into "${schema}"."audit_log"
          (action, actor_email, actor_role, target_email, metadata, ip)
        values ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [
          payload.action,
          a.email,
          a.role,
          payload.targetEmail ?? null,
          JSON.stringify(payload.metadata ?? {}),
          a.ip,
        ],
      );
    } catch (e: any) {
      this.logger.warn(`[AUDIT tenant:${schema}] skipped: ${e?.message || e}`);
    }
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
      await this.dataSource.query('select 1');

      // tentativo "ricco" (colonne reali del tuo schema ✅)
      try {
        const rows = await this.dataSource.query(
          `
          select
            id, slug, name, schema_name, is_active,
            plan_tier, max_users, storage_used_mb, storage_limit_gb,
            contact_email, vat_number,
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
            contact_email,
            created_at, updated_at
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

      // 1) registro tenant (✅ colonna corretta: contact_email)
      const rows = await this.dataSource.query(
        `
        insert into public.tenants (slug, name, schema_name, contact_email, plan_tier, is_active, created_at, updated_at)
        values ($1, $2, $3, $4, $5, true, now(), now())
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
      if (body.contact_email !== undefined) {
        updates.push(`contact_email = $${idx++}`);
        values.push(body.contact_email);
      }
      if (body.vat_number !== undefined) {
        updates.push(`vat_number = $${idx++}`);
        values.push(body.vat_number);
      }

      if (updates.length === 0) return { message: 'Nothing to update' };

      // ✅ aggiorna updated_at
      updates.push(`updated_at = now()`);

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
  // 3) TENANT USERS MANAGEMENT
  // ==========================================

  // A) LISTA UTENTI DI UN TENANT (Connessione allo schema specifico)
  @Get('tenants/:tenantId/users')
  async listTenantUsers(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('is_active') is_active?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.assertSuperAdmin(req);

    const p = clampInt(page, 1, 1, 100_000);
    const ps = clampInt(pageSize, 25, 5, 200);
    const offset = (p - 1) * ps;

    const t = await this.getTenantById(tenantId);
    if (!t) throw new BadRequestException('Tenant not found');

    const schema = safeSchema(t.schema_name);
    const tenantDs = await this.openTenantDs(schema);

    try {
      const where: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (q?.trim()) {
        const like = `%${safeLike(q.trim().toLowerCase())}%`;
        params.push(like);
        where.push(`lower(u.email) like $${i++} escape '\\'`);
      }

      if (role?.trim()) {
        params.push(role.trim().toLowerCase());
        where.push(`lower(u.role) = $${i++}`);
      }

      if (typeof is_active === 'string' && is_active.length) {
        params.push(is_active === 'true' || is_active === '1');
        where.push(`u.is_active = $${i++}`);
      }

      const whereSql = where.length ? `where ${where.join(' and ')}` : '';

      const rows = await tenantDs.query(
        `
        with base as (
          select
            u.id, u.email, u.role,
            u.is_active, u.created_at, u.updated_at,
            $${i}::text as tenant_id,
            $${i + 1}::text as tenant_name,
            $${i + 2}::text as tenant_slug,
            $${i + 3}::text as tenant_schema,
            coalesce(u.mfa_enabled, false) as mfa_enabled
          from "${schema}"."users" u
          ${whereSql}
        )
        select *, (select count(*) from base) as total
        from base
        order by created_at desc
        limit ${ps} offset ${offset}
        `,
        [...params, t.id, t.name, t.slug, t.schema_name],
      );

      const total = rows?.[0]?.total ? Number(rows[0].total) : 0;
      const users = (rows || []).map(({ total: _t, ...rest }: any) => rest);

      return { page: p, pageSize: ps, total, users };
    } finally {
      if (tenantDs.isInitialized) await tenantDs.destroy();
    }
  }

  // B) PATCH UTENTE TENANT (MFA, Active)
  @Patch('tenants/:tenantId/users/:userId')
  async patchTenantUser(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() body: { is_active?: boolean; mfa_enabled?: boolean },
  ) {
    this.assertSuperAdmin(req);

    const t = await this.getTenantById(tenantId);
    if (!t) throw new BadRequestException('Tenant not found');

    const schema = safeSchema(t.schema_name);
    const tenantDs = await this.openTenantDs(schema);

    try {
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      if (typeof body.is_active === 'boolean') {
        sets.push(`is_active = $${idx++}`);
        vals.push(body.is_active);
      }

      // Qui usiamo mfa_enabled perché tipicamente lo schema tenant ha questa colonna
      if (typeof body.mfa_enabled === 'boolean') {
        sets.push(`mfa_enabled = $${idx++}`);
        vals.push(body.mfa_enabled);
      }

      if (!sets.length) throw new BadRequestException('Nothing to update');

      vals.push(userId);

      const rows = await tenantDs.query(
        `
        update "${schema}"."users"
        set ${sets.join(', ')}, updated_at = now()
        where id = $${idx}
        returning id, email, role, is_active, mfa_enabled
        `,
        vals,
      );

      if (!rows.length) throw new BadRequestException('User not found');

      await this.auditTenant(tenantDs, schema, req, {
        action: 'TENANT_USER_UPDATED',
        targetEmail: rows[0].email,
        metadata: body,
      });

      return { user: rows[0] };
    } finally {
      if (tenantDs.isInitialized) await tenantDs.destroy();
    }
  }

  // C) DELETE TENANT USER
  @Delete('tenants/:id/users/:userId')
  async deleteTenantUser(
    @Req() req: Request,
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
  ) {
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

  // Debug Endpoint (Legacy?)
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

        if (!uRows.length) {
          throw new NotFoundException(`User ${body.email} not found in tenant ${slug}`);
        }
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

      const password = body.newPassword || generateSecurePassword();
      const hash = await bcrypt.hash(password, 12);

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

// ─── Helper ─────────────────────────────────────────────────────────────────

/** FIX 🔴: Genera password sicura con crypto.randomBytes (non Math.random). */
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64url').slice(0, 16) + 'A1!';
}