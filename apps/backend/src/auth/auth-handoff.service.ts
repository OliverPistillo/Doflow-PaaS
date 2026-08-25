import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

export const AUTH_HANDOFF_TTL_SECONDS = 90;

type AuthStage = 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
type HandoffNext = 'dashboard' | 'mfa' | 'onboarding' | 'superadmin';

type LoginHandoffRecord = {
  kind: 'login';
  webUser: {
    sub: string;
    id: string;
    email: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
    authStage: AuthStage;
    mfa_required?: boolean;
  };
  subject: string;
  tenantTarget: string;
  authStage: AuthStage;
  next: HandoffNext;
  rememberMe: boolean;
  sourceHost: string;
  destinationHost: string;
  correlationId: string;
};

type GoogleSignupHandoffRecord = {
  kind: 'google_signup';
  tenantTarget: 'public';
  googleId: string;
  email: string;
  fullName?: string;
  picture?: string;
  sourceHost: string;
  destinationHost: string;
  correlationId: string;
};

export type GoogleSignupGrant = {
  googleId: string;
  email: string;
  fullName?: string;
  picture?: string;
};

type HandoffRecord = LoginHandoffRecord | GoogleSignupHandoffRecord;

function normalizeTenant(value: unknown): string {
  const tenant = String(value ?? '').trim().toLowerCase();
  if (!tenant || !/^[a-z0-9_-]+$/.test(tenant)) {
    throw new BadRequestException('Tenant handoff non valido');
  }
  return tenant;
}

function normalizeHost(value: unknown): string {
  const raw = String(value ?? '').split(',')[0].trim().toLowerCase();
  try {
    const host = new URL(raw.includes('://') ? raw : `http://${raw}`).hostname;
    if (host && /^[a-z0-9.-]+$/.test(host)) return host;
  } catch { /* rejected below */ }
  throw new BadRequestException('Host handoff non valido');
}

function destinationHost(tenantTarget: string): string {
  const appBase = new URL(process.env.APP_BASE_URL || 'http://localhost:3000');
  if (['localhost', '127.0.0.1'].includes(appBase.hostname)) return appBase.hostname;
  if (tenantTarget === 'public' || tenantTarget === 'doflow') return appBase.hostname;
  const domain = String(process.env.TENANT_BASE_DOMAIN || 'doflow.it')
    .replace(/^https?:\/\//, '').replace(/^app\./, '').replace(/\/.*$/, '');
  return normalizeHost(`${tenantTarget}.${domain}`);
}

function handoffKey(code: string): string {
  const digest = createHash('sha256').update(code).digest('hex');
  return `df:auth:handoff:${digest}`;
}

function googleSignupGrantKey(code: string): string {
  const digest = createHash('sha256').update(code).digest('hex');
  return `df:auth:google-signup:${digest}`;
}

@Injectable()
export class AuthHandoffService {
  constructor(private readonly redis: RedisService) {}

  async createLogin(input: {
    user: Record<string, unknown>;
    tenantTarget: string;
    rememberMe?: boolean;
    next?: HandoffNext;
    sourceHost?: string;
    correlationId?: string;
  }) {
    const tenantTarget = normalizeTenant(input.tenantTarget);
    const tenantId = normalizeTenant(input.user.tenantId);
    const tenantSlug = normalizeTenant(input.user.tenantSlug ?? input.user.tenantId);
    if (tenantTarget !== tenantId && tenantTarget !== tenantSlug) {
      throw new ForbiddenException('Tenant handoff non consentito');
    }

    const authStage = String(input.user.authStage ?? 'FULL').toUpperCase() as AuthStage;
    if (!['FULL', 'MFA_PENDING', 'MFA_SETUP_NEEDED'].includes(authStage)) {
      throw new ForbiddenException('Stage autenticazione non consentito');
    }

    const role = String(input.user.role ?? '').trim().toLowerCase();
    const next: HandoffNext =
      authStage !== 'FULL'
        ? 'mfa'
        : tenantTarget === 'public' && ['superadmin', 'super_admin'].includes(role)
          ? 'superadmin'
          : input.next === 'onboarding'
            ? 'onboarding'
            : 'dashboard';

    const subject = String(input.user.sub ?? input.user.id ?? '').trim();
    if (!subject) throw new UnauthorizedException('Sessione non valida');

    const webUser = {
      sub: subject,
      id: subject,
      email: String(input.user.email ?? ''),
      role: String(input.user.role ?? ''),
      tenantId,
      tenantSlug,
      authStage,
      mfa_required: input.user.mfa_required === true || input.user.mfaRequired === true,
    };

    return this.store({
      kind: 'login',
      webUser,
      subject,
      tenantTarget,
      authStage,
      next,
      rememberMe: input.rememberMe === true,
      sourceHost: normalizeHost(input.sourceHost || new URL(process.env.APP_BASE_URL || 'http://localhost:3000').hostname),
      destinationHost: destinationHost(tenantTarget),
      correlationId: String(input.correlationId || randomBytes(16).toString('hex')).slice(0, 128),
    });
  }

  async createGoogleSignup(input: {
    googleId: string;
    email: string;
    fullName?: string;
    picture?: string;
    sourceHost?: string;
    correlationId?: string;
  }) {
    if (!input.googleId || !input.email) {
      throw new BadRequestException('Google signup handoff non valido');
    }

    return this.store({
      kind: 'google_signup',
      tenantTarget: 'public',
      googleId: input.googleId,
      email: input.email,
      fullName: input.fullName,
      picture: input.picture,
      sourceHost: normalizeHost(input.sourceHost || new URL(process.env.APP_BASE_URL || 'http://localhost:3000').hostname),
      destinationHost: destinationHost('public'),
      correlationId: String(input.correlationId || randomBytes(16).toString('hex')).slice(0, 128),
    });
  }

  async exchange(codeInput: unknown, tenantInput: unknown, destinationHostInput: unknown) {
    const code = String(codeInput ?? '').trim();
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
      throw new BadRequestException('Codice handoff non valido');
    }
    const tenantTarget = normalizeTenant(tenantInput);
    const key = handoffKey(code);
    const result = await this.redis.getClient().multi().get(key).del(key).exec();
    const raw = result?.[0]?.[1];
    if (typeof raw !== 'string') {
      throw new UnauthorizedException('Handoff scaduto o già utilizzato');
    }

    let record: HandoffRecord;
    try {
      record = JSON.parse(raw) as HandoffRecord;
    } catch {
      throw new UnauthorizedException('Handoff non valido');
    }

    if (record.tenantTarget !== tenantTarget) {
      throw new UnauthorizedException('Handoff non valido per questo tenant');
    }
    if (record.destinationHost !== normalizeHost(destinationHostInput)) {
      throw new UnauthorizedException('Handoff non valido per questo host');
    }

    if (record.kind === 'google_signup') {
      const signupGrant = randomBytes(32).toString('base64url');
      const grant: GoogleSignupGrant = {
        googleId: record.googleId,
        email: record.email,
        fullName: record.fullName,
        picture: record.picture,
      };
      await this.redis.set(
        googleSignupGrantKey(signupGrant),
        JSON.stringify(grant),
        AUTH_HANDOFF_TTL_SECONDS,
      );
      return {
        kind: record.kind,
        signupGrant,
        email: record.email,
        fullName: record.fullName,
      };
    }

    return {
      kind: record.kind,
      tenantTarget: record.tenantTarget,
      authStage: record.authStage,
      next: record.next,
      rememberMe: record.rememberMe,
      webUser: record.webUser,
    };
  }

  async consumeGoogleSignupGrant(input: unknown): Promise<GoogleSignupGrant | null> {
    const grant = String(input ?? '').trim();
    if (!grant) return null;
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(grant)) {
      throw new BadRequestException('Sessione Google non valida o scaduta.');
    }
    const key = googleSignupGrantKey(grant);
    const result = await this.redis.getClient().multi().get(key).del(key).exec();
    const raw = result?.[0]?.[1];
    if (typeof raw !== 'string') {
      throw new BadRequestException('Sessione Google non valida o scaduta.');
    }
    try {
      const parsed = JSON.parse(raw) as GoogleSignupGrant;
      if (!parsed.googleId || !parsed.email) throw new Error('invalid grant');
      return { ...parsed, email: parsed.email.toLowerCase() };
    } catch {
      throw new BadRequestException('Sessione Google non valida o scaduta.');
    }
  }

  private async store(record: HandoffRecord) {
    const code = randomBytes(32).toString('base64url');
    await this.redis.set(handoffKey(code), JSON.stringify(record), AUTH_HANDOFF_TTL_SECONDS);
    return { handoff: code, expiresIn: AUTH_HANDOFF_TTL_SECONDS };
  }
}
