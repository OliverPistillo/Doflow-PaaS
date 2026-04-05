import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

type Role =
  | 'superadmin'
  | 'owner'
  | 'admin'
  | 'manager'
  | 'editor'
  | 'viewer'
  | 'user';

/* =========================
   KPI Response Types
========================= */

type UsersKpiByTenantRow = {
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_schema: string | null;
  total_users: number;
  active_users: number;
  suspended_users: number;
  new_users_window: number;
};

type UsersTrendPoint = {
  day: string; // YYYY-MM-DD
  new_users: number;
};

/* =========================
   Helpers
========================= */

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

/* =========================
   Controller
========================= */

@Controller('superadmin')
export class SuperadminUsersController {
  private readonly logger = new Logger(SuperadminUsersController.name);

  constructor(private readonly dataSource: DataSource) {}

  /* =========================
       Auth & Context
   ========================= */

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

  /* =========================
       Data helpers
   ========================= */

  private async openTenantDs(schema: string): Promise<DataSource> {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Missing DATABASE_URL');

    const ds = new DataSource({
      type: 'postgres',
      url,
      schema: safeSchema(schema),
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

  /* =========================
       Audit helpers
   ========================= */

  private async auditPublic(
    req: Request,
    payload: { action: string; targetEmail?: string | null; metadata?: any },
  ) {
    try {
      const a = this.actor(req);
      await this.dataSource.query(
        `
        insert into public.audit_log
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
      this.logger.warn(`[AUDIT public] skipped: ${e?.message || e}`);
    }
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

  /* ==========================================================
       A) KPI & ANALYTICS
       GET /api/superadmin/users/kpi
   ========================================================== */
  @Get('users/kpi')
  async usersKpi(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('days') daysRaw?: string,
    @Query('top') topRaw?: string,
  ) {
    this.assertSuperAdmin(req);

    const days = clampInt(daysRaw, 30, 7, 180);
    const top = clampInt(topRaw, 20, 5, 100);

    const tFilter = String(tenantId || '').trim();

    try {
      const kpiRows: UsersKpiByTenantRow[] = await this.dataSource.query(
        `
        with base as (
          select
            u.tenant_id,
            u.is_active,
            u.created_at,
            t.name as tenant_name,
            t.slug as tenant_slug,
            t.schema_name as tenant_schema
          from public.users u
          left join public.tenants t
            on lower(t.schema_name) = lower(u.tenant_id)
            or lower(t.slug) = lower(u.tenant_id)
            or t.id::text = u.tenant_id
        )
        select
          tenant_id,
          max(tenant_name) as tenant_name,
          max(tenant_slug) as tenant_slug,
          max(tenant_schema) as tenant_schema,
          count(*)::int as total_users,
          sum(case when is_active then 1 else 0 end)::int as active_users,
          sum(case when not is_active then 1 else 0 end)::int as suspended_users,
          sum(case when created_at >= now() - ($1::int || ' days')::interval then 1 else 0 end)::int as new_users_window
        from base
        where tenant_id is not null
        group by tenant_id
        order by total_users desc, active_users desc
        limit $2
        `,
        [days, top],
      );

      const trend: UsersTrendPoint[] = await this.dataSource.query(
        `
        with params as (
          select
            (current_date - ($1::int - 1))::date as start_day,
            current_date::date as end_day
        ),
        days as (
          select generate_series((select start_day from params), (select end_day from params), '1 day')::date as day
        ),
        filtered as (
          select u.created_at::date as day
          from public.users u
          where u.created_at >= (select start_day from params)
            and ($2 = '' or lower(u.tenant_id) = lower($2))
        ),
        agg as (
          select day, count(*)::int as new_users
          from filtered
          group by day
        )
        select
          to_char(d.day, 'YYYY-MM-DD') as day,
          coalesce(a.new_users, 0)::int as new_users
        from days d
        left join agg a on a.day = d.day
        order by d.day asc
        `,
        [days, tFilter],
      );

      return {
        windowDays: days,
        top,
        tenantFilter: tFilter || null,
        kpiByTenant: kpiRows,
        trend,
      };
    } catch (e) {
      this.logAndThrow500('GET /superadmin/users/kpi', e);
    }
  }

  /* ==========================================================
       B) DIRECTORY GLOBALE — public.users
       GET /api/superadmin/users
   ========================================================== */
  @Get('users')
  async listGlobalUsers(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('tenant') tenant?: string,
    @Query('role') role?: string,
    @Query('is_active') is_active?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.assertSuperAdmin(req);

    try {
      const p = clampInt(page, 1, 1, 100_000);
      const ps = clampInt(pageSize, 25, 5, 200);
      const offset = (p - 1) * ps;

      const where: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (q?.trim()) {
        const like = `%${safeLike(q.trim().toLowerCase())}%`;
        params.push(like, like);
        where.push(
          `(lower(u.email) like $${i++} escape '\\' or lower(u.tenant_id) like $${i++} escape '\\')`,
        );
      }

      if (tenant?.trim()) {
        params.push(tenant.trim().toLowerCase());
        where.push(`lower(u.tenant_id) = $${i++}`);
      }

      if (role?.trim() && role !== '__all__') {
        params.push(role.trim().toLowerCase());
        where.push(`lower(u.role) = $${i++}`);
      }

      if (typeof is_active === 'string' && is_active.length && is_active !== '__all__') {
        params.push(is_active === 'true' || is_active === '1');
        where.push(`u.is_active = $${i++}`);
      }

      const whereSql = where.length ? `where ${where.join(' and ')}` : '';

      const rows = await this.dataSource.query(
        `
        with base as (
          select
            u.id, u.email, u.role, u.tenant_id, u.is_active, 
            coalesce(u.mfa_enabled, false) as mfa_enabled,
            u.created_at, u.updated_at,
            t.name as tenant_name,
            t.slug as tenant_slug,
            t.schema_name as tenant_schema
          from public.users u
          left join public.tenants t
            on lower(t.schema_name) = lower(u.tenant_id)
            or lower(t.slug) = lower(u.tenant_id)
            or t.id::text = u.tenant_id
          ${whereSql}
        )
        select *, (select count(*) from base) as total
        from base
        order by created_at desc
        limit ${ps} offset ${offset}
        `,
        params,
      );

      const total = rows?.[0]?.total ? Number(rows[0].total) : 0;
      const users = (rows || []).map(({ total: _t, ...rest }: any) => rest);

      return { page: p, pageSize: ps, total, users };
    } catch (e) {
      this.logAndThrow500('GET /superadmin/users', e);
    }
  }

  /* ==========================================================
       C) UPDATE UTENTE GLOBALE
       PATCH /api/superadmin/users/:id
   ========================================================== */
  @Patch('users/:id')
  async updateGlobalUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { role?: Role; is_active?: boolean; mfa_enabled?: boolean },
  ) {
    this.assertSuperAdmin(req);

    try {
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      if (typeof body.role === 'string') {
        sets.push(`role = $${idx++}`);
        vals.push(body.role.toLowerCase());
      }

      if (typeof body.is_active === 'boolean') {
        sets.push(`is_active = $${idx++}`);
        vals.push(body.is_active);
      }

      if (typeof body.mfa_enabled === 'boolean') {
        sets.push(`mfa_enabled = $${idx++}`);
        vals.push(body.mfa_enabled);

        if (body.mfa_enabled === false) {
           sets.push(`mfa_secret = NULL`);
           sets.push(`mfa_verified_at = NULL`);
        }
      }

      if (!sets.length) throw new BadRequestException('Nothing to update');

      vals.push(id);

      const rows = await this.dataSource.query(
        `
        update public.users
        set ${sets.join(', ')}, updated_at = now()
        where id = $${idx}
        returning *
        `,
        vals,
      );

      if (!rows.length) throw new BadRequestException('User not found');

      await this.auditPublic(req, {
        action: 'GLOBAL_USER_UPDATED',
        targetEmail: rows[0].email,
        metadata: body,
      });

      return { user: rows[0] };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logAndThrow500('PATCH /superadmin/users/:id', e);
    }
  }

  /* ==========================================================
       D) RESET PASSWORD — TENANT USER
       POST /api/superadmin/tenants/:tenantId/users/:userId/reset-password
   ========================================================== */
  @Post('tenants/:tenantId/users/:userId/reset-password')
  async resetTenantUserPassword(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    this.assertSuperAdmin(req);

    try {
      const t = await this.getTenantById(tenantId);
      if (!t) throw new BadRequestException('Tenant not found');

      const schema = safeSchema(t.schema_name);
      const tenantDs = await this.openTenantDs(schema);

      try {
        const tempPassword = generateSecurePassword();
        const hash = await bcrypt.hash(tempPassword, 12);

        const rows = await tenantDs.query(
          `
          update "${schema}"."users"
          set password_hash = $1, updated_at = now()
          where id = $2
          returning email
          `,
          [hash, userId],
        );

        if (!rows.length) throw new BadRequestException('User not found');

        // Sync con global se esiste (opzionale)
        await this.dataSource.query(
            `UPDATE public.users SET password_hash = $1 WHERE email = $2`,
            [hash, rows[0].email]
        );

        await this.auditTenant(tenantDs, schema, req, {
          action: 'RESET_PASSWORD',
          targetEmail: rows[0].email,
        });

        return { tempPassword };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logAndThrow500(
        'POST /superadmin/tenants/:tenantId/users/:userId/reset-password',
        e,
      );
    }
  }

  /* ==========================================================
       E) CREATE TENANT USER
       POST /api/superadmin/tenants/:tenantId/users
   ========================================================== */
  @Post('tenants/:tenantId/users')
  async createTenantUser(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      email: string;
      role?: Role;
      password?: string;
      sendInvite?: boolean;
      mfa_enabled?: boolean;
    },
  ) {
    this.assertSuperAdmin(req);

    try {
      const t = await this.getTenantById(tenantId);
      if (!t) throw new BadRequestException('Tenant not found');

      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        throw new BadRequestException('Invalid email');
      }

      const role = (body.role || 'user').toLowerCase() as Role;
      const mfaEnabled = body.mfa_enabled !== false; 

      const schema = safeSchema(t.schema_name);
      const tenantDs = await this.openTenantDs(schema);

      try {
        const dup = await tenantDs.query(
          `select 1 from "${schema}"."users" where email = $1 limit 1`,
          [email],
        );
        if (dup.length) throw new BadRequestException('User already exists');

        const tempPassword =
          body.sendInvite === true
            ? null
            : body.password || generateSecurePassword();

        const hash =
          tempPassword !== null
            ? await bcrypt.hash(tempPassword, 10)
            : 'INVITED';

        const rows = await tenantDs.query(
          `
          insert into "${schema}"."users"
            (email, password_hash, role, is_active, mfa_enabled, created_at, updated_at)
          values ($1, $2, $3, true, $4, now(), now())
          returning id, email, role
          `,
          [email, hash, role, mfaEnabled],
        );

        let inviteToken: string | undefined;
        if (body.sendInvite === true) {
          inviteToken = crypto.randomBytes(32).toString('hex');
        }

        await this.auditTenant(tenantDs, schema, req, {
          action: 'TENANT_USER_CREATED',
          targetEmail: email,
          metadata: { role, invite: body.sendInvite === true, mfa: mfaEnabled },
        });

        return {
          user: rows[0],
          tempPassword,
          inviteToken,
        };
      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logAndThrow500(
        'POST /superadmin/tenants/:tenantId/users',
        e,
      );
    }
  }

  /* ==========================================================
       F) AUDIT
       GET /api/superadmin/users/:email/audit
   ========================================================== */
  @Get('users/:email/audit')
  async auditForUser(
    @Req() req: Request,
    @Param('email') email: string,
  ) {
    this.assertSuperAdmin(req);

    try {
      const rows = await this.dataSource.query(
        `
        select *
        from public.audit_log
        where target_email = $1
        order by created_at desc
        limit 200
        `,
        [email],
      );
      return { logs: rows };
    } catch (e) {
      this.logAndThrow500('GET /superadmin/users/:email/audit', e);
    }
  }

  /* ==========================================================
       G) LIST TENANT USERS
       GET /api/superadmin/tenants/:tenantId/users
   ========================================================== */
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

    try {
      const t = await this.getTenantById(tenantId);
      if (!t) throw new BadRequestException('Tenant not found');

      const schema = safeSchema(t.schema_name);
      const tenantDs = await this.openTenantDs(schema);

      try {
        const p = clampInt(page, 1, 1, 100_000);
        const ps = clampInt(pageSize, 25, 5, 200);
        const offset = (p - 1) * ps;

        const where: string[] = [];
        const params: any[] = [];
        let i = 1;

        if (q?.trim()) {
          const like = `%${safeLike(q.trim().toLowerCase())}%`;
          params.push(like);
          where.push(`(lower(email) like $${i++} escape '\\')`);
        }

        if (role?.trim() && role !== '__all__') {
          params.push(role.trim().toLowerCase());
          where.push(`lower(role) = $${i++}`);
        }

        if (typeof is_active === 'string' && is_active.length && is_active !== '__all__') {
          params.push(is_active === 'true' || is_active === '1');
          where.push(`is_active = $${i++}`);
        }

        const whereSql = where.length ? `where ${where.join(' and ')}` : '';

        const rows = await tenantDs.query(
          `
          select id, email, role, is_active, created_at, updated_at,
                 coalesce(mfa_enabled, false) as mfa_enabled,
                 count(*) over() as total
          from "${schema}"."users"
          ${whereSql}
          order by created_at desc
          limit ${ps} offset ${offset}
          `,
          params,
        );

        const total = rows.length > 0 ? Number(rows[0].total) : 0;
        
        const users = rows.map(({ total: _t, ...u }: any) => ({
          ...u,
          tenant_id: t.id,
          tenant_name: t.name,
          tenant_slug: t.slug,
          tenant_schema: t.schema_name,
        }));

        return { page: p, pageSize: ps, total, users };

      } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logAndThrow500(`GET /superadmin/tenants/${tenantId}/users`, e);
    }
  }

  /* ==========================================================
       H) PATCH TENANT USER (MFA/Active) - **FIX 404**
       PATCH /api/superadmin/tenants/:tenantId/users/:userId
   ========================================================== */
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

      if (typeof body.mfa_enabled === 'boolean') {
        sets.push(`mfa_enabled = $${idx++}`);
        vals.push(body.mfa_enabled);

        if (body.mfa_enabled === false) {
            sets.push(`mfa_secret = NULL`);
            sets.push(`mfa_verified_at = NULL`);
        }
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
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/** FIX 🔴: Genera password sicura con crypto.randomBytes (non Math.random). */
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64url').slice(0, 16) + 'A1!';
}