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
  Query,
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

@Controller('superadmin')
export class SuperadminTenantsController {
  constructor(
    private readonly bootstrap: TenantBootstrapService,
    private readonly telemetry: SystemStatsService,
  ) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) throw new Error('No tenant connection on request');
    return conn;
  }

  private assertSuperAdmin(req: Request) {
    const user = (req as any).authUser ?? (req as any).user;
    const rawRole = String(user?.role ?? '').toUpperCase();
    if (rawRole !== 'SUPERADMIN' && rawRole !== 'OWNER') {
      throw new ForbiddenException('SuperAdmin only');
    }
  }

  // ==========================================
  // 1. SYSTEM HEALTH & MONITORAGGIO SERVIZI
  // ==========================================
  @Get('system/stats')
  async getSystemStats(@Req() req: Request) {
    // Nota: Decommenta se vuoi proteggere l'endpoint, ma per debugging iniziale è utile averlo libero
    // this.assertSuperAdmin(req); 
    return this.telemetry.getSystemStats();
  }

  // ==========================================
  // 2. GESTIONE TENANT (Aziende)
  // ==========================================

  @Get('tenants')
  async list(@Req() req: Request) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    const rows = await publicDs.query(
      `
      select
        id, slug, name, schema_name, is_active, 
        plan_tier, max_users, storage_used_mb, admin_email,
        created_at, updated_at
      from public.tenants
      order by created_at desc
      `
    );
    return { tenants: rows };
  }

  @Post('tenants')
  async create(@Req() req: Request, @Body() body: CreateTenantBody) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    const slug = (body.slug || '').trim().toLowerCase();
    const schemaName = (body.schema_name || slug).trim().toLowerCase();
    const plan = body.plan_tier || 'STARTER';

    if (!slug || !body.name || !body.admin_email || !body.admin_password) {
        throw new BadRequestException('Missing fields');
    }

    // 1. Inserimento nel registro Tenant
    const rows = await publicDs.query(
      `
      insert into public.tenants (slug, name, schema_name, admin_email, plan_tier, is_active, created_at)
      values ($1, $2, $3, $4, $5, true, now())
      returning id, slug, schema_name
      `,
      [slug, body.name, schemaName, body.admin_email, plan]
    );
    const tenant = rows[0];

    // 2. Bootstrap Schema e Admin
    try {
      // Crea schema se non esiste
      await publicDs.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      
      const tenantDs = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        schema: schemaName,
        synchronize: false,
      });

      await tenantDs.initialize();
      await this.bootstrap.ensureTenantTables(tenantDs, schemaName);
      await this.bootstrap.seedFirstAdmin(tenantDs, schemaName, body.admin_email, body.admin_password);
      await tenantDs.destroy();

    } catch (e) {
      // Rollback: se fallisce il bootstrap tecnico, rimuoviamo il tenant dal registro
      await publicDs.query(`delete from public.tenants where id = $1`, [tenant.id]);
      throw new BadRequestException('Bootstrap failed: ' + (e as Error).message);
    }

    return { status: 'ok', tenant };
  }

  @Patch('tenants/:id')
  async updateTenant(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateTenantBody) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) { updates.push(`name = $${idx++}`); values.push(body.name); }
    if (body.plan_tier !== undefined) { updates.push(`plan_tier = $${idx++}`); values.push(body.plan_tier); }
    if (body.max_users !== undefined) { updates.push(`max_users = $${idx++}`); values.push(body.max_users); }
    if (body.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(body.is_active); }

    if (updates.length === 0) return { message: 'Nothing to update' };

    values.push(id);
    const sql = `UPDATE public.tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    
    const res = await publicDs.query(sql, values);
    return { tenant: res[0] };
  }

  // ==========================================
  // 3. GESTIONE UTENTI DEI TENANT (Accesso Dinamico)
  // ==========================================

  // Endpoint: /api/superadmin/tenants/:id/users-list-debug
  // Permette al Superadmin di vedere chi è registrato in un tenant specifico
  @Get('tenants/:id/users-list-debug')
  async getTenantUsers(@Req() req: Request, @Param('id') tenantId: string) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    // 1. Recupera nome schema del tenant
    const tRows = await publicDs.query(`select schema_name, slug from public.tenants where id = $1`, [tenantId]);
    if (!tRows.length) throw new NotFoundException('Tenant not found');
    const { schema_name } = tRows[0];

    // 2. Connessione dinamica al tenant
    const tenantDs = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        schema: schema_name,
        synchronize: false,
    });

    try {
        await tenantDs.initialize();
        // Query diretta sulla tabella users del tenant
        const users = await tenantDs.query(`
            SELECT id, email, role, created_at 
            FROM ${schema_name}.users 
            ORDER BY created_at DESC
        `);
        return { users };
    } catch(e) {
        throw new BadRequestException("Errore lettura utenti tenant");
    } finally {
        if (tenantDs.isInitialized) await tenantDs.destroy();
    }
  }

  // Elimina un utente specifico da un tenant (es. dipendente licenziato)
  @Delete('tenants/:id/users/:userId')
  async deleteTenantUser(@Req() req: Request, @Param('id') tenantId: string, @Param('userId') userId: string) {
      this.assertSuperAdmin(req);
      const publicDs = this.getConn(req);

      const tRows = await publicDs.query(`select schema_name from public.tenants where id = $1`, [tenantId]);
      if (!tRows.length) throw new NotFoundException('Tenant not found');
      const { schema_name } = tRows[0];

      const tenantDs = new DataSource({
          type: 'postgres', url: process.env.DATABASE_URL, schema: schema_name, synchronize: false,
      });

      try {
          await tenantDs.initialize();
          await tenantDs.query(`DELETE FROM ${schema_name}.users WHERE id = $1`, [userId]);
          return { status: 'deleted' };
      } finally {
          if (tenantDs.isInitialized) await tenantDs.destroy();
      }
  }

  // ==========================================
  // 4. SECURITY & IMPERSONATION
  // ==========================================

  // "Accedi come..." -> Genera un token valido per quel tenant specifico
  @Post('tenants/:id/impersonate')
  async impersonate(@Req() req: Request, @Param('id') tenantId: string, @Body() body: { email: string }) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    const tRows = await publicDs.query(`select schema_name, slug from public.tenants where id = $1`, [tenantId]);
    if (!tRows.length) throw new NotFoundException('Tenant not found');
    const { schema_name, slug } = tRows[0];

    const tenantDs = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: schema_name,
      synchronize: false,
    });
    
    await tenantDs.initialize();
    const uRows = await tenantDs.query(`select id, email, role from ${schema_name}.users where email = $1`, [body.email]);
    await tenantDs.destroy();

    if (!uRows.length) throw new NotFoundException(`User ${body.email} not found in tenant ${slug}`);
    const targetUser = uRows[0];

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not defined');

    const payload = {
      sub: targetUser.id,
      email: targetUser.email,
      tenantId: schema_name,
      tenantSlug: slug,
      role: targetUser.role,
      isImpersonated: true 
    };

    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    return { 
      token, 
      redirectUrl: `/${slug}/dashboard`
    };
  }

  // Forza il reset della password di un utente nel tenant
  @Post('tenants/:id/reset-admin-password')
  async resetAdminPwd(@Req() req: Request, @Param('id') tenantId: string, @Body() body: { email: string, newPassword?: string }) {
    this.assertSuperAdmin(req);
    const publicDs = this.getConn(req);

    const tRows = await publicDs.query(`select schema_name from public.tenants where id = $1`, [tenantId]);
    if (!tRows.length) throw new NotFoundException('Tenant not found');
    const schema = tRows[0].schema_name;

    const password = body.newPassword || Math.random().toString(36).slice(-8) + "Aa1!";
    const hash = await bcrypt.hash(password, 10);

    const tenantDs = new DataSource({
       type: 'postgres', url: process.env.DATABASE_URL, schema, synchronize: false
    });
    await tenantDs.initialize();
    
    await tenantDs.query(`update ${schema}.users set password_hash = $1 where email = $2`, [hash, body.email]);
    await tenantDs.destroy();

    return { 
      status: 'success', 
      email: body.email, 
      tempPassword: password 
    };
  }
}