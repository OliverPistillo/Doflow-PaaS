// apps/backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // Legge il token dall'header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'SECRET_DA_CONFIGURARE',
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