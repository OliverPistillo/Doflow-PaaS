import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { RedisService } from '../redis/redis.service';

export type WebSessionUser = {
  sub: string;
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  authStage: 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
  mfa_required?: boolean;
};

type StoredWebSession = {
  version: number;
  user: WebSessionUser;
  csrfToken: string;
  createdAt: string;
  rotatedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  rememberMe: boolean;
  revokedAt: string | null;
  userAgentHash?: string;
  correlationId?: string;
};

const DEV_COOKIE = 'doflow_session';
const PROD_COOKIE = '__Host-doflow_session';
const CSRF_COOKIE = 'doflow_csrf';

@Injectable()
export class WebSessionService {
  constructor(private readonly redis: RedisService) {}

  isBrowserRequest(req: Request) {
    if (String(req.headers['x-doflow-web'] || '') === '1') return true;
    if (String(req.headers.origin || '').trim()) return true;
    return Boolean(
      String(req.headers['sec-fetch-site'] || '').trim() ||
      String(req.headers['sec-fetch-mode'] || '').trim(),
    );
  }

  private get secure() {
    return process.env.NODE_ENV === 'production';
  }

  private get cookieName() {
    return this.secure ? PROD_COOKIE : DEV_COOKIE;
  }

  private ttl(rememberMe: boolean) {
    return rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  }

  private key(sessionId: string) {
    return `doflow:web-session:${createHash('sha256').update(sessionId).digest('hex')}`;
  }

  private userIndexKey(tenantSlug: string, userId: string) {
    const identity = `${tenantSlug.trim().toLowerCase()}:${userId.trim()}`;
    return `doflow:web-session-user:${createHash('sha256').update(identity).digest('hex')}`;
  }

  private cookies(req: Request) {
    return String(req.headers.cookie || '').split(';').reduce<Record<string, string>>((result, part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return result;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try { result[name] = decodeURIComponent(value); } catch { result[name] = value; }
      return result;
    }, {});
  }

  private csrfCookieDomain() {
    const configured = String(process.env.WEB_CSRF_COOKIE_DOMAIN || '').trim().toLowerCase();
    if (!configured) return undefined;
    if (!/^\.?[a-z0-9.-]+$/.test(configured) || configured.includes('localhost')) return undefined;
    return configured.startsWith('.') ? configured : `.${configured}`;
  }

  private requestFingerprint(req: Request) {
    const agent = String(req.headers['user-agent'] || '').trim().slice(0, 512);
    return agent ? createHash('sha256').update(agent).digest('hex') : undefined;
  }

  private setCookies(res: Response, sessionId: string, csrfToken: string, rememberMe: boolean) {
    const maxAge = this.ttl(rememberMe) * 1000;
    res.cookie(this.cookieName, sessionId, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      ...(rememberMe ? { maxAge } : {}),
    });
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      ...(this.csrfCookieDomain() ? { domain: this.csrfCookieDomain() } : {}),
      ...(rememberMe ? { maxAge } : {}),
    });
  }

  async create(req: Request, res: Response, user: WebSessionUser, rememberMe = false) {
    const previous = await this.resolve(req);
    await this.revoke(req);
    const sessionId = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const now = new Date().toISOString();
    const session: StoredWebSession = {
      version: (previous?.version || 0) + 1,
      user,
      csrfToken,
      createdAt: previous?.createdAt || now,
      rotatedAt: now,
      lastSeenAt: now,
      expiresAt: new Date(Date.now() + this.ttl(rememberMe) * 1_000).toISOString(),
      rememberMe,
      revokedAt: null,
      userAgentHash: this.requestFingerprint(req),
      correlationId: String(req.headers['x-correlation-id'] || '').slice(0, 128) || undefined,
    };
    const storageKey = this.key(sessionId);
    const indexKey = this.userIndexKey(user.tenantSlug, user.id);
    await this.redis.getClient().multi()
      .set(storageKey, JSON.stringify(session), 'EX', this.ttl(rememberMe))
      .sadd(indexKey, storageKey)
      .expire(indexKey, 60 * 60 * 24 * 30)
      .exec();
    this.setCookies(res, sessionId, csrfToken, rememberMe);
  }

  async resolve(req: Request): Promise<StoredWebSession | null> {
    const sessionId = this.cookies(req)[this.cookieName];
    if (!sessionId || sessionId.length < 32) return null;
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as StoredWebSession;
      const tenantSlug = String(session?.user?.tenantSlug || '').trim().toLowerCase();
      if (!session?.user?.sub || !/^[a-z0-9_-]+$/.test(tenantSlug)) return null;
      if (session.userAgentHash && this.requestFingerprint(req) !== session.userAgentHash) return null;
      const ttl = this.ttl(session.rememberMe);
      session.lastSeenAt = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + ttl * 1_000).toISOString();
      const updated = JSON.stringify(session);
      const storageKey = this.key(sessionId);
      const indexKey = this.userIndexKey(session.user.tenantSlug, session.user.id);
      await this.redis.getClient().multi()
        .set(storageKey, updated, 'EX', ttl)
        .sadd(indexKey, storageKey)
        .expire(indexKey, 60 * 60 * 24 * 30)
        .exec();
      return session;
    } catch {
      await this.redis.del(this.key(sessionId));
      return null;
    }
  }

  async rotate(req: Request, res: Response, user: WebSessionUser) {
    const previous = await this.resolve(req);
    await this.create(req, res, user, previous?.rememberMe ?? false);
  }

  async revoke(req: Request) {
    const sessionId = this.cookies(req)[this.cookieName];
    if (!sessionId) return;
    const storageKey = this.key(sessionId);
    const raw = await this.redis.get(storageKey);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as StoredWebSession;
      const indexKey = this.userIndexKey(session.user.tenantSlug, session.user.id);
      await this.redis.getClient().multi().del(storageKey).srem(indexKey, storageKey).exec();
    } catch {
      await this.redis.del(storageKey);
    }
  }

  async revokeUserSessions(tenantSlug: string, userId: string) {
    const indexKey = this.userIndexKey(tenantSlug, userId);
    const client = this.redis.getClient();
    const storageKeys = await client.smembers(indexKey);
    if (storageKeys.length === 0) {
      await client.del(indexKey);
      return 0;
    }
    const result = await client.del(...storageKeys, indexKey);
    return Math.max(0, result - 1);
  }

  clear(res: Response) {
    res.clearCookie(this.cookieName, { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/' });
    res.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      ...(this.csrfCookieDomain() ? { domain: this.csrfCookieDomain() } : {}),
    });
  }

  assertCsrf(req: Request, session: StoredWebSession) {
    const supplied = String(req.headers['x-csrf-token'] || '');
    const cookie = this.cookies(req)[CSRF_COOKIE] || '';
    const expected = session.csrfToken;
    if (!supplied || !cookie || supplied.length !== expected.length || cookie.length !== expected.length) {
      throw new UnauthorizedException('Token CSRF non valido');
    }
    const expectedBuffer = Buffer.from(expected);
    if (!timingSafeEqual(Buffer.from(supplied), expectedBuffer) || !timingSafeEqual(Buffer.from(cookie), expectedBuffer)) {
      throw new UnauthorizedException('Token CSRF non valido');
    }
  }

  assertBrowserOrigin(req: Request) {
    const supplied = String(req.headers.origin || '').trim().toLowerCase();
    const allowed = String(process.env.CORS_ORIGINS || 'https://app.doflow.it')
      .split(',')
      .map((value) => {
        try { return new URL(value.trim()).origin.toLowerCase(); } catch { return ''; }
      })
      .filter(Boolean);
    if (process.env.NODE_ENV !== 'production') allowed.push('http://localhost:3100');
    if (!supplied || !new Set(allowed).has(supplied)) {
      throw new ForbiddenException('Origin browser non consentita');
    }
  }
}
