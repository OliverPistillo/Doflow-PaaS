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
          // { sub, email, tenantId, role, iat, exp }
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
