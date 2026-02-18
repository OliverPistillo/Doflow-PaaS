import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import { toDataURL } from 'qrcode';
import { Role } from './roles';
import { safeSchema, safeSchemaOrPublic } from './common/schema.utils';

// ─── Tipi ───────────────────────────────────────────────────────────────────

type AuthStage = 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';

type JwtPayload = {
  sub:         string;   // FIX 🟡: era `any`, ora `string` (UUID)
  email:       string;
  tenantId:    string;
  tenantSlug:  string;
  role:        Role;
  authStage?:  AuthStage;
  mfa_required?: boolean;
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {

  constructor(private readonly dataSource: DataSource) {}

  // ── Helpers privati ──────────────────────────────────────────────────────

  private getConn(req: Request): DataSource {
    return ((req as any).tenantConnection as DataSource | undefined) ?? this.dataSource;
  }

  private getTenantSchema(req: Request): string {
    // FIX: safeSchemaOrPublic per il routing — mai lancia eccezione qui
    return safeSchemaOrPublic((req as any).tenantId);
  }

  private async assertTenantActive(conn: DataSource, schema: string) {
    if (schema === 'public') return;
    const rows = await conn.query(
      `SELECT is_active FROM public.tenants WHERE schema_name = $1 LIMIT 1`,
      [schema],
    );
    if (!rows[0] || rows[0].is_active !== true) {
      throw new Error('Tenant disabled');
    }
  }

  // FIX 🟡: signToken privato — signTokenPublic eliminato (anti-pattern con `any`)
  private signToken(
    userId: string,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: {
      authStage?:  AuthStage;
      mfaRequired?: boolean;
      expiresIn?:  jwt.SignOptions['expiresIn'];
    },
  ): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const authStage = opts?.authStage ?? 'FULL';
    const expiresIn = opts?.expiresIn ?? (authStage !== 'FULL' ? '15m' : '1d');

    const payload: JwtPayload = {
      sub:        userId,
      email,
      tenantId,
      tenantSlug,
      role,
      authStage,
      ...(typeof opts?.mfaRequired === 'boolean' ? { mfa_required: opts.mfaRequired } : {}),
    };

    return jwt.sign(payload as any, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
  }

  // Esposto per l'uso in AuthMfaService e AuthPasswordController
  signTokenPublic(
    userId: string,
    email: string,
    tenantId: string,
    tenantSlug: string,
    role: Role,
    opts?: Parameters<AuthService['signToken']>[5],
  ): string {
    return this.signToken(userId, email, tenantId, tenantSlug, role, opts);
  }

  // ── Login ────────────────────────────────────────────────────────────────

  private async loginInTenant(
    conn: DataSource,
    tenantSchema: string,
    email: string,
    password: string,
  ) {
    const t = safeSchema(tenantSchema, 'AuthService.loginInTenant');

    let realSlug = t;
    if (t !== 'public') {
      const row = await conn.query(
        `SELECT slug FROM public.tenants WHERE schema_name = $1 LIMIT 1`,
        [t],
      );
      if (row[0]?.slug) realSlug = row[0].slug;
    }

    await this.assertTenantActive(conn, t);

    const rows = await conn.query(
      `SELECT id, email, password_hash, created_at, role, mfa_enabled, mfa_secret
       FROM "${t}".users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );

    const user = rows[0];
    if (!user?.password_hash) throw new Error('Invalid credentials');

    const ok = await bcrypt.compare(password, user.password_hash as string);
    if (!ok) throw new Error('Invalid credentials');

    const mfaEnabled = !!user.mfa_enabled;
    const hasSecret  = !!user.mfa_secret;

    let authStage: AuthStage = 'FULL';
    if (mfaEnabled) {
      authStage = hasSecret ? 'MFA_PENDING' : 'MFA_SETUP_NEEDED';
    }

    const token = this.signToken(user.id, user.email, t, realSlug, user.role as Role, {
      authStage,
      mfaRequired: mfaEnabled,
    });

    return {
      user: {
        id:         user.id,
        email:      user.email,
        created_at: user.created_at,
        tenantId:   t,
        schema:     t,
        tenantSlug: realSlug,
        role:       user.role,
        mfa_enabled: mfaEnabled,
      },
      token,
      mfa: { required: mfaEnabled, stage: authStage },
    };
  }

  async loginAuto(req: Request, email: string, password: string) {
    const conn          = this.getConn(req);
    const currentSchema = this.getTenantSchema(req);

    // 1. Login diretto su sottodominio specifico
    if (currentSchema !== 'public') {
      return this.loginInTenant(conn, currentSchema, email, password);
    }

    // 2. Smart routing tramite directory globale (public.users)
    const directoryRows = await conn.query(
      `SELECT tenant_id, role FROM public.users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );

    if (directoryRows.length > 0) {
      const userMap = directoryRows[0];

      // Superadmin / owner senza tenant
      if (!userMap.tenant_id || ['superadmin', 'owner'].includes(userMap.role)) {
        return this.loginInTenant(conn, 'public', email, password);
      }

      // Utente tenant: risolviamo schema_name dall'UUID
      const tenantRow = await conn.query(
        `SELECT schema_name FROM public.tenants WHERE id = $1 LIMIT 1`,
        [userMap.tenant_id],
      );
      if (tenantRow.length > 0) {
        return this.loginInTenant(conn, tenantRow[0].schema_name, email, password);
      }
    }

    // FIX 🟠: Fallback brute-force RIMOSSO.
    // Se public.users è sincronizzata correttamente (garantito da TenantsService.create),
    // non serve ciclare su tutti i tenant. Questo era un rischio di timing attack e
    // un collo di bottiglia con molti tenant.
    throw new Error('Invalid credentials');
  }

  // ── MFA ─────────────────────────────────────────────────────────────────

  async generateMfaSetup(req: Request) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();

    const secret      = authenticator.generateSecret();
    const serviceName = `Doflow (${user.tenantSlug || 'App'})`;
    const otpauthUrl  = authenticator.keyuri(user.email, serviceName, secret);
    const qrCodeUrl   = await toDataURL(otpauthUrl);

    return { secret, qrCodeUrl, otpauthUrl };
  }

  async confirmMfaAndEnable(req: Request, tokenOtp: string, secret: string) {
    const userPayload = (req as any).user;
    if (!userPayload) throw new UnauthorizedException();

    const isValid = authenticator.verify({ token: tokenOtp, secret });
    if (!isValid) throw new UnauthorizedException('Codice OTP non valido');

    const conn = this.getConn(req);
    const t    = safeSchema(userPayload.tenantId, 'AuthService.confirmMfa');

    await conn.query(
      `UPDATE "${t}".users SET mfa_secret = $1, mfa_enabled = true WHERE id = $2`,
      [secret, userPayload.sub],
    );

    const token = this.signToken(
      userPayload.sub, userPayload.email, t, userPayload.tenantSlug, userPayload.role,
      { authStage: 'FULL', mfaRequired: true },
    );
    return { status: 'ok', token };
  }

  async verifyMfaLogin(userId: string, tokenOtp: string, req: Request) {
    const conn   = this.getConn(req);
    const schema = this.getTenantSchema(req);
    const t      = safeSchema(schema, 'AuthService.verifyMfaLogin');

    const rows = await conn.query(
      `SELECT mfa_secret, email, role, mfa_enabled FROM "${t}".users WHERE id = $1`,
      [userId],
    );
    const user = rows[0];

    if (!user?.mfa_enabled || !user.mfa_secret) {
      throw new UnauthorizedException('MFA not configured for this user');
    }

    const isValid = authenticator.verify({ token: tokenOtp, secret: user.mfa_secret });
    if (!isValid) throw new UnauthorizedException('Codice non valido');

    let realSlug = t;
    if (t !== 'public') {
      const tr = await conn.query(
        `SELECT slug FROM public.tenants WHERE schema_name = $1`,
        [t],
      );
      if (tr[0]) realSlug = tr[0].slug;
    }

    const token = this.signToken(userId, user.email, t, realSlug, user.role as Role, {
      authStage: 'FULL',
      mfaRequired: true,
    });
    return { status: 'ok', token };
  }

  // ── Register / Accept Invite ─────────────────────────────────────────────

  async register(req: Request, email: string, password: string) {
    const conn     = this.getConn(req);
    const schema   = safeSchema(this.getTenantSchema(req), 'AuthService.register');
    let realSlug   = schema;

    if (schema !== 'public') {
      const row = await conn.query(
        `SELECT slug FROM public.tenants WHERE schema_name = $1 LIMIT 1`,
        [schema],
      );
      if (row[0]?.slug) realSlug = row[0].slug;
    }

    await this.assertTenantActive(conn, schema);

    const existing = await conn.query(
      `SELECT id FROM "${schema}".users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    if (existing.length > 0) throw new Error('User already exists');

    const countRes   = await conn.query(`SELECT count(*)::int AS count FROM "${schema}".users`);
    const isFirst    = (countRes[0]?.count ?? 0) === 0;
    const role: Role = isFirst ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await conn.query(
      `INSERT INTO "${schema}".users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, created_at, role`,
      [email, passwordHash, role],
    );
    const user = rows[0];
    const token = this.signToken(user.id, user.email, schema, realSlug, user.role as Role);
    return { user: { ...user, tenantId: schema, tenantSlug: realSlug }, token };
  }

  async acceptInvite(req: Request, token: string, password: string) {
    const conn   = this.getConn(req);
    const schema = safeSchema(this.getTenantSchema(req), 'AuthService.acceptInvite');
    let realSlug = schema;

    if (schema !== 'public') {
      const row = await conn.query(
        `SELECT slug FROM public.tenants WHERE schema_name = $1 LIMIT 1`,
        [schema],
      );
      if (row[0]?.slug) realSlug = row[0].slug;
    }

    await this.assertTenantActive(conn, schema);

    const invites = await conn.query(
      `SELECT id, email, role, accepted_at, expires_at
       FROM "${schema}".invites
       WHERE token = $1 LIMIT 1`,
      [token],
    );
    const invite = invites[0];
    if (!invite)             throw new Error('Invalid invite token');
    if (invite.accepted_at)  throw new Error('Invite already used');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite expired');
    }

    const alreadyExists = await conn.query(
      `SELECT id FROM "${schema}".users WHERE lower(email) = lower($1) LIMIT 1`,
      [invite.email],
    );
    if (alreadyExists.length > 0) throw new Error('User already exists for this email');

    const passwordHash = await bcrypt.hash(password, 12);
    const users = await conn.query(
      `INSERT INTO "${schema}".users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, created_at, role`,
      [invite.email, passwordHash, invite.role],
    );
    const user = users[0];
    await conn.query(
      `UPDATE "${schema}".invites SET accepted_at = now() WHERE id = $1`,
      [invite.id],
    );

    const jwtToken = this.signToken(user.id, user.email, schema, realSlug, user.role as Role);
    return { user: { ...user, tenantId: schema, tenantSlug: realSlug }, token: jwtToken };
  }
}
