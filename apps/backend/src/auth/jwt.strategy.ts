// apps/backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
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

    return { 
        sub: payload.sub, 
        email: payload.email, 
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        authStage,
        mfa_required: payload.mfa_required === true,
    };
  }
}
