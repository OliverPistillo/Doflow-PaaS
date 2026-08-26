import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import { toDataURL } from 'qrcode';
import { Role } from './roles';
import { safeSchema } from './common/schema.utils';
import { INVITE_TOKEN_DIGEST_PREFIX, storedInviteToken } from './auth/invite-token';
import { isAssignableTenantRole, normalizedTenantRole } from './tenant/tenant-role-policy';
import { isDoflowTenant } from './tenant/tenant-context';
import {
  PENDING_DOFLOW_IDENTITY_METADATA_KEY,
  inspectPendingDoflowIdentityMetadata,
} from './tenant/tenant-doflow-identity-policy';

type JwtPayload = {
  sub: any;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: Role;
  authStage?: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
  mfa_required?: boolean;
};

// safeSchema accetta esplicitamente "public" ma fallisce chiuso su identificatori
// non validi: AuthService usa i tenant nelle query e non deve fare fallback silenziosi.

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
             mfa_enabled, mfa_secret, is_active
      from "${t}"."users"
      where lower(email) = lower($1)
      limit 1
      `,
      [email],
    );

    const user = rows[0];
    if (!user || user.is_active === false || !user.password_hash) {
        this.logger.warn('Login fallito: credenziali non valide');
        throw new UnauthorizedException('Credenziali non valide');
    }

    const ok = await bcrypt.compare(password, user.password_hash as string);
    if (!ok) {
        this.logger.warn('Login fallito: credenziali non valide');
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
      `select tenant_id, role from public.users where lower(email) = lower($1) and is_active = true limit 1`,
      [email]
    );

    if (directoryLookup.length > 0) {
        const userMap = directoryLookup[0];
        
        if (!userMap.tenant_id || userMap.tenant_id === 'public') {
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

    // Remove tenant-scan fallback to prevent timing-based tenant enumeration attacks.
    // If user is not in public.users directory, login fails with generic error.
    throw new UnauthorizedException('Credenziali non valide');
  }

  // =================================================================
  //  MFA METHODS (SETUP & VERIFY)
  // =================================================================

  async generateMfaSetup(req: Request) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();
    const stage = String(user.authStage || 'FULL').toUpperCase();
    if (!['FULL', 'MFA_SETUP_NEEDED'].includes(stage)) {
      throw new ForbiddenException('Stage autenticazione non consentito');
    }

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
    const stage = String(userPayload.authStage || 'FULL').toUpperCase();
    if (!['FULL', 'MFA_SETUP_NEEDED'].includes(stage)) {
      throw new ForbiddenException('Stage autenticazione non consentito');
    }

    const isValid = authenticator.verify({ token: tokenOtp, secret });
    if (!isValid) throw new UnauthorizedException('Codice OTP non valido');

    const conn = this.dataSource;
    const t = safeSchema(userPayload.tenantId);

    const updated = await conn.query(
      `UPDATE "${t}"."users"
       SET mfa_secret = $1, mfa_enabled = true, updated_at = now()
       WHERE id = $2 AND is_active = true
       RETURNING id`,
      [secret, userPayload.sub],
    );
    if (!updated[0]) throw new UnauthorizedException('Account non attivo');

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

  async verifyMfaLogin(
    userPayload: { sub: string; tenantId: string; tenantSlug?: string; authStage?: string },
    tokenOtp: string,
    _req: Request,
  ) {
    if (String(userPayload.authStage || '').toUpperCase() !== 'MFA_PENDING') {
      throw new ForbiddenException('Stage autenticazione non consentito');
    }
    const userId = userPayload.sub;
    const conn = this.dataSource;
    const t = safeSchema(userPayload.tenantId);

    const rows = await conn.query(
      `SELECT mfa_secret, email, role, mfa_enabled, is_active FROM "${t}"."users" WHERE id = $1`,
      [userId]
    );
    const user = rows[0];

    if (!user || user.is_active === false || !user.mfa_enabled || !user.mfa_secret) {
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

  private async resolveInviteTenant(req: Request, tenantRef?: string) {
    const rawRef = String(tenantRef || '').trim().toLowerCase();
    const routedTenant = this.getTenantId(req);
    const lookupRef = rawRef || routedTenant;

    if (lookupRef && lookupRef !== 'public') {
      const rows = await this.dataSource.query(
        `select id::text as id, slug, schema_name
         from public.tenants
         where id::text = $1 or slug = $1 or schema_name = $1
         limit 1`,
        [lookupRef],
      );

      if (rows[0]) {
        return {
          tenantPublicId: rows[0].id as string,
          tenantId: safeSchema(rows[0].schema_name),
          tenantSlug: rows[0].slug as string,
          conn: this.dataSource,
        };
      }
    }

    return {
      tenantPublicId: null as string | null,
      tenantId: routedTenant,
      tenantSlug: routedTenant,
      conn: this.getConn(req),
    };
  }

  async acceptInvite(req: Request, token: string, password: string, tenantRef?: string) {
    const inviteTenant = await this.resolveInviteTenant(req, tenantRef);
    const conn = inviteTenant.conn;
    const tenantId = inviteTenant.tenantId;
    const realSlug = inviteTenant.tenantSlug || tenantId;

    if (tenantId === 'public') {
      throw new BadRequestException('Tenant obbligatorio per accettare un invito');
    }

    await this.assertTenantActive(conn, tenantId);
    const encodedToken = storedInviteToken(token);
    const lookupParams = [encodedToken, token, `${INVITE_TOKEN_DIGEST_PREFIX}%`];
    const loadInvite = async (executor: { query: (sql: string, params?: unknown[]) => Promise<any> }, lock = false) => {
      const rows = await executor.query(
        `select id, email, role, accepted_at, expires_at,
                (token not like $3) as legacy_raw
         from "${tenantId}"."invites"
         where token = $1
            or (token not like $3 and token = $2)
         limit 1${lock ? ' FOR UPDATE' : ''}`,
        lookupParams,
      );
      const candidate = rows[0];
      if (!candidate) throw new BadRequestException('Invito non valido o scaduto');
      if (candidate.accepted_at) throw new ConflictException('Invito già utilizzato');
      if (candidate.expires_at && new Date(candidate.expires_at) < new Date()) {
        throw new BadRequestException('Invito non valido o scaduto');
      }
      candidate.role = normalizedTenantRole(candidate.role);
      if (!isAssignableTenantRole(candidate.role)) {
        throw new BadRequestException('Ruolo invito non consentito');
      }
      return candidate;
    };

    await loadInvite(conn);
    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await conn.transaction(async (manager): Promise<Record<string, any>> => {
      const invite = await loadInvite(manager, true);
      const existingUsers = await manager.query(
        `select id from "${tenantId}"."users" where lower(email) = lower($1) limit 1 FOR UPDATE`,
        [invite.email],
      );
      if (existingUsers.length > 0) throw new ConflictException('Esiste già un account con questa email');

      let pendingMembers = isDoflowTenant(tenantId)
        ? await manager.query(
            `select id, metadata
             from "${tenantId}"."team_members"
             where lower(email) = lower($1)
               and user_id is null
               and deleted_at is null
             limit 1 FOR UPDATE`,
            [invite.email],
          )
        : [];
      if (isDoflowTenant(tenantId) && !pendingMembers[0] && invite.legacy_raw === true) {
        // Gli inviti Doflow emessi dal controller legacy prima del lifecycle Team
        // non avevano necessariamente un team_member. La compatibilita e limitata
        // ai soli token raw storici gia validati e a ruoli allowlisted; i token
        // versionati nuovi restano fail-closed quando il pending e assente.
        const priorTeamMembers = await manager.query(
          `select id
             from "${tenantId}"."team_members"
            where lower(email) = lower($1)
            limit 1 FOR UPDATE`,
          [invite.email],
        );
        if (priorTeamMembers[0]) {
          throw new BadRequestException('Invito legacy associato a un profilo Team non attivo');
        }
        pendingMembers = await manager.query(
          `insert into "${tenantId}"."team_members" (
             email, display_name, tenant_role, operational_role,
             employment_type, status, metadata, created_at, updated_at
           ) values (
             $1, $2, $3, 'generic', 'employee', 'invited', '{}'::jsonb, now(), now()
           )
           returning id, metadata`,
          [invite.email, String(invite.email).split('@')[0] || invite.email, invite.role],
        );
      }
      if (isDoflowTenant(tenantId) && !pendingMembers[0]) {
        throw new BadRequestException('Invito Doflow non associato a un profilo Team pending');
      }
      const pendingIdentity = inspectPendingDoflowIdentityMetadata(pendingMembers[0]?.metadata);
      if (
        pendingIdentity.provided
        && (!pendingIdentity.validShape
          || pendingIdentity.invalidRoles.length > 0
          || pendingIdentity.invalidCapabilities.length > 0)
      ) {
        throw new BadRequestException('Configurazione identity Doflow dell’invito non valida');
      }

      const directoryUsers = await manager.query(
        `select id, tenant_id from public.users where lower(email) = lower($1) limit 1 FOR UPDATE`,
        [invite.email],
      );
      if (directoryUsers[0]) {
        throw new ConflictException('Esiste già un’identità globale con questa email');
      }

      const claimed = await manager.query(
        `update "${tenantId}"."invites"
         set accepted_at = now()
         where id = $1 and accepted_at is null
           and (expires_at is null or expires_at >= now())
         returning id`,
        [invite.id],
      );
      if (!claimed[0]) throw new ConflictException('Invito già utilizzato');

      const users = await manager.query(
        `insert into "${tenantId}"."users" (email, password_hash, role, is_active)
         values ($1, $2, $3, true)
         returning id, email, created_at, role`,
        [invite.email, passwordHash, invite.role],
      );
      const user = users[0] || null;
      if (!user) throw new BadRequestException('Creazione account non riuscita');
      if (pendingIdentity.provided) {
        for (const role of pendingIdentity.value.roles) {
          await manager.query(
            `insert into "${tenantId}".doflow_user_roles (user_id, role)
             values ($1, $2)
             on conflict (user_id, role) do nothing`,
            [user.id, role],
          );
        }
        for (const capability of pendingIdentity.value.capabilities) {
          await manager.query(
            `insert into "${tenantId}".doflow_user_capabilities (user_id, capability)
             values ($1, $2)
             on conflict (user_id, capability) do nothing`,
            [user.id, capability],
          );
        }
      }
      await manager.query(
        `UPDATE "${tenantId}"."team_members"
         SET user_id = $1,
             tenant_role = $2,
             status = 'active',
             metadata = COALESCE(metadata, '{}'::jsonb) - '${PENDING_DOFLOW_IDENTITY_METADATA_KEY}',
             updated_at = now()
         WHERE lower(email) = lower($3)
           AND deleted_at IS NULL`,
        [user.id, invite.role, invite.email],
      );
      if (pendingIdentity.provided) {
        await manager.query(
          `insert into "${tenantId}".audit_log
             (actor_email, actor_role, action, target, metadata, created_at)
           values ($1, $2, 'doflow_invite_identity_applied', $3, $4::jsonb, now())`,
          [
            user.email,
            user.role,
            user.id,
            JSON.stringify({
              role_count: pendingIdentity.value.roles.length,
              explicit_capability_count: pendingIdentity.value.capabilities.length,
            }),
          ],
        );
      }
      await manager.query(
        `insert into public.users
           (id, email, password_hash, role, tenant_id, auth_provider, is_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'password', true, now(), now())`,
        [user.id, user.email, passwordHash, user.role, inviteTenant.tenantPublicId || tenantId],
      );
      return user;
    });

    const jwtToken = this.signToken(createdUser.id, createdUser.email, tenantId, realSlug, createdUser.role as Role);
    return {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        created_at: createdUser.created_at,
        role: createdUser.role,
        tenantId,
        tenantSlug: realSlug,
      },
      token: jwtToken,
    };
  }
}
