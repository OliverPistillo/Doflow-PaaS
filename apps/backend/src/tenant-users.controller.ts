import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { safeSchema } from './common/schema.utils';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { hasRoleAtLeast } from './roles';
import { TenantTeamService } from './tenant/tenant-team.service';

type CreateUserDto = {
  email: string;
};

@Controller('tenant/users')
@UseGuards(JwtAuthGuard)
export class TenantUsersController {
  constructor(private readonly teamService: TenantTeamService) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  private getTenantId(req: Request): string {
    const authUser = (req as any).user || (req as any).authUser;
    const principalTenant = safeSchema(
      authUser?.tenantId || authUser?.tenant_id || 'public',
      'TenantUsersController.principalTenant',
    );
    const routedTenant = (req as any).tenantId
      ? safeSchema((req as any).tenantId, 'TenantUsersController.routedTenant')
      : principalTenant;
    if (principalTenant !== routedTenant) {
      throw new ForbiddenException('Il tenant richiesto non coincide con il principal autenticato.');
    }
    if (principalTenant === 'public') throw new ForbiddenException('Tenant richiesto');
    return principalTenant;
  }

  private currentUser(req: Request) {
    const user = (req as any).user || (req as any).authUser;
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get()
  async list(@Req() req: Request) {
    const user = this.currentUser(req);
    if (!hasRoleAtLeast(user.role, 'manager')) throw new ForbiddenException('Manager or admin only');

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `select id, email, created_at, '${tenantId}' as schema
      from "${tenantId}".users
      order by id`
    );

    return { users: rows, currentUser: user };
  }

  @Post()
  async create(@Body() body: CreateUserDto, @Req() req: Request) {
    const user = this.currentUser(req);
    this.getTenantId(req);
    if (!['owner', 'admin', 'superadmin', 'super_admin'].includes(String(user.role || '').toLowerCase())) {
      throw new ForbiddenException('Admin only');
    }
    if (!body.email) throw new BadRequestException('email required');
    const result = await this.teamService.createMember({
      email: body.email,
      display_name: String(body.email).split('@')[0] || body.email,
      tenant_role: 'user',
      operational_role: 'generic',
      employment_type: 'employee',
      status: 'invited',
      send_invite: true,
    });
    return { user: result.member, invite: result.invite, currentUser: user };
  }

}
