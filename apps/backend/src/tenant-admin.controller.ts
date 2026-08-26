import { Body, Controller, Delete, ForbiddenException, Get, Post, Req, Res, Param, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AuditService } from './audit.service';
import { hasRoleAtLeast, Role } from './roles';
import { safeSchema } from './common/schema.utils';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { TenantTeamService } from './tenant/tenant-team.service';
import { isAssignableTenantRole, normalizedTenantRole } from './tenant/tenant-role-policy';

type InviteBody = {
  email: string;
  role?: Role;
};

type ChangeRoleBody = {
  role: Role;
};

@Controller('tenant/admin')
@UseGuards(JwtAuthGuard)
export class TenantAdminController {
  constructor(
    private readonly auditService: AuditService,
    private readonly teamService: TenantTeamService,
  ) {}

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
      'TenantAdminController.principalTenant',
    );
    const routedTenant = (req as any).tenantId
      ? safeSchema((req as any).tenantId, 'TenantAdminController.routedTenant')
      : principalTenant;
    if (principalTenant !== routedTenant) {
      throw new ForbiddenException('Il tenant richiesto non coincide con il principal autenticato.');
    }
    return principalTenant;
  }

  // ✅ HELPER: Blocca chiamate su contesto 'public' (Control Plane)
  private ensureTenantContext(req: Request, res: Response): string | null {
    const tenantId = this.getTenantId(req);
    if (tenantId === 'public') {
      res.status(422).json({
        error: 'Invalid tenant context. Operation not allowed in public scope.',
        hint: 'Use https://{tenant}.doflow.it/admin/users',
      });
      return null;
    }
    return tenantId;
  }

  private ensureAdmin(req: Request, res: Response) {
    const authUser = (req as any).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Not authenticated' });
      return null;
    }
    if (!hasRoleAtLeast(authUser.role, 'admin')) {
      res.status(403).json({ error: 'Admin only' });
      return null;
    }
    return authUser;
  }

  @Get('users')
  async listAll(@Req() req: Request, @Res() res: Response) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = (req as any).authUser;
    if (!authUser) return res.status(401).json({ error: 'Not authenticated' });
    if (!hasRoleAtLeast(authUser.role, 'manager')) {
      return res.status(403).json({ error: 'Manager or admin only' });
    }

    const conn = this.getConn(req);

    const rows = await conn.query(
      `
      select
        ('user:' || id::text) as id,
        email,
        role,
        created_at,
        CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'suspended' END as status
      from "${tenantId}".users

      union all

      select
        ('invite:' || id::text) as id,
        email,
        role,
        created_at,
        'invited' as status
      from "${tenantId}".invites
      where accepted_at is null
        and (expires_at is null or expires_at > now())

      order by created_at desc
      `,
    );

    return res.json({
      currentUser: authUser,
      users: rows,
    });
  }

  @Post('invite')
  async createInvite(
    @Body() body: InviteBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    if (!body?.email || !body.email.trim()) {
      return res.status(400).json({ error: 'email required' });
    }
    const email = body.email.trim().toLowerCase();
    const role = normalizedTenantRole(body.role || 'viewer');
    if (!isAssignableTenantRole(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await this.teamService.createMember({
      email,
      display_name: email.split('@')[0] || email,
      tenant_role: role,
      operational_role: 'generic',
      employment_type: 'employee',
      status: 'invited',
      send_invite: true,
    });

    await this.auditService.log(req, {
      action: 'admin_invite_created',
      targetEmail: email,
      metadata: { role },
    });

    return res.json({
      status: 'ok',
      member: result.member,
      invite: result.invite,
    });
  }

  @Post('invite/resend')
  async resendInvite(@Body() body: { email: string }, @Req() req: Request, @Res() res: Response) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    if (!body?.email || !body.email.trim()) {
      return res.status(400).json({ error: 'email required' });
    }
    const email = body.email.trim().toLowerCase();
    const invite = await this.teamService.inviteMemberByEmail(email);
    await this.auditService.log(req, {
      action: 'admin_invite_resent',
      targetEmail: email,
    });
    return res.json({ status: 'ok', invite });
  }

  @Post('users/:id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    // accetta "user:123" oppure "123"
    const raw = id.startsWith('user:') ? id.split(':')[1] : id;
    if (id.startsWith('invite:')) {
      return res.status(400).json({ error: 'Cannot change role for an invite. Accept invite first.' });
    }

    const userId = raw.trim();
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const role = normalizedTenantRole(body.role);
    if (!isAssignableTenantRole(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const updated = await this.teamService.updateMemberRoleByUserId(userId, role);

    await this.auditService.log(req, {
      action: 'admin_change_role',
      targetEmail: updated.email,
      metadata: { newRole: role },
    });

    return res.json({ status: 'ok', user: updated });
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    const isInvite = id.startsWith('invite:');
    const isUser = id.startsWith('user:');

    if (!isInvite && !isUser) {
      return res.status(400).json({ error: 'Invalid id format. Expected user:<id> or invite:<id>' });
    }

    const rawId = id.split(':')[1];

    let deletedEmail = '';
    if (isInvite) {
      const result = await this.teamService.cancelInvite(rawId);
      deletedEmail = result.email || `ID:${id}`;
    } else {
      const userId = rawId.trim();
      if (!userId) return res.status(400).json({ error: 'Invalid user id' });
      const result = await this.teamService.deleteMemberByUserId(userId);
      deletedEmail = result.email || `ID:${id}`;
    }

    await this.auditService.log(req, {
      action: isInvite ? 'admin_delete_invite' : 'admin_delete_user',
      targetEmail: deletedEmail,
      metadata: { deletedId: id, type: isInvite ? 'invite' : 'user' },
    });

    return res.json({ status: 'ok', deletedId: id });
  }

  @Get('audit')
  async listAudit(@Req() req: Request, @Res() res: Response) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = (req as any).authUser;
    if (!authUser) return res.status(401).json({ error: 'Not authenticated' });

    if (!hasRoleAtLeast(authUser.role, 'manager')) {
      return res.status(403).json({ error: 'Manager or admin only' });
    }

    const conn = this.getConn(req);

    const rows = await conn.query(
      `select id, action, actor_email, actor_role, target_email, metadata, ip, created_at
       from "${tenantId}".audit_log
       order by id desc
       limit 100`,
    );

    return res.json({ entries: rows });
  }
}
