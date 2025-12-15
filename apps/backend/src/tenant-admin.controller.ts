import { Body, Controller, Delete, Get, Post, Req, Res, Param, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { AuditService } from './audit.service';
import { hasRoleAtLeast, Role } from './roles';
import { MailService } from './mail/mail.service';

type InviteBody = {
  email: string;
  role?: Role;
};

type ChangeRoleBody = {
  role: Role;
};

@Controller('tenant/admin')
export class TenantAdminController {
  private readonly logger = new Logger(TenantAdminController.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    const tid = tenantId ?? 'public';

    // Protezione SQL Injection estrema
    if (!/^[a-z0-9_]+$/.test(tid)) {
       throw new Error('Invalid tenant ID detected (potential SQL injection attempt)');
    }
    
    return tid;
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
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasRoleAtLeast(authUser.role, 'manager')) {
      return res.status(403).json({ error: 'Manager or admin only' });
    }

    const conn = this.getConn(req);

    // Unione di Users (attivi) e Invites (pending)
    const rows = await conn.query(
      `
      select
        id,
        email,
        role,
        created_at,
        'active' as status
      from ${tenantId}.users
      
      union all
      
      select
        -id as id,
        email,
        role,
        created_at,
        'invited' as status
      from ${tenantId}.invites
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
    const email = body.email.trim();

    const rawRole = body.role ?? 'viewer';
    const allowedRoles: Role[] = ['admin', 'manager', 'editor', 'viewer', 'user'];
    const role = allowedRoles.includes(rawRole) ? rawRole : 'viewer';

    const conn = this.getConn(req);

    // Controllo se l'utente esiste già
    const existingUser = await conn.query(
      `select id from ${tenantId}.users where email = $1 limit 1`,
      [email],
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Check esistenza invito duplicato (pending)
    const existingInvite = await conn.query(
      `select id from ${tenantId}.invites
       where email = $1 and accepted_at is null
       and (expires_at is null or expires_at > now())
       limit 1`,
      [email],
    );

    if (existingInvite.length > 0) {
      return res.status(409).json({ error: 'Invite already pending for this email' });
    }

    // Creazione nuovo invito
    const token = crypto.randomBytes(32).toString('hex');
    const rows = await conn.query(
      `
      insert into ${tenantId}.invites (email, role, token)
      values ($1, $2, $3)
      returning id, email, role, token, created_at, expires_at
      `,
      [email, role, token],
    );

    const invite = rows[0];

    await this.auditService.log(req, {
      action: 'admin_invite_created',
      targetEmail: invite.email,
      metadata: { role: invite.role },
    });

    const baseUrl = process.env.APP_BASE_URL ?? 'https://app.doflow.it';
    const acceptUrl = `${baseUrl}/auth/accept-invite?token=${invite.token}`;

    try {
      this.logger.log(`Tentativo invio email a ${invite.email}...`);
      await this.mailService.sendInviteEmail({
        to: invite.email,
        tenantName: tenantId,
        inviteLink: acceptUrl,
      });
      this.logger.log(`Email inviata con successo.`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`ERRORE INVIO MAIL (ma l'invito è stato creato): ${errorMsg}`);
      
      await this.auditService.log(req, {
        action: 'admin_invite_email_failed',
        targetEmail: invite.email,
        metadata: { error: errorMsg },
      });
    }

    return res.json({
      status: 'ok',
      invite,
      exampleAcceptUrl: acceptUrl,
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
    const email = body.email.trim();

    const conn = this.getConn(req);

    const rows = await conn.query(
      `
      select id, email, role, token
      from ${tenantId}.invites
      where email = $1
        and accepted_at is null
        and (expires_at is null or expires_at > now())
      limit 1
      `,
      [email],
    );

    const invite = rows[0];
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    const baseUrl = process.env.APP_BASE_URL ?? 'https://app.doflow.it';
    const acceptUrl = `${baseUrl}/auth/accept-invite?token=${invite.token}`;

    try {
      await this.mailService.sendInviteEmail({
        to: invite.email,
        tenantName: tenantId,
        inviteLink: acceptUrl,
      });

      await this.auditService.log(req, {
        action: 'admin_invite_resent',
        targetEmail: invite.email,
      });

      return res.json({ status: 'ok' });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`ERRORE RINVIO MAIL: ${errorMsg}`);

      await this.auditService.log(req, {
        action: 'admin_resend_email_failed',
        targetEmail: invite.email,
        metadata: { error: errorMsg },
      });

      return res.status(500).json({ error: 'Failed to send email' });
    }
  }

  @Post('users/:id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const allowedRoles: Role[] = ['admin', 'manager', 'editor', 'viewer', 'user'];
    if (!body.role || !allowedRoles.includes(body.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const conn = this.getConn(req);

    const existingRows = await conn.query(
      `select id, email, role from ${tenantId}.users where id = $1 limit 1`,
      [userId],
    );

    if (!existingRows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = existingRows[0].role;

    const updatedRows = await conn.query(
      `update ${tenantId}.users set role = $1 where id = $2 returning id, email, role, created_at`,
      [body.role, userId],
    );

    const updated = updatedRows[0];

    await this.auditService.log(req, {
      action: 'admin_change_role',
      targetEmail: updated.email,
      metadata: { oldRole, newRole: updated.role },
    });

    return res.json({ status: 'ok', user: updated });
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 🛡️ Guard: Tenant Context
    const tenantId = this.ensureTenantContext(req, res);
    if (!tenantId) return;

    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const isInvite = userId < 0;
    const realId = Math.abs(userId);

    const conn = this.getConn(req);

    let result;
    if (isInvite) {
      // Cancellazione Invito
      result = await conn.query(
        `delete from ${tenantId}.invites where id = $1 returning id, email`,
        [realId],
      );
    } else {
      // Cancellazione Utente reale
      result = await conn.query(
        `delete from ${tenantId}.users where id = $1 returning id, email`,
        [realId],
      );
    }

    if ((result as any[]).length === 0) {
      return res.status(404).json({ error: isInvite ? 'Invite not found' : 'User not found' });
    }

    const deletedEmail = result[0]?.email || `ID:${realId}`;

    await this.auditService.log(req, {
      action: isInvite ? 'admin_delete_invite' : 'admin_delete_user',
      targetEmail: deletedEmail,
      metadata: { deletedId: userId, type: isInvite ? 'invite' : 'user' },
    });

    return res.json({ status: 'ok', deletedId: userId });
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
       from ${tenantId}.audit_log
       order by id desc
       limit 100`,
    );

    return res.json({ entries: rows });
  }
}