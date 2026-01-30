// apps/backend/src/auth.service.ts
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Role } from './roles';

type JwtPayload = {
  sub: number;
  email: string;
  tenantId: string;
  tenantSlug: string; 
  role: Role;
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

  private signToken(userId: number, email: string, tenantId: string, tenantSlug: string, role: Role) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const t = safeSchema(tenantId);

    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: t,
      tenantSlug: tenantSlug, // ✅ Ora usiamo lo slug reale passato come parametro
      role,
    };

    return jwt.sign(payload, secret, { expiresIn: '1d' });
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
           [t]
        );
        if (tenantRow[0]?.slug) {
            realSlug = tenantRow[0].slug;
        }
    }

    await this.assertTenantActive(conn, t);

    const rows = await conn.query(
      `
      select id, email, password_hash, created_at, role
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

    const token = this.signToken(user.id, user.email, t, realSlug, user.role as Role);

    return {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        tenantId: t,         // Back-compatibilità
        schema: t,           // ✅ Esplicito per il frontend
        tenantSlug: realSlug, // ✅ FONDAMENTALE per il redirect
        role: user.role,
      },
      token,
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

  async loginAuto(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const currentTenant = this.getTenantId(req);

    if (currentTenant !== 'public') {
      return this.login(req, email, password);
    }

    // 1) prova login in public
    try {
      return await this.loginInTenant(conn, 'public', email, password);
    } catch {
      // continua
    }

    // 2) prova login nei tenant
    const tenants = await this.listActiveTenants(conn);

    for (const t of tenants) {
      try {
        return await this.loginInTenant(conn, t, email, password);
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
           [tenantId]
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
         const tenantRow = await conn.query(
           `select slug from public.tenants where schema_name = $1 limit 1`,
           [tenantId]
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