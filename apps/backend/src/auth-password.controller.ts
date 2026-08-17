import {
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs'; // namespace import — sicuro con qualsiasi bundler/tsconfig
import { MailService } from './mail/mail.service';
import { safeSchema } from './common/schema.utils';

function getTenantId(req: Request): string {
  const tenantId = (req as any).tenantId as string | undefined;
  return safeSchema(tenantId ?? 'public', 'AuthPasswordController');
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
  private readonly logger = new Logger(AuthPasswordController.name);

  constructor(
    private readonly mail: MailService,
  ) {}

  private async resolveTenant(
    req: Request,
    options: { tenantRef?: string; email?: string } = {},
  ): Promise<{ tenantId: string; tenantSlug: string; conn: DataSource } | null> {
    const conn = getTenantConn(req);
    const routedTenant = getTenantId(req);
    if (routedTenant !== 'public') {
      const rows = await conn.query(
        `select slug, schema_name, is_active from public.tenants where schema_name = $1 limit 1`,
        [routedTenant],
      );
      if (rows[0]?.is_active === false) return null;
      return {
        tenantId: routedTenant,
        tenantSlug: String(rows[0]?.slug || routedTenant),
        conn,
      };
    }

    let tenantRef = String(options.tenantRef || '').trim().toLowerCase();
    if (!tenantRef && options.email) {
      const directory = await conn.query(
        `select tenant_id, role from public.users where lower(email) = lower($1) limit 1`,
        [options.email],
      );
      const entry = directory[0];
      if (!entry) return { tenantId: 'public', tenantSlug: 'public', conn };
      const role = String(entry.role || '').toLowerCase();
      if (!entry.tenant_id || entry.tenant_id === 'public' || ['superadmin', 'super_admin'].includes(role)) {
        return { tenantId: 'public', tenantSlug: 'public', conn };
      }
      tenantRef = String(entry.tenant_id).toLowerCase();
    }

    if (!tenantRef || tenantRef === 'public') {
      return { tenantId: 'public', tenantSlug: 'public', conn };
    }

    const tenants = await conn.query(
      `select slug, schema_name, is_active
         from public.tenants
        where id::text = $1 or slug = $1 or schema_name = $1
        limit 1`,
      [tenantRef],
    );
    if (!tenants[0] || tenants[0].is_active !== true) return null;
    return {
      tenantId: safeSchema(tenants[0].schema_name, 'AuthPasswordController.resolveTenant'),
      tenantSlug: String(tenants[0].slug),
      conn,
    };
  }

  @Post('forgot-password')
  async forgotPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { email?: string },
  ) {
    const email = (body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'email required' });
    }

    const resolved = await this.resolveTenant(req, { email });
    if (!resolved) return res.json({ ok: true });
    const { tenantId, tenantSlug, conn } = resolved;

    // verifica esistenza utente nel tenant
    const userRows = await conn.query(
      `select id, email from "${tenantId}".users where lower(email) = $1 limit 1`,
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
      insert into "${tenantId}".password_reset_tokens
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
    )}&tenant=${encodeURIComponent(tenantSlug)}`;

    this.logger.log('[DOFLOW][RESET-PASSWORD] Richiesta elaborata');

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
      tenant?: string;
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

    const resolved = await this.resolveTenant(req, { tenantRef: body.tenant });
    if (!resolved) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }
    const { tenantId, conn } = resolved;

    const tokenHash = hashToken(token);

    const rows = await conn.query(
      `
      select id, email, created_at, expires_at, used_at, invalidated_at
      from "${tenantId}".password_reset_tokens
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

    const claimed = await conn.query(
      `
      update "${tenantId}".password_reset_tokens
      set used_at = $1
      where id = $2
        and used_at is null
        and invalidated_at is null
        and expires_at >= $1
      returning id
      `,
      [now.toISOString(), row.id],
    );
    if (!claimed[0]) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    await conn.query(
      `
      update "${tenantId}".users
      set password_hash = $1
      where lower(email) = $2
      `,
      [passwordHash, row.email.toLowerCase()],
    );

    return res.json({ ok: true });
  }
}
