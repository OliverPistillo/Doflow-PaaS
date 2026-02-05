// C:\Doflow\apps\backend\src\auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const payload = jwt.verify(token, secret) as any;

          // payload creato in AuthService.login:
          // { sub, email, tenantId, tenantSlug, role, authStage?, mfaRequired?, iat, exp }
          const authUser = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            ...payload,
          };

          // Metti l’utente su entrambe le proprietà, per compatibilità
          (req as any).user = authUser;
          (req as any).authUser = authUser;

          // =========================================================
          // ✅ MFA GATE (enterprise-safe)
          // Se il token è "MFA_PENDING" blocchiamo tutto tranne:
          // - auth endpoints (login, accept-invite, forgot/reset password, me)
          // - endpoint MFA (che aggiungeremo)
          // - health
          // =========================================================
          const authStage = String(payload?.authStage ?? 'FULL').toUpperCase();

          if (authStage === 'MFA_PENDING') {
            const path = String((req as any).originalUrl || req.url || '').toLowerCase();

            const allowWhilePending =
              path.startsWith('/auth/') || // login/accept-invite/forgot/reset/me ecc.
              path.startsWith('/api/auth/') ||
              path.startsWith('/health') ||
              path.startsWith('/api/health') ||
              path.startsWith('/auth/mfa') ||
              path.startsWith('/api/auth/mfa');

            if (!allowWhilePending) {
              return res.status(403).json({
                error: 'MFA_REQUIRED',
                message: 'MFA required to access this resource',
              });
            }
          }
        }
      } catch {
        // Token invalido / scaduto: NON blocchiamo qui,
        // semplicemente non impostiamo req.user
      }
    }

    // in ogni caso proseguiamo: gli endpoint che richiedono auth
    // controlleranno (req as any).user
    next();
  }
}
