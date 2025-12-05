import {
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { MailService } from './mail/mail.service';

function getTenantId(req: Request): string {
  const tenantId = (req as any).tenantId as string | undefined;
  return tenantId ?? 'public';
}

function getTenantConn(req: Request): DataSource {
  const conn = (req as any).tenantConnection as DataSource | undefined;
  if (!conn) {
    throw new Error('No tenant connection on request');
  }
  return conn;
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

@Controller('auth')
export class AuthPasswordController {
  constructor(
    private readonly mail: MailService,
  ) {}

  @Post('forgot-password')
  async forgotPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { email?: string },
  ) {
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    const tenantId = getTenantId(req);
    const conn = getTenantConn(req);

    // verifica esistenza utente nel tenant
    const userRows = await conn.query(
      `select id, email from ${tenantId}.users where lower(email) = $1 limit 1`,
      [email],
    );

    if (userRows.length === 0) {
      // rispondi comunque 200 per non leakare utenti
      return res.json({ ok: true });
    }

    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000); // 15 minuti

    await conn.query(
      `
      insert into ${tenantId}.password_reset_tokens
      (token_hash, email, created_at, expires_at)
      values ($1, $2, $3, $4)
      `,
      [tokenHash, email, now.toISOString(), expires.toISOString()],
    );

    const host =
      (req.headers['x-forwarded-host'] as string) ??
      (req.headers.host as string) ??
      process.env.APP_BASE_URL ??
      'app.doflow.it';

    const proto =
      (req.headers['x-forwarded-proto'] as string) ?? 'https';

    const baseUrl =
      host.startsWith('http://') || host.startsWith('https://')
        ? host
        : `${proto}://${host}`;

    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(
      rawToken,
    )}`;

    console.log(
      `[DOFLOW][RESET-PASSWORD] email=${email} tenant=${tenantId} link=${resetLink}`,
    );

    await this.mail.sendPasswordResetEmail({
      to: email,
      resetLink,
    });

    return res.json({ ok: true });
  }

  @Post('reset-password')
  async resetPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    body: {
      token?: string;
      password?: string;
    },
  ) {
    const token = (body.token ?? '').trim();
    const password = body.password ?? '';

    if (!token || !password) {
      return res.status(400).json({ error: 'token and password required' });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: 'password too short (min 8 chars)' });
    }

    const tenantId = getTenantId(req);
    const conn = getTenantConn(req);

    const tokenHash = hashToken(token);

    const rows = await conn.query(
      `
      select id, email, created_at, expires_at, used_at, invalidated_at
      from ${tenantId}.password_reset_tokens
      where token_hash = $1
      order by id desc
      limit 1
      `,
      [tokenHash],
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const row = rows[0] as {
      id: number;
      email: string;
      expires_at: string;
      used_at: string | null;
      invalidated_at: string | null;
    };

    const now = new Date();
    const exp = new Date(row.expires_at);

    if (row.used_at || row.invalidated_at || now > exp) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 🔧 QUI il fix: niente updated_at (la colonna non esiste)
    await conn.query(
      `
      update ${tenantId}.users
      set password_hash = $1
      where lower(email) = $2
      `,
      [passwordHash, row.email.toLowerCase()],
    );

    await conn.query(
      `
      update ${tenantId}.password_reset_tokens
      set used_at = $1
      where id = $2
      `,
      [now.toISOString(), row.id],
    );

    return res.json({ ok: true });
  }
}
