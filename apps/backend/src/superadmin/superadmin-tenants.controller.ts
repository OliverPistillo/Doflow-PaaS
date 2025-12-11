import {
  BadRequestException,
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
import { InjectDataSource } from '@nestjs/typeorm'; // Import fondamentale

type AuthUser = {
  id: string;
  email?: string | null;
  role?: string | null;
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
  
  if (normalized !== 'SUPERADMIN') {
    throw new ForbiddenException('Forbidden (SUPER_ADMIN only)');
  }

  return user;
}

@Controller('superadmin/tenants')
export class SuperadminTenantsController {
  // Iniettiamo la connessione principale (public schema)
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async list(@Req() req: Request) {
    assertSuperAdmin(req);
    
    // Usiamo this.dataSource invece di cercare la tenantConnection
    const rows = await this.dataSource.query(
      `
      select
        id,
        slug,
        name,
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
  async create(
    @Req() req: Request,
    @Body()
    body: {
      slug?: string;
      name?: string;
      isActive?: boolean;
    },
  ) {
    assertSuperAdmin(req);
    
    const slug = (body.slug ?? '').trim().toLowerCase();
    const name = (body.name ?? '').trim();
    const isActive = body.isActive ?? true;

    if (!slug || !name) {
      throw new BadRequestException('slug and name are required');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestException(
        'slug must contain only lowercase letters, digits and hyphen',
      );
    }

    const existing = await this.dataSource.query(
      `select id from public.tenants where slug = $1 limit 1`,
      [slug],
    );
    if (existing.length > 0) {
      throw new BadRequestException('slug already exists');
    }

    const rows = await this.dataSource.query(
      `
      insert into public.tenants (slug, name, is_active, created_at, updated_at)
      values ($1, $2, $3, now(), now())
      returning id, slug, name, is_active, created_at, updated_at
      `,
      [slug, name, isActive],
    );

    const tenant = rows[0];
    return { tenant };
  }

  @Post(':id/toggle-active')
  async toggleActive(@Req() req: Request, @Param('id') id: string) {
    assertSuperAdmin(req);

    const rows = await this.dataSource.query(
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