import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import { toDataURL } from 'qrcode';
import { Role } from './roles';

type JwtPayload = {
  sub: any;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: Role;
  authStage?: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED'; 
  mfa_required?: boolean;
};

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_ -]+$/.test(s)) return 'public';
  return s;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    return conn || this.dataSource;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return safeSchema(tenantId ?? 'public');
  }

  private async assertTenantActive(conn: DataSource, tenantId: string) {
    const t = safeSchema(tenantId);
    if (t === 'public') return;

    // FIX: Ricerca indistruttibile
    const rows = await conn.query(
      `select is_active from public.tenants where schema_name = $1 OR slug = $1 OR id::text = $1 limit 1`,
      [t],
    );

    if (!rows[0] || rows[0].is_active !== true) {
      throw new Error('Tenant disabled');
    }
  }

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
    
    const expiresIn =
      opts?.expiresIn ??
      (authStage !== 'FULL' ? ('15m' as const) : ('1d' as const));

    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: t,
      tenantSlug,
      role,
      authStage,
      ...(typeof opts?.mfaRequired === 'boolean' ? { mfa_required: opts.mfaRequired } : {}),
    };

    return jwt.sign(payload as any, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
  }

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
  //  LOGIN LOGIC
  // =================================================================

  private async loginInTenant(
    conn: DataSource,
    tenantId: string,
    email: string,
    password: string,
  ) {
    const t = safeSchema(tenantId);
    let realSlug = t;
    
    if (t !== 'public') {
      // FIX: Ricerca indistruttibile
      const tenantRow = await conn.query(
        `select slug from public.tenants where schema_name = $1 OR id::text = $1 limit 1`,
        [t],
      );
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }

    await this.assertTenantActive(conn, t);

    const rows = await conn.query(
      `
      select id, email, password_hash, created_at, role,
             mfa_enabled, mfa_secret
      from "${t}"."users"
      where lower(email) = lower($1)
      limit 1
      `,
      [email],
    );

    const user = rows[0];
    if (!user || !user.password_hash) {
        this.logger.warn(`Login Fallito: Utente non trovato o password_hash mancante nello schema [${t}]`);
        throw new UnauthorizedException('Credenziali non valide');
    }

    const ok = await bcrypt.compare(password, user.password_hash as string);
    if (!ok) {
        this.logger.warn(`Login Fallito: Password errata per l'utente ${email} nello schema [${t}]`);
        throw new UnauthorizedException('Credenziali non valide');
    }

    const mfaEnabledByAdmin = !!user.mfa_enabled;
    const hasSecret = !!user.mfa_secret;

    let authStage: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED' = 'FULL';
    let mfaRequired = false;

    if (mfaEnabledByAdmin) {
      mfaRequired = true;
      if (hasSecret) {
        authStage = 'MFA_PENDING';
      } else {
        authStage = 'MFA_SETUP_NEEDED';
      }
    }

    const token = this.signToken(user.id, user.email, t, realSlug, user.role as Role, { authStage, mfaRequired });

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
      mfa: { required: mfaRequired, stage: authStage },
    };
  }

  async loginAuto(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const currentTenant = this.getTenantId(req);

    if (currentTenant !== 'public') {
      return this.loginInTenant(conn, currentTenant, email, password);
    }

    const directoryLookup = await conn.query(
      `select tenant_id, role from public.users where lower(email) = lower($1) limit 1`,
      [email]
    );

    if (directoryLookup.length > 0) {
        const userMap = directoryLookup[0];
        
        if (!userMap.tenant_id || userMap.tenant_id === 'public' || ['superadmin', 'owner'].includes(userMap.role)) {
             return this.loginInTenant(conn, 'public', email, password);
        }

        // FIX: Ricerca indistruttibile per evitare l'errore del cast UUID
        const tenantRow = await conn.query(
            `select schema_name from public.tenants where id::text = $1 OR slug = $1 OR schema_name = $1 limit 1`,
            [userMap.tenant_id]
        );

        if (tenantRow.length > 0) {
            const targetSchema = tenantRow[0].schema_name;
            return await this.loginInTenant(conn, targetSchema, email, password);
        }
    }

    const tenants = await this.listActiveTenants(conn);
    for (const t of tenants) {
      try {
        return await this.loginInTenant(conn, t, email, password);
      } catch {}
    }

    throw new UnauthorizedException('Credenziali non valide');
  }

  // =================================================================
  //  MFA METHODS (SETUP & VERIFY)
  // =================================================================

  async generateMfaSetup(req: Request) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();

    const email = user.email;
    const serviceName = `Doflow (${user.tenantSlug || 'App'})`;

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, serviceName, secret);
    const qrCodeUrl = await toDataURL(otpauthUrl);

    return { secret, qrCodeUrl, otpauthUrl };
  }

  async confirmMfaAndEnable(req: Request, tokenOtp: string, secret: string) {
    const userPayload = (req as any).user;
    if (!userPayload) throw new UnauthorizedException();

    const isValid = authenticator.verify({ token: tokenOtp, secret });
    if (!isValid) throw new UnauthorizedException('Codice OTP non valido');

    const conn = this.getConn(req);
    const t = safeSchema(userPayload.tenantId);

    await conn.query(
      `UPDATE "${t}"."users" SET mfa_secret = $1, mfa_enabled = true WHERE id = $2`,
      [secret, userPayload.sub],
    );

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

  async verifyMfaLogin(userId: string, tokenOtp: string, req: Request) {
    const conn = this.getConn(req);
    const t = safeSchema(this.getTenantId(req));

    const rows = await conn.query(
      `SELECT mfa_secret, email, role, mfa_enabled FROM "${t}"."users" WHERE id = $1`,
      [userId]
    );
    const user = rows[0];

    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      throw new UnauthorizedException('MFA non configurata per questo utente');
    }

    const isValid = authenticator.verify({ token: tokenOtp, secret: user.mfa_secret });
    if (!isValid) throw new UnauthorizedException('Codice OTP non valido');

    let realSlug = t;
    if (t !== 'public') {
       const tr = await conn.query(`select slug from public.tenants where schema_name = $1 OR id::text = $1 limit 1`, [t]);
       if(tr[0]) realSlug = tr[0].slug;
    }

    const token = this.signToken(
      userId,
      user.email,
      t,
      realSlug,
      user.role as Role,
      { authStage: 'FULL', mfaRequired: true }
    );

    return { status: 'ok', token };
  }

  private async listActiveTenants(conn: DataSource): Promise<string[]> {
    const rows = await conn.query(
      `select schema_name from public.tenants where is_active = true order by created_at asc`
    );
    return (rows || []).map((r: any) => safeSchema(r.schema_name)).filter((s: string) => s && s !== 'public');
  }

  async register(req: Request, email: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);
    let realSlug = tenantId;
    if (tenantId !== 'public') {
      const tenantRow = await conn.query(`select slug from public.tenants where schema_name = $1 OR id::text = $1 limit 1`, [tenantId]);
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }
    await this.assertTenantActive(conn, tenantId);
    
    const existing = await conn.query(`select id from "${tenantId}"."users" where lower(email) = lower($1) limit 1`, [email]);
    if (existing.length > 0) throw new Error('User already exists');
    
    const countRes = await conn.query(`select count(*)::int as count from "${tenantId}"."users"`);
    const isFirst = (countRes[0]?.count ?? 0) === 0;
    const role: Role = isFirst ? 'admin' : 'user';
    const passwordHash = await bcrypt.hash(password, 10);
    
    const rows = await conn.query(
      `insert into "${tenantId}"."users" (email, password_hash, role) values ($1, $2, $3) returning id, email, created_at, role`,
      [email, passwordHash, role],
    );
    const user = rows[0];
    const token = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);
    return { user: { ...user, tenantId, tenantSlug: realSlug, role: user.role }, token };
  }

  async acceptInvite(req: Request, token: string, password: string) {
    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);
    let realSlug = tenantId;
    if (tenantId !== 'public') {
      const tenantRow = await conn.query(`select slug from public.tenants where schema_name = $1 OR id::text = $1 limit 1`, [tenantId]);
      if (tenantRow[0]?.slug) realSlug = tenantRow[0].slug;
    }
    await this.assertTenantActive(conn, tenantId);
    const invites = await conn.query(
      `select id, email, role, accepted_at, expires_at from "${tenantId}"."invites" where token = $1 limit 1`,
      [token],
    );
    const invite = invites[0];
    if (!invite) throw new Error('Invalid invite token');
    if (invite.accepted_at) throw new Error('Invite already used');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('Invite expired');
    const existingUsers = await conn.query(`select id from "${tenantId}"."users" where lower(email) = lower($1) limit 1`, [invite.email]);
    if (existingUsers.length > 0) throw new Error('User already exists for this email');
    const passwordHash = await bcrypt.hash(password, 10);
    const users = await conn.query(
      `insert into "${tenantId}"."users" (email, password_hash, role) values ($1, $2, $3) returning id, email, created_at, role`,
      [invite.email, passwordHash, invite.role],
    );
    const user = users[0];
    await conn.query(`update "${tenantId}"."invites" set accepted_at = now() where id = $1`, [invite.id]);
    const jwtToken = this.signToken(user.id, user.email, tenantId, realSlug, user.role as Role);
    return { user: { ...user, tenantId, tenantSlug: realSlug }, token: jwtToken };
  }
}