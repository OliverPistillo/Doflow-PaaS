// apps/backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Legge il token dall'header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // DEVE essere la stessa chiave usata in auth.service.ts
      secretOrKey: process.env.JWT_SECRET || 'SECRET_DA_CONFIGURARE', 
    });
  }

  async validate(payload: any) {
    // Questo oggetto viene inserito in req.user
    return { 
        sub: payload.sub, 
        email: payload.email, 
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        authStage: payload.authStage // Fondamentale per MFA
    };
  }
}