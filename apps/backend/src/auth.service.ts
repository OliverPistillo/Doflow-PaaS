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
  role: Role;
};

@Injectable()
export class AuthService {
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

  async register(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const existing = await conn.query(
      `select id from ${tenantId}.users where email = $1 limit 1`,
      [email],
    );
    if (existing.length > 0) {
      throw new Error('User already exists');
    }

    // primo utente del tenant -> admin, gli altri -> user
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
    const token = this.signToken(
      user.id,
      user.email,
      tenantId,
      user.role as Role,
    );

    return { user: { ...user, tenantId, role: user.role }, token };
  }

  async login(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      select id, email, password_hash, created_at, role
      from ${tenantId}.users
      where email = $1
      limit 1
      `,
      [email],
    );

    const user = rows[0];
    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password_hash as string);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    const token = this.signToken(
      user.id,
      user.email,
      tenantId,
      user.role as Role,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        tenantId,
        role: user.role,
      },
      token,
    };
  }

  async acceptInvite(req: Request, token: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

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
    if (!invite) {
      throw new Error('Invalid invite token');
    }

    if (invite.accepted_at) {
      throw new Error('Invite already used');
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite expired');
    }

    // controlla se esiste già un utente con quella email
    const existingUsers = await conn.query(
      `select id from ${tenantId}.users where email = $1 limit 1`,
      [invite.email],
    );
    if (existingUsers.length > 0) {
      throw new Error('User already exists for this email');
    }

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

    // marca l'invito come usato
    await conn.query(
      `update ${tenantId}.invites set accepted_at = now() where id = $1`,
      [invite.id],
    );

    const jwtToken = this.signToken(
      user.id,
      user.email,
      tenantId,
      user.role as Role,
    );

    return {
      user: { ...user, tenantId },
      token: jwtToken,
    };
  }

  private signToken(
    userId: number,
    email: string,
    tenantId: string,
    role: Role,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not set');
    }

    const payload: JwtPayload = { sub: userId, email, tenantId, role };
    return jwt.sign(payload, secret, { expiresIn: '1d' });
  }
}
