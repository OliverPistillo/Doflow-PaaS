import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Body,
  Req,
  Param,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';

// --- Helper Types & Auth Logic ---

type AuthUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

type CreateTenantBody = {
  slug: string;
  name: string;
  schema_name?: string;
  admin_email: string;
  admin_password: string;
  isActive?: boolean;
};

function getAuthUser(req: Request): AuthUser | undefined {
  return (req as any).authUser ?? (req as any).user;
}

function assertSuperAdmin(req: Request): AuthUser {
  const user = getAuthUser(req);
  if (!user) {
    throw new ForbiddenException('Forbidden (SUPER_ADMIN only)');
  }

  const rawRole = String(user.role ?? '');
  const normalized = rawRole.toUpperCase().replace(/[^A-Z]/g, '');

  if (normalized !== 'SUPERADMIN' && normalized !== 'OWNER') {
    throw new ForbiddenException('Forbidden (SUPER_ADMIN only)');
  }

  return user;
}

// --- Controller ---

@Controller('superadmin/tenants')
export class SuperadminTenantsController {
  constructor(
    private readonly bootstrap: TenantBootstrapService,
  ) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) throw new Error('No tenant connection on request');
    return conn;
  }

  @Get()
  async list(@Req() req: Request) {
    assertSuperAdmin(req);

    if ((req as any).tenantId !== 'public') {
      throw new BadRequestException('Must call this endpoint on public tenant');
    }

    const publicDs = this.getConn(req);

    const rows = await publicDs.query(
      `
      select
        id,
        slug,
        name,
        schema_name,
        is_active,
        created_at,
        updated_at
      from public.tenants
      order by created_at desc
      `,
    );

    return { tenants: rows };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateTenantBody) {
    assertSuperAdmin(req);

    if ((req as any).tenantId !== 'public') {
      throw new BadRequestException('Must call this endpoint on public tenant');
    }

    const publicDs = this.getConn(req);

    // 1. Validazione Input
    const slug = (body.slug ?? '').trim().toLowerCase();
    const name = (body.name ?? '').trim();
    const schemaName = (body.schema_name ?? slug).trim().toLowerCase();
    const adminEmail = (body.admin_email ?? '').trim().toLowerCase();
    const adminPassword = body.admin_password ?? '';
    const isActive = body.isActive ?? true;

    if (!slug || !name || !schemaName || !adminEmail) {
      throw new BadRequestException('Missing required fields (slug, name, schema_name, admin_email)');
    }
    
    if (adminPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
      throw new BadRequestException('Invalid slug (use a-z0-9 and dash, min 3 chars)');
    }

    if (!/^[a-z0-9_]+$/.test(schemaName)) {
      throw new BadRequestException('Invalid schema_name (use a-z0-9_)');
    }

    // 2. Check duplicati (Slug)
    const existing = await publicDs.query(
      `select id from public.tenants where slug = $1 limit 1`,
      [slug],
    );
    if (existing.length > 0) {
      throw new ConflictException('Tenant slug already exists');
    }

    // 3. Check duplicati (Schema)
    const existingSchema = await publicDs.query(
      `select schema_name from information_schema.schemata where schema_name = $1`,
      [schemaName]
    );
    if (existingSchema.length > 0) {
       throw new ConflictException(`Database schema '${schemaName}' already exists`);
    }

    // 4. Creazione riga in public.tenants
    const rows = await publicDs.query(
      `
      insert into public.tenants (slug, name, schema_name, is_active, created_at, updated_at)
      values ($1, $2, $3, $4, now(), now())
      returning id, slug, name, schema_name, is_active, created_at, updated_at
      `,
      [slug, name, schemaName, isActive],
    );
    const tenant = rows[0];

    // 5. BOOTSTRAP: Creazione Schema, Tabelle e Admin Seed
    
    // FIX 2: Creiamo lo schema esplicitamente (safety check)
    await publicDs.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    const tenantDs = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      schema: schemaName,
      synchronize: false,
    });

    try {
      await tenantDs.initialize();
      
      // Crea tabelle
      await this.bootstrap.ensureTenantTables(tenantDs, schemaName);
      
      // Crea primo admin
      await this.bootstrap.seedFirstAdmin(tenantDs, schemaName, adminEmail, adminPassword);

    } catch (error) {
      console.error(`Error bootstrapping tenant ${slug}:`, error);
      
      // FIX 1: ROLLBACK! Cancelliamo la riga "orfana" se il bootstrap fallisce
      // (Nota: lo schema creato potrebbe rimanere vuoto, ma almeno il registry è pulito)
      await publicDs.query(`delete from public.tenants where id = $1`, [tenant.id]);
      
      throw new BadRequestException(`Failed to bootstrap tenant: ${(error as Error).message}`);
    } finally {
      if (tenantDs.isInitialized) {
        await tenantDs.destroy();
      }
    }

    return { 
      status: 'ok', 
      tenant 
    };
  }

  @Post(':id/toggle-active')
  async toggleActive(@Req() req: Request, @Param('id') id: string) {
    assertSuperAdmin(req);

    if ((req as any).tenantId !== 'public') {
      throw new BadRequestException('Must call this endpoint on public tenant');
    }

    const publicDs = this.getConn(req);

    const rows = await publicDs.query(
      `
      update public.tenants
      set
        is_active = not is_active,
        updated_at = now()
      where id = $1
      returning id, slug, name, is_active, created_at, updated_at
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('tenant not found');
    }

    return { tenant: rows[0] };
  }
}