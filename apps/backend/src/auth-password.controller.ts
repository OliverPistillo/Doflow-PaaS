import {
  Body,
  Controller,
  Optional,
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
import { WebSessionService } from './auth/web-session.service';
import { RedisService } from './redis/redis.service';
import { AuditService } from './audit.service';

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
    @Optional() private readonly webSessions?: WebSessionService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  private requestIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return firstForwarded?.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  private async consumeRateLimit(
    req: Request,
    scope: 'forgot' | 'reset',
    discriminator: string,
    limit: number,
    windowSeconds: number,
  ): Promise<number | null> {
    if (!this.redis) return null;
    const digest = createHash('sha256')
      .update(`${this.requestIp(req)}|${discriminator.toLowerCase()}`)
      .digest('hex');
    const key = `df:auth:${scope}:${digest}`;

    try {
      const client = this.redis.getClient();
      const attempts = await client.incr(key);
      if (attempts === 1) await client.expire(key, windowSeconds);
      if (attempts <= limit) return null;
      const ttl = await client.ttl(key);
      return ttl > 0 ? ttl : windowSeconds;
    } catch (error) {
      this.logger.error('Password recovery rate limiter unavailable', error);
      return null;
    }
  }

  private async clearRateLimit(
    req: Request,
    scope: 'forgot' | 'reset',
    discriminator: string,
  ) {
    if (!this.redis) return;
    const digest = createHash('sha256')
      .update(`${this.requestIp(req)}|${discriminator.toLowerCase()}`)
      .digest('hex');
    try {
      await this.redis.del(`df:auth:${scope}:${digest}`);
    } catch (error) {
      this.logger.error('Unable to clear password recovery rate limit', error);
    }
  }

  private async auditSafe(
    req: Request,
    action: string,
    tenantSchema: string,
    options: { targetEmail?: string; metadata?: Record<string, unknown> } = {},
  ) {
    if (!this.audit) return;
    try {
      await this.audit.log(req, {
        action,
        tenantSchema,
        targetEmail: options.targetEmail,
        metadata: options.metadata,
      });
    } catch (error) {
      this.logger.error(`Unable to write audit event ${action}`, error);
    }
  }

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
      if (!entry.tenant_id || entry.tenant_id === 'public') {
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

    const retryAfter = await this.consumeRateLimit(req, 'forgot', email, 5, 15 * 60);
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'too many requests' });
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
      await this.auditSafe(req, 'auth.password_reset.requested', tenantId, {
        metadata: { accountMatched: false },
      });
      return res.json({ ok: true });
    }

    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000); // 15 minuti

    const runner = conn.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `update "${tenantId}".password_reset_tokens
            set invalidated_at = $1
          where lower(email) = $2 and used_at is null and invalidated_at is null`,
        [now.toISOString(), email],
      );
      await runner.query(
        `insert into "${tenantId}".password_reset_tokens
          (token_hash, email, created_at, expires_at)
         values ($1, $2, $3, $4)`,
        [tokenHash, email, now.toISOString(), expires.toISOString()],
      );
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

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

    await this.auditSafe(req, 'auth.password_reset.requested', tenantId, {
      targetEmail: email,
      metadata: { accountMatched: true, expiresInMinutes: 15 },
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

    const resetDiscriminator = token ? hashToken(token) : 'missing';
    const retryAfter = await this.consumeRateLimit(
      req,
      'reset',
      resetDiscriminator,
      8,
      15 * 60,
    );
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'too many requests' });
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
    const { tenantId, tenantSlug, conn } = resolved;

    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 10);
    const runner = conn.createQueryRunner();
    let userId = '';
    let userEmail = '';
    await runner.connect();
    await runner.startTransaction();
    try {
      const rows = await runner.query(
        `select id, email, expires_at, used_at, invalidated_at
           from "${tenantId}".password_reset_tokens
          where token_hash = $1
          order by id desc
          limit 1
          for update`,
        [tokenHash],
      );
      const row = rows[0] as {
        id: number;
        email: string;
        expires_at: string;
        used_at: string | null;
        invalidated_at: string | null;
      } | undefined;
      const now = new Date();
      if (!row || row.used_at || row.invalidated_at || now > new Date(row.expires_at)) {
        await runner.rollbackTransaction();
        await this.auditSafe(req, 'auth.password_reset.failed', tenantId, {
          metadata: { reason: 'invalid_or_expired' },
        });
        return res.status(400).json({ error: 'invalid or expired token' });
      }

      const claimed = await runner.query(
        `update "${tenantId}".password_reset_tokens
            set used_at = $1
          where id = $2 and used_at is null and invalidated_at is null and expires_at >= $1
          returning id`,
        [now.toISOString(), row.id],
      );
      if (!claimed[0]) {
        await runner.rollbackTransaction();
        await this.auditSafe(req, 'auth.password_reset.failed', tenantId, {
          metadata: { reason: 'already_claimed' },
        });
        return res.status(400).json({ error: 'invalid or expired token' });
      }

      const users = await runner.query(
        `update "${tenantId}".users
            set password_hash = $1
          where lower(email) = $2
          returning id`,
        [passwordHash, row.email.toLowerCase()],
      );
      if (!users[0]?.id) throw new Error('Reset target user not found');
      userId = String(users[0].id);
      userEmail = row.email.toLowerCase();

      await runner.query(
        `update "${tenantId}".password_reset_tokens
            set invalidated_at = $1
          where lower(email) = $2 and used_at is null and invalidated_at is null`,
        [now.toISOString(), row.email.toLowerCase()],
      );
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    if (userId && this.webSessions) {
      await this.webSessions.revokeUserSessions(tenantSlug, userId);
      await this.webSessions.revoke(req);
      this.webSessions.clear(res);
    }

    await this.clearRateLimit(req, 'reset', resetDiscriminator);
    await this.auditSafe(req, 'auth.password_reset.completed', tenantId, {
      targetEmail: userEmail,
      metadata: { sessionsRevoked: Boolean(userId && this.webSessions) },
    });

    return res.json({ ok: true });
  }
}
