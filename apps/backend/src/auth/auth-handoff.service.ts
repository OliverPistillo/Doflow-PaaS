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
  token: string;
  subject: string;
  tenantTarget: string;
  authStage: AuthStage;
  next: HandoffNext;
  rememberMe: boolean;
};

type GoogleSignupHandoffRecord = {
  kind: 'google_signup';
  googleSignupToken: string;
  tenantTarget: 'public';
  email: string;
  fullName?: string;
};

type HandoffRecord = LoginHandoffRecord | GoogleSignupHandoffRecord;

function normalizeTenant(value: unknown): string {
  const tenant = String(value ?? '').trim().toLowerCase();
  if (!tenant || !/^[a-z0-9_-]+$/.test(tenant)) {
    throw new BadRequestException('Tenant handoff non valido');
  }
  return tenant;
}

function handoffKey(code: string): string {
  const digest = createHash('sha256').update(code).digest('hex');
  return `df:auth:handoff:${digest}`;
}

@Injectable()
export class AuthHandoffService {
  constructor(private readonly redis: RedisService) {}

  async createLogin(input: {
    token: string;
    user: Record<string, unknown>;
    tenantTarget: string;
    rememberMe?: boolean;
    next?: HandoffNext;
  }) {
    if (!input.token) throw new UnauthorizedException('Sessione non valida');

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

    return this.store({
      kind: 'login',
      token: input.token,
      subject,
      tenantTarget,
      authStage,
      next,
      rememberMe: input.rememberMe === true,
    });
  }

  async createGoogleSignup(input: {
    googleSignupToken: string;
    email: string;
    fullName?: string;
  }) {
    if (!input.googleSignupToken || !input.email) {
      throw new BadRequestException('Google signup handoff non valido');
    }

    return this.store({
      kind: 'google_signup',
      googleSignupToken: input.googleSignupToken,
      tenantTarget: 'public',
      email: input.email,
      fullName: input.fullName,
    });
  }

  async exchange(codeInput: unknown, tenantInput: unknown) {
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

    if (record.kind === 'google_signup') {
      return {
        kind: record.kind,
        googleSignupToken: record.googleSignupToken,
        email: record.email,
        fullName: record.fullName,
      };
    }

    return {
      kind: record.kind,
      token: record.token,
      tenantTarget: record.tenantTarget,
      authStage: record.authStage,
      next: record.next,
      rememberMe: record.rememberMe,
    };
  }

  private async store(record: HandoffRecord) {
    const code = randomBytes(32).toString('base64url');
    await this.redis.set(handoffKey(code), JSON.stringify(record), AUTH_HANDOFF_TTL_SECONDS);
    return { handoff: code, expiresIn: AUTH_HANDOFF_TTL_SECONDS };
  }
}
