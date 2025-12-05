import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const path = (req as any).originalUrl || req.url || req.path;

    // Route pubbliche: NEST le vede come /auth..., Nginx può passarle come /api/auth...
    const isPublic =
      path.startsWith('/auth') ||
      path.startsWith('/api/auth') ||
      path.startsWith('/health') ||
      path.startsWith('/api/health') ||
      path.startsWith('/bloom') ||
      path.startsWith('/api/bloom') ||
      path.startsWith('/telemetry') ||
      path.startsWith('/api/telemetry');

    if (isPublic) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.slice(7);

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET missing');
      }

      const payload = jwt.verify(token, secret) as any;
      // { sub, email, tenantId }
      (req as any).authUser = payload;
      return next();
    } catch {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }
}
