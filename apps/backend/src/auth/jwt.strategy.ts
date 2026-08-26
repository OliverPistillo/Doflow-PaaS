// apps/backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      // Blocca il boot dell'applicazione se JWT_SECRET non è configurato.
      // Non usare mai un fallback hardcoded: chiunque potrebbe forgiare token validi.
      throw new Error(
        '[JwtStrategy] FATAL: JWT_SECRET is not set. ' +
        'Set it in your .env file or environment before starting the server.',
      );
    }

    super({
      // Compatibilità esclusivamente per consumer API non-browser. Il runtime
      // web usa soltanto la sessione opaca HttpOnly e non accetta token in URL.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Se il token è valido (firma corretta), Passport entra qui.
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }

    const authStage = String(
      payload.authStage || (payload.mfa_pending === true ? 'MFA_PENDING' : 'FULL'),
    ).toUpperCase();
    if (!['FULL', 'MFA_PENDING', 'MFA_SETUP_NEEDED'].includes(authStage)) {
      throw new UnauthorizedException();
    }

    // A signed bearer token is not the current authorization authority: the
    // tenant membership may have been suspended, removed, or assigned a new
    // role after the JWT was issued. Revalidate it on every guarded request so
    // Passport cannot restore stale claims after AuthMiddleware has rejected
    // the account.
    let account: Record<string, any> | undefined;
    let tenantId: string;
    try {
      tenantId = safeSchema(
        payload.tenantId || payload.tenant_id || 'public',
        'JwtStrategy.validate',
      );
      const rows = await this.dataSource.query(
        `SELECT id, email, role, COALESCE(is_active, true) AS is_active
         FROM "${tenantId}".users
         WHERE id::text = $1
         LIMIT 1`,
        [String(payload.sub)],
      );
      account = rows[0];
    } catch {
      // Database/revalidation failures must never fall back to JWT claims.
      throw new UnauthorizedException();
    }
    if (!account || account.is_active !== true) {
      throw new UnauthorizedException();
    }

    return { 
        sub: String(account.id),
        email: account.email,
        role: String(account.role || 'user').toLowerCase().trim(),
        tenantId,
        tenantSlug: payload.tenantSlug,
        authStage,
        mfa_required: payload.mfa_required === true,
    };
  }
}
