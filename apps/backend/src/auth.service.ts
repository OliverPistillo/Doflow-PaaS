// apps/backend/src/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default'; // ✅ NEW: Per TOTP
import { toDataURL } from 'qrcode';     // ✅ NEW: Per QR Code
import { Role } from './roles';

type JwtPayload = {
  sub: any;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: Role;
  authStage?: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED'; // ✅ Aggiornato
  mfa_required?: boolean;
};

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

@Injectable()
export class AuthService {
  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) throw new Error('No tenant connection on request');
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return safeSchema(tenantId ?? 'public');
  }

  private async assertTenantActive(conn: DataSource, tenantId: string) {
    const t = safeSchema(tenantId);
    if (t === 'public') return;

    const rows = await conn.query(
      `select is_active from public.tenants where schema_name = $1 limit 1`,
      [t],
    );

    if (!rows[0] || rows[0].is_active !== true) {
      throw new Error('Tenant disabled');
    }
  }

  /**
   * ✅ Token Signer Aggiornato
   * Gestisce authStage per limitare l'accesso durante il setup o la verifica MFA.
   */
  private signToken(
    userId: any,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: {
      authStage?: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
      mfaRequired?: boolean;
      expiresIn?: jwt.SignOptions['expiresIn'];
    },
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const t = safeSchema(tenantId);

    const authStage = opts?.authStage ?? 'FULL';
    
    // Se non siamo in FULL, il token dura poco (es. 15 minuti per fare setup/verify)
    const expiresIn =
      opts?.expiresIn ??
      (authStage !== 'FULL' ? ('15m' as const) : ('1d' as const));

    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: t,
      tenantSlug,
      role,
      authStage, // ✅ Importante per il frontend
      ...(typeof opts?.mfaRequired === 'boolean' ? { mfa_required: opts.mfaRequired } : {}),
    };

    return jwt.sign(payload as any, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
  }

  // ✅ Wrapper pubblico
  public signTokenPublic(
    userId: any,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: {
      authStage?: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
      mfaRequired?: boolean;
      expiresIn?: import('jsonwebtoken').SignOptions['expiresIn'];
    },
  ) {
    return (this as any).signToken(userId, email, tenantId, tenantSlug, role, opts);
  }

  // =================================================================
  //  LOGICHE DI LOGIN (Modificate per MFA Setup)
  // =================================================================

  private async loginInTenant(
    conn: DataSource,
    tenantId: string,
    email: string,
    password: string,
  ) {
    const t = safeSchema(tenantId);

    // Recuperiamo lo SLUG reale
    let realSlug = t;
    if (t !== 'public') {
      const tenantRow = await conn.query(
        `select slug from public.tenants where schema_name = $1 limit 1`,
        [t],
      );
      if (tenantRow[0]?.slug) {
        realSlug = tenantRow[0].slug;
      }
    }

    await this.assertTenantActive(conn, t);

    const rows = await conn.query(
      `
      select id, email, password_hash, created_at, role,
             mfa_enabled, mfa_secret
      from ${t}.users
      where lower(email) = lower($1)
      limit 1
      `,
      [email],
    );

    const user = rows[0];
    if (!user || !user.password_hash) throw new Error('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash as string);
    if (!ok) throw new Error('Invalid credentials');

    // ✅ NUOVA LOGICA MFA
    const mfaEnabledByAdmin = !!user.mfa_enabled; // Switch nel DB
    const hasSecret = !!user.mfa_secret;          // Utente ha già configurato?

    let authStage: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED' = 'FULL';
    let mfaRequired = false;

    if (mfaEnabledByAdmin) {
      mfaRequired = true;
      if (hasSecret) {
        // Ha il segreto -> Deve verificare OTP
        authStage = 'MFA_PENDING';
      } else {
        // NON ha il segreto -> Deve fare enrollment
        authStage = 'MFA_SETUP_NEEDED';
      }
    }

    const token = this.signToken(
      user.id,
      user.email,
      t,
      realSlug,
      user.role as Role,
      { authStage, mfaRequired },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        tenantId: t,
        schema: t,
        tenantSlug: realSlug,
        role: user.role,
        mfa_enabled: mfaEnabledByAdmin,
      },
      token,
      mfa: {
        required: mfaRequired,
        stage: authStage, // Il frontend userà questo per il redirect
      },
    };
  }

  // =================================================================
  //  NUOVI METODI PER MFA (Setup & Confirm)
  // =================================================================

  /**
   * Genera il segreto MFA e il QR Code.
   * NON salva ancora nel DB (lo fa al confirm).
   */
  async generateMfaSetup(req: Request) {
    const user = (req as any).user; // dal token temporaneo
    if (!user) throw new UnauthorizedException();

    const email = user.email;
    const serviceName = `Doflow (${user.tenantSlug || 'App'})`;

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, serviceName, secret);
    const qrCodeUrl = await toDataURL(otpauthUrl);

    return { secret, qrCodeUrl };
  }

  /**
   * Verifica il codice OTP e, se valido, salva il segreto nel DB del tenant.
   * Ritorna un nuovo token FULL.
   */
  async confirmMfaAndEnable(req: Request, tokenOtp: string, secret: string) {
    const userPayload = (req as any).user;
    if (!userPayload) throw new UnauthorizedException();

    // 1. Verifica OTP
    const isValid = authenticator.verify({ token: tokenOtp, secret });
    if (!isValid) throw new UnauthorizedException('Codice OTP non valido');

    // 2. Salva nel DB del tenant
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req); // dal token temporaneo
    const t = safeSchema(tenantId);

    // Salviamo mfa_secret e mfa_enabled (ridondante ma sicuro)
    await conn.query(
      `UPDATE ${t}.users SET mfa_secret = $1, mfa_enabled = true WHERE id = $2`,
      [secret, userPayload.sub],
    );

    // 3. Genera token FULL
    const token = this.signToken(
      userPayload.sub,
      userPayload.email,
      t,
      userPayload.tenantSlug,
      userPayload.role,
      { authStage: 'FULL', mfaRequired: true }
    );

    return { status: 'ok', token };
  }

  // =================================================================
  //  METODI DI LOGIN AUTO / REGISTER / ACCEPT (Invariati o adattati)
  // =================================================================

  private async listActiveTenants(conn: DataSource): Promise<string[]> {
    const rows = await conn.query(
      `select schema_name from public.tenants where is_active = true order by created_at asc`
    );
    return (rows || []).map((r: any) => safeSchema(r.schema_name)).filter((s: string) => s && s !== 'public');
  }

  async loginAuto(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const currentTenant = this.getTenantId(req);

    if (currentTenant !== 'public') {
      return this.loginInTenant(conn, currentTenant, email, password);
    }

    // 1) Prova login in PUBLIC
    try {
      const publicRes = await this.loginInTenant(conn, 'public', email, password);
      const r = String(publicRes.user.role || '').toUpperCase();
      if (['SUPER_ADMIN', 'SUPERADMIN', 'OWNER'].includes(r)) {
        return publicRes;
      }
    } catch (err) {}

    // 2) Prova login nei tenant
    const tenants = await this.listActiveTenants(conn);
    for (const t of tenants) {
      try {
        return await this.loginInTenant(conn, t, email, password);
      } catch {}
    }

    throw new Error('Invalid credentials');
  }

  async register(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    let realSlug = tenantId;
    if (tenantId !== 'public') {
      const tenantRow = await conn.query(`select slug from public.tenants where schema_name = $1 limit 1`, [tenantId]);
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }

    await this.assertTenantActive(conn, tenantId);

    const existing = await conn.query(`select id from ${tenantId}.users where lower(email) = lower($1) limit 1`, [email]);
    if (existing.length > 0) throw new Error('User already exists');

    const countRes = await conn.query(`select count(*)::int as count from ${tenantId}.users`);
    const isFirst = (countRes[0]?.count ?? 0) === 0;
    const role: Role = isFirst ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, 10);

    const rows = await conn.query(
      `insert into ${tenantId}.users (email, password_hash, role) values ($1, $2, $3) returning id, email, created_at, role`,
      [email, passwordHash, role],
    );

    const user = rows[0];
    const token = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);

    return { user: { ...user, tenantId, tenantSlug: realSlug, role: user.role }, token };
  }

  async login(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);
    return this.loginInTenant(conn, tenantId, email, password);
  }

  async acceptInvite(req: Request, token: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    let realSlug = tenantId;
    if (tenantId !== 'public') {
      const tenantRow = await conn.query(`select slug from public.tenants where schema_name = $1 limit 1`, [tenantId]);
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }

    await this.assertTenantActive(conn, tenantId);

    const invites = await conn.query(
      `select id, email, role, accepted_at, expires_at from ${tenantId}.invites where token = $1 limit 1`,
      [token],
    );

    const invite = invites[0];
    if (!invite) throw new Error('Invalid invite token');
    if (invite.accepted_at) throw new Error('Invite already used');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('Invite expired');

    const existingUsers = await conn.query(`select id from ${tenantId}.users where lower(email) = lower($1) limit 1`, [invite.email]);
    if (existingUsers.length > 0) throw new Error('User already exists for this email');

    const passwordHash = await bcrypt.hash(password, 10);

    const users = await conn.query(
      `insert into ${tenantId}.users (email, password_hash, role) values ($1, $2, $3) returning id, email, created_at, role`,
      [invite.email, passwordHash, invite.role],
    );

    const user = users[0];
    await conn.query(`update ${tenantId}.invites set accepted_at = now() where id = $1`, [invite.id]);

    const jwtToken = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);

    return { user: { ...user, tenantId, tenantSlug: realSlug }, token: jwtToken };
  }
}