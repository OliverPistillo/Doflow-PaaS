import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as jwt from 'jsonwebtoken';
import { Role } from './roles';

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

function nowIso() {
  return new Date().toISOString();
}

@Injectable()
export class AuthMfaService {
  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) throw new Error('No tenant connection on request');
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return safeSchema(tenantId ?? 'public');
  }

  private signToken(payload: any, expiresIn: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    // cast per evitare rogne di typings
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  private makeFullToken(userId: string, email: string, tenantId: string, tenantSlug: string, role: Role) {
    return this.signToken(
      {
        sub: userId,
        email,
        tenantId: safeSchema(tenantId),
        tenantSlug,
        role,
      },
      '1d',
    );
  }

  private makePendingToken(userId: string, email: string, tenantId: string, tenantSlug: string, role: Role) {
    return this.signToken(
      {
        sub: userId,
        email,
        tenantId: safeSchema(tenantId),
        tenantSlug,
        role,
        mfa_pending: true,
      },
      '10m',
    );
  }

  /**
   * Start:
   * - se mfa_secret assente o mfa_verified_at null -> setup
   * - se già verified -> challenge
   */
  async start(req: Request, userId: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      select id, email, role, mfa_enabled, mfa_secret, mfa_verified_at, mfa_failed_attempts, mfa_locked_until
      from ${tenantId}.users
      where id = $1
      limit 1
      `,
      [userId],
    );

    const user = rows[0];
    if (!user) throw new UnauthorizedException('User not found');

    // lock check
    if (user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
      throw new ForbiddenException('MFA locked. Try later.');
    }

    const issuer = 'Doflow';
    const label = `${issuer}:${user.email}`;
    const isVerified = !!user.mfa_verified_at && user.mfa_enabled === true && !!user.mfa_secret;

    // 1) MFA già attivo: challenge TOTP
    if (isVerified) {
      return {
        mode: 'challenge' as const,
        method: 'totp' as const,
        email: user.email,
        remainingAttempts: Math.max(0, 6 - Number(user.mfa_failed_attempts || 0)),
        lockedUntil: user.mfa_locked_until ?? null,
      };
    }

    // 2) setup: genera secret e salva
    const secret = speakeasy.generateSecret({
      name: label, // molti authenticator usano questo per il display
      issuer,
      length: 20,
    });

    // salva secret (base32) ma NON abilitiamo finché non verifica
    await conn.query(
      `
      update ${tenantId}.users
      set mfa_secret = $1,
          mfa_enabled = false,
          mfa_verified_at = null,
          mfa_failed_attempts = 0,
          mfa_locked_until = null
      where id = $2
      `,
      [secret.base32, userId],
    );

    const otpauthUrl = secret.otpauth_url;
    const qrDataUrl = otpauthUrl ? await QRCode.toDataURL(otpauthUrl) : null;

    return {
      mode: 'setup' as const,
      method: 'totp' as const,
      email: user.email,
      otpauthUrl,
      qrDataUrl,
      issuer,
    };
  }

  /**
   * Verify:
   * - se non verified: verifica e attiva MFA
   * - se verified: challenge e upgrade token
   */
  async verify(req: Request, userId: string, code: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    // ci serve anche lo slug reale (per redirect)
    let tenantSlug = tenantId;
    if (tenantId !== 'public') {
      const t = await conn.query(
        `select slug from public.tenants where schema_name = $1 limit 1`,
        [tenantId],
      );
      if (t[0]?.slug) tenantSlug = String(t[0].slug);
    }

    const rows = await conn.query(
      `
      select id, email, role, mfa_enabled, mfa_secret, mfa_verified_at, mfa_failed_attempts, mfa_locked_until
      from ${tenantId}.users
      where id = $1
      limit 1
      `,
      [userId],
    );

    const user = rows[0];
    if (!user) throw new UnauthorizedException('User not found');

    if (user.mfa_locked_until && new Date(user.mfa_locked_until) > new Date()) {
      throw new ForbiddenException('MFA locked. Try later.');
    }

    if (!user.mfa_secret) {
      throw new ForbiddenException('MFA not initialized. Call /auth/mfa/start.');
    }

    const ok = speakeasy.totp.verify({
      secret: String(user.mfa_secret),
      encoding: 'base32',
      token: code,
      window: 1, // tolleranza clock drift
    });

    if (!ok) {
      const attempts = Number(user.mfa_failed_attempts || 0) + 1;

      // policy: 6 tentativi, poi lock 15 minuti
      const lock =
        attempts >= 6 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await conn.query(
        `
        update ${tenantId}.users
        set mfa_failed_attempts = $1,
            mfa_locked_until = $2
        where id = $3
        `,
        [attempts, lock, userId],
      );

      throw new ForbiddenException('Invalid MFA code');
    }

    // ok -> reset counters
    const wasVerified = !!user.mfa_verified_at && user.mfa_enabled === true;

    if (!wasVerified) {
      // completing enrollment
      await conn.query(
        `
        update ${tenantId}.users
        set mfa_enabled = true,
            mfa_verified_at = $1,
            mfa_failed_attempts = 0,
            mfa_locked_until = null
        where id = $2
        `,
        [nowIso(), userId],
      );
    } else {
      // challenge success
      await conn.query(
        `
        update ${tenantId}.users
        set mfa_failed_attempts = 0,
            mfa_locked_until = null
        where id = $1
        `,
        [userId],
      );
    }

    // upgrade token FULL
    const fullToken = this.makeFullToken(
      String(user.id),
      String(user.email),
      tenantId,
      tenantSlug,
      String(user.role) as Role,
    );

    return {
      ok: true,
      token: fullToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId,
        tenantSlug,
        mfa_enabled: true,
      },
    };
  }
}
