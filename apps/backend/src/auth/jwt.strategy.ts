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
      // Accetta il token sia dall'header Authorization (tutte le chiamate API normali)
      // che dal query param ?token= (usato da window.open per i download diretti del browser)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Se il token è valido (firma corretta), Passport entra qui.
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }

    return { 
        sub: payload.sub, 
        email: payload.email, 
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        authStage: payload.authStage // ✅ FONDAMENTALE: Passa lo stato MFA
    };
  }
}