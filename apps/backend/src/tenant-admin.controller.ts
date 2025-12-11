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
    return tenantId ?? 'public';
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
    const authUser = (req as any).authUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasRoleAtLeast(authUser.role, 'manager')) {
      return res.status(403).json({ error: 'Manager or admin only' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `select id, email, role, created_at 
       from ${tenantId}.users
       order by id`,
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
    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    if (!body.email) {
      return res.status(400).json({ error: 'email required' });
    }

    const rawRole = body.role ?? 'viewer';
    const allowedRoles: Role[] = ['admin', 'manager', 'editor', 'viewer', 'user'];
    const role = allowedRoles.includes(rawRole) ? rawRole : 'viewer';

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);
    const token = crypto.randomBytes(32).toString('hex');

    const rows = await conn.query(
      `
      insert into ${tenantId}.invites (email, role, token)
      values ($1, $2, $3)
      returning id, email, role, token, created_at, expires_at
      `,
      [body.email, role, token],
    );

    const invite = rows[0];

    await this.auditService.log(req, {
      action: 'admin_invite_created',
      targetEmail: invite.email,
      metadata: { role: invite.role },
    });

    // Costruzione URL
    const host =
      (req.headers['x-forwarded-host'] as string) ??
      (req.headers.host as string) ??
      process.env.APP_BASE_URL ??
      'app.doflow.it';

    const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
    const baseUrl = host.startsWith('http') ? host : `${proto}://${host}`;
    const acceptUrl = `${baseUrl}/auth/accept-invite?token=${invite.token}`;

    // --- BLOCCO TRY-CATCH PER EVITARE CRASH SE EMAIL FALLISCE ---
    try {
      this.logger.log(`Tentativo invio email a ${invite.email}...`);
      await this.mailService.sendInviteEmail({
        to: invite.email,
        tenantName: tenantId,
        inviteLink: acceptUrl,
      });
      this.logger.log(`Email inviata con successo.`);
    } catch (e) {
      // Logghiamo l'errore ma procediamo senza bloccare la risposta
      this.logger.error(`ERRORE INVIO MAIL (ma l'utente è stato creato): ${e instanceof Error ? e.message : e}`);
    }
    // -------------------------------------------------------------

    return res.json({
      status: 'ok',
      invite,
      exampleAcceptUrl: acceptUrl,
    });
  }

  @Post('users/:id/role')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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
    const tenantId = this.getTenantId(req);

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
    const authUser = this.ensureAdmin(req, res);
    if (!authUser) return;

    const userId = Number(id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const result = await conn.query(
      `delete from ${tenantId}.users where id = $1 returning id`,
      [userId],
    );

    if ((result as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await this.auditService.log(req, {
      action: 'admin_delete_user',
      targetEmail: `ID:${userId}`,
      metadata: { deletedId: userId },
    });

    return res.json({ status: 'ok', deletedId: userId });
  }

  @Get('audit')
  async listAudit(@Req() req: Request, @Res() res: Response) {
    const authUser = (req as any).authUser;
    if (!authUser) return res.status(401).json({ error: 'Not authenticated' });

    if (!hasRoleAtLeast(authUser.role, 'manager')) {
      return res.status(403).json({ error: 'Manager or admin only' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `select id, action, actor_email, actor_role, target_email, metadata, ip, created_at
       from ${tenantId}.audit_log
       order by id desc
       limit 100`,
    );

    return res.json({ entries: rows });
  }
}