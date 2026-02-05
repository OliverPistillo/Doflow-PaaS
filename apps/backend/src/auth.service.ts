// apps/backend/src/auth.service.ts
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Role } from './roles';

type JwtPayload = {
  sub: any;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: Role;
  mfa_pending?: boolean;
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
   * ✅ Token Signer (back-compat + MFA stages)
   * - Se opts non passato: comportamento identico al vecchio (token FULL 1d)
   * - Se opts.authStage === 'MFA_PENDING': aggiunge mfa_pending=true e default TTL corto (10m)
   */
  private signToken(
    userId: any,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: {
      authStage?: 'FULL' | 'MFA_PENDING';
      mfaRequired?: boolean;
      expiresIn?: jwt.SignOptions['expiresIn'];
    },
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const t = safeSchema(tenantId);

    const authStage = opts?.authStage ?? 'FULL';
    const expiresIn =
      opts?.expiresIn ??
      (authStage === 'MFA_PENDING' ? ('10m' as const) : ('1d' as const));

    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: t,
      tenantSlug,
      role,
      ...(authStage === 'MFA_PENDING' ? { mfa_pending: true } : {}),
      ...(typeof opts?.mfaRequired === 'boolean' ? { mfa_required: opts.mfaRequired } : {}),
    };

    // ✅ fix typings: jwt.sign vuole secret: jwt.Secret
    return jwt.sign(payload as any, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
  }

  // ✅ wrapper pubblico per firmare token da controller (MFA unlock ecc.)
  public signTokenPublic(
    userId: any,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: {
      authStage?: 'FULL' | 'MFA_PENDING';
      mfaRequired?: boolean;
      expiresIn?: import('jsonwebtoken').SignOptions['expiresIn'];
    },
  ) {
    // chiamiamo il private in modo controllato (senza @ts-expect-error)
    return (this as any).signToken(userId, email, tenantId, tenantSlug, role, opts);
  }

  // ✅ login in un tenant specifico
  private async loginInTenant(
    conn: DataSource,
    tenantId: string,
    email: string,
    password: string,
  ) {
    const t = safeSchema(tenantId);

    // Recuperiamo lo SLUG reale (per il redirect frontend)
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
             mfa_enabled, mfa_verified_at, mfa_secret
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

    // ✅ MFA requirement detection
    const mfaRequired =
      !!user.mfa_enabled && !!user.mfa_verified_at && !!user.mfa_secret;

    // ✅ Token: pending se MFA richiesto
    const token = this.signToken(
      user.id,
      user.email,
      t,
      realSlug,
      user.role as Role,
      mfaRequired
        ? { authStage: 'MFA_PENDING', mfaRequired: true }
        : { authStage: 'FULL', mfaRequired: false },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        tenantId: t, // Back-compatibilità
        schema: t, // ✅ Esplicito per il frontend
        tenantSlug: realSlug, // ✅ FONDAMENTALE per il redirect
        role: user.role,
        mfa_enabled: !!user.mfa_enabled,
      },
      token,
      mfa: {
        required: mfaRequired,
        stage: mfaRequired ? 'MFA_PENDING' : 'FULL',
      },
    };
  }

  private async listActiveTenants(conn: DataSource): Promise<string[]> {
    const rows = await conn.query(
      `
      select schema_name
      from public.tenants
      where is_active = true
      order by created_at asc
      `,
    );

    return (rows || [])
      .map((r: any) => safeSchema(r.schema_name))
      .filter((s: string) => s && s !== 'public');
  }

  /**
   * ✅ LOGIN AUTO (Smart Version)
   * 1. Cerca in Public. Se trova SuperAdmin -> OK.
   * 2. Se trova User normale in Public -> IGNORA (assumiamo sia un residuo di test) e cerca nei tenant.
   * 3. Cerca in tutti i tenant attivi.
   */
  async loginAuto(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const currentTenant = this.getTenantId(req);

    // Se la request è già tenant-scoped (es. login esplicito), usa quella
    if (currentTenant !== 'public') {
      return this.login(req, email, password);
    }

    console.log(`🔍 LoginAuto: Cerco '${email}'...`);

    // 1) Prova login in PUBLIC
    try {
      const publicRes = await this.loginInTenant(conn, 'public', email, password);

      // FIX CRUCIALE: Accetta il login su 'public' SOLO se è un amministratore.
      // Se è un utente normale, probabilmente esiste anche nel tenant specifico e dobbiamo dare precedenza a quello.
      const r = String(publicRes.user.role || '').toUpperCase();
      if (['SUPER_ADMIN', 'SUPERADMIN', 'OWNER'].includes(r)) {
        console.log(`✅ Trovato SUPER_ADMIN in public.`);
        return publicRes;
      } else {
        console.warn(
          `⚠️ Trovato USER '${email}' in public, ma non è SuperAdmin. Ignoro e cerco nei tenant specifici...`,
        );
      }
    } catch (err) {
      // Non trovato in public o password errata, proseguiamo
    }

    // 2) Prova login in tutti i tenant attivi
    const tenants = await this.listActiveTenants(conn);

    for (const t of tenants) {
      try {
        const tenantRes = await this.loginInTenant(conn, t, email, password);
        console.log(`✅ Trovato utente in tenant: ${t}`);
        return tenantRes;
      } catch {
        // prova prossimo tenant
      }
    }

    throw new Error('Invalid credentials');
  }

  async register(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    // Recuperiamo lo slug anche qui
    let realSlug = tenantId;
    if (tenantId !== 'public') {
      const tenantRow = await conn.query(
        `select slug from public.tenants where schema_name = $1 limit 1`,
        [tenantId],
      );
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }

    await this.assertTenantActive(conn, tenantId);

    const existing = await conn.query(
      `select id from ${tenantId}.users where lower(email) = lower($1) limit 1`,
      [email],
    );
    if (existing.length > 0) throw new Error('User already exists');

    const countRes = await conn.query(
      `select count(*)::int as count from ${tenantId}.users`,
    );
    const isFirst = (countRes[0]?.count ?? 0) === 0;
    const role: Role = isFirst ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, 10);

    const rows = await conn.query(
      `
      insert into ${tenantId}.users (email, password_hash, role)
      values ($1, $2, $3)
      returning id, email, created_at, role
      `,
      [email, passwordHash, role],
    );

    const user = rows[0];

    const token = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);

    return {
      user: { ...user, tenantId, tenantSlug: realSlug, role: user.role },
      token,
    };
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
      const tenantRow = await conn.query(
        `select slug from public.tenants where schema_name = $1 limit 1`,
        [tenantId],
      );
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }

    await this.assertTenantActive(conn, tenantId);

    const invites = await conn.query(
      `
      select id, email, role, accepted_at, expires_at
      from ${tenantId}.invites
      where token = $1
      limit 1
      `,
      [token],
    );

    const invite = invites[0];
    if (!invite) throw new Error('Invalid invite token');
    if (invite.accepted_at) throw new Error('Invite already used');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite expired');
    }

    const existingUsers = await conn.query(
      `select id from ${tenantId}.users where lower(email) = lower($1) limit 1`,
      [invite.email],
    );
    if (existingUsers.length > 0) throw new Error('User already exists for this email');

    const passwordHash = await bcrypt.hash(password, 10);

    const users = await conn.query(
      `
      insert into ${tenantId}.users (email, password_hash, role)
      values ($1, $2, $3)
      returning id, email, created_at, role
      `,
      [invite.email, passwordHash, invite.role],
    );

    const user = users[0];

    await conn.query(
      `update ${tenantId}.invites set accepted_at = now() where id = $1`,
      [invite.id],
    );

    const jwtToken = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);

    return {
      user: { ...user, tenantId, tenantSlug: realSlug },
      token: jwtToken,
    };
  }
}
