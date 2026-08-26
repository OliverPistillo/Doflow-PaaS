import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { WebSessionService } from './auth/web-session.service';
import { safeSchema } from './common/schema.utils';

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

/**
 * Mutation che iniziano o completano un flusso auth senza usare una sessione
 * browser preesistente come autorità. L'allowlist è intenzionalmente esatta:
 * Origin validation e divieto di browser bearer restano applicati prima di
 * questo controllo.
 */
const SESSION_INDEPENDENT_AUTH_BOOTSTRAPS = new Set([
  'POST /auth/login',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'POST /auth/accept-invite',
  'POST /auth/handoff/exchange',
  'POST /auth/signup-tenant',
]);

function normalizedRequestPath(req: Request) {
  const raw = String((req as any).originalUrl ?? req.url ?? '/');
  const pathname = raw.split(/[?#]/, 1)[0].toLowerCase();
  const withoutApi = pathname === '/api'
    ? '/'
    : pathname.startsWith('/api/')
      ? pathname.slice(4)
      : pathname;
  return withoutApi.length > 1 && withoutApi.endsWith('/')
    ? withoutApi.slice(0, -1)
    : withoutApi;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly webSessions: WebSessionService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  private async currentAccount(authUser: Record<string, any>): Promise<Record<string, any> | null> {
    if (!this.dataSource) return authUser;
    const schema = safeSchema(authUser.tenantId || authUser.tenant_id || 'public', 'AuthMiddleware.currentAccount');
    const id = String(authUser.sub || authUser.id || '');
    if (!id) return null;
    const rows = await this.dataSource.query(
      `SELECT id, email, role, COALESCE(is_active, true) AS is_active
       FROM "${schema}".users
       WHERE id::text = $1
       LIMIT 1`,
      [id],
    );
    const account = rows[0];
    if (!account || account.is_active !== true) return null;
    return {
      ...authUser,
      id: String(account.id),
      sub: String(account.id),
      email: account.email,
      role: String(account.role || 'user').toLowerCase().trim(),
      tenantId: schema,
    };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const isWebRequest = this.webSessions.isBrowserRequest(req);
    const method = String(req.method || 'GET').toUpperCase();
    const isUnsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const path = normalizedRequestPath(req);
    const isSessionIndependentBootstrap = SESSION_INDEPENDENT_AUTH_BOOTSTRAPS.has(`${method} ${path}`);

    if (isWebRequest && authHeader) {
      return res.status(400).json({ error: 'BROWSER_BEARER_FORBIDDEN' });
    }
    if (isWebRequest && isUnsafe) this.webSessions.assertBrowserOrigin(req);

    if (!isWebRequest && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');

        const payload = jwt.verify(token, secret) as Record<string, any>;
        const authStage = String(payload?.authStage ?? 'FULL').toUpperCase();

        // Enforce the MFA boundary before any database lookup. A transient
        // revalidation failure must not let a partial bearer token fall through
        // to Passport and reach a tenant endpoint on a later successful lookup.
        if (MFA_PARTIAL_STAGES.has(authStage)) {
          const requestPath = String((req as any).originalUrl ?? req.url ?? '').toLowerCase();
          const isAllowed = MFA_ALLOWED_PATH_PREFIXES.some((prefix) =>
            requestPath.startsWith(prefix),
          );

          if (!isAllowed) {
            return res.status(403).json({
              error:   'MFA_REQUIRED',
              stage:   authStage,
              message: 'Complete MFA authentication to access this resource.',
            });
          }
        }

        const tokenUser = {
          id:       payload.sub,
          email:    payload.email,
          role:     payload.role,
          tenantId: payload.tenantId,
          ...payload,
        };
        const authUser = await this.currentAccount(tokenUser);
        if (!authUser) return next();

        (req as any).user = authUser;
        (req as any).authUser = authUser;

      } catch {
        // Token invalido o scaduto: non impostiamo req.user.
        // Gli endpoint protetti gestiranno l'assenza del payload.
      }
    } else if (!isSessionIndependentBootstrap) {
      const session = await this.webSessions.resolve(req);
      if (session) {
        let authUser: Record<string, any> | null = null;
        try {
          authUser = await this.currentAccount(session.user);
        } catch {
          authUser = null;
        }
        if (!authUser) {
          await this.webSessions.revoke(req);
          return next();
        }
        (req as any).user = authUser;
        (req as any).authUser = authUser;
        (req as any).webSession = session;

        // Qualsiasi mutation eseguita mentre esiste una sessione cookie richiede
        // il double-submit CSRF, incluse logout, MFA e le route auth protette.
        // I bootstrap esplicitamente allowlisted ignorano invece del tutto una
        // sessione precedente e non entrano in questo ramo.
        if (isUnsafe) this.webSessions.assertCsrf(req, session);

        const stage = String(authUser.authStage || 'FULL').toUpperCase();
        if (MFA_PARTIAL_STAGES.has(stage) && !MFA_ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
          return res.status(403).json({ error: 'MFA_REQUIRED', stage, message: 'Complete MFA authentication to access this resource.' });
        }
      }
    }

    next();
  }
}
