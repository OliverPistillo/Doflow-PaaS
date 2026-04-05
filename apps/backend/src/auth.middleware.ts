import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Path consentiti quando il JWT è in stato MFA parziale.
 * NOTA: include sia MFA_PENDING (utente ha già il secret, deve inserire OTP)
 *        sia MFA_SETUP_NEEDED (utente non ha ancora il secret, deve scansionare QR)
 */
const MFA_PARTIAL_STAGES = new Set(['MFA_PENDING', 'MFA_SETUP_NEEDED']);

const MFA_ALLOWED_PATH_PREFIXES = [
  '/auth/',
  '/api/auth/',
  '/health',
  '/api/health',
] as const;

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');

        const payload = jwt.verify(token, secret) as Record<string, any>;

        const authUser = {
          id:       payload.sub,
          email:    payload.email,
          role:     payload.role,
          tenantId: payload.tenantId,
          ...payload,
        };

        (req as any).user     = authUser;
        (req as any).authUser = authUser;

        // ── MFA Gate ──────────────────────────────────────────────────────────
        // FIX 🟠: Gate attivo sia per MFA_PENDING che per MFA_SETUP_NEEDED.
        // In precedenza MFA_SETUP_NEEDED non era bloccato → bypass del flusso MFA.
        const authStage = String(payload?.authStage ?? 'FULL').toUpperCase();

        if (MFA_PARTIAL_STAGES.has(authStage)) {
          const path = String((req as any).originalUrl ?? req.url ?? '').toLowerCase();

          const isAllowed = MFA_ALLOWED_PATH_PREFIXES.some((prefix) =>
            path.startsWith(prefix),
          );

          if (!isAllowed) {
            return res.status(403).json({
              error:   'MFA_REQUIRED',
              stage:   authStage,
              message: 'Complete MFA authentication to access this resource.',
            });
          }
        }
        // ── Fine MFA Gate ─────────────────────────────────────────────────────

      } catch {
        // Token invalido o scaduto: non impostiamo req.user.
        // Gli endpoint protetti gestiranno l'assenza del payload.
      }
    }

    next();
  }
}
