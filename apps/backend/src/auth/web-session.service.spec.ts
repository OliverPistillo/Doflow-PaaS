import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { WebSessionService } from './web-session.service';

class FakeRedis {
  values = new Map<string, string>();
  sets = new Map<string, Set<string>>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0;
  }

  getClient() {
    const owner = this;
    return {
      multi() {
        const operations: Array<() => unknown> = [];
        const chain = {
          set(key: string, value: string) {
            operations.push(() => owner.values.set(key, value));
            return chain;
          },
          sadd(key: string, value: string) {
            operations.push(() => {
              const set = owner.sets.get(key) || new Set<string>();
              set.add(value);
              owner.sets.set(key, set);
            });
            return chain;
          },
          expire() {
            return chain;
          },
          del(key: string) {
            operations.push(() => owner.values.delete(key));
            return chain;
          },
          srem(key: string, value: string) {
            operations.push(() => owner.sets.get(key)?.delete(value));
            return chain;
          },
          async exec() {
            operations.forEach((operation) => operation());
            return operations.map(() => [null, 1]);
          },
        };
        return chain;
      },
      async smembers(key: string) {
        return [...(owner.sets.get(key) || new Set<string>())];
      },
      async del(...keys: string[]) {
        let deleted = 0;
        for (const key of keys) {
          if (owner.values.delete(key)) deleted += 1;
          if (owner.sets.delete(key)) deleted += 1;
        }
        return deleted;
      },
    };
  }
}

function response() {
  const cookies = new Map<string, string>();
  const options = new Map<string, Record<string, unknown>>();
  return {
    cookies,
    options,
    value: {
      cookie: jest.fn((name: string, value: string, cookieOptions: Record<string, unknown>) => {
        cookies.set(name, value);
        options.set(name, cookieOptions);
      }),
      clearCookie: jest.fn(),
    },
  };
}

const user = {
  sub: '11111111-1111-4111-8111-111111111111',
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.test',
  role: 'owner',
  tenantId: 'doflow',
  tenantSlug: 'doflow',
  authStage: 'FULL' as const,
};

describe('WebSessionService', () => {
  it('classifica come browser anche Origin o Fetch Metadata senza header proprietario', () => {
    const service = new WebSessionService(new FakeRedis() as any);
    expect(service.isBrowserRequest({ headers: { origin: 'https://app.doflow.it' } } as any)).toBe(true);
    expect(service.isBrowserRequest({ headers: { 'sec-fetch-site': 'same-origin' } } as any)).toBe(true);
    expect(service.isBrowserRequest({ headers: {} } as any)).toBe(false);
  });

  it('crea una sessione opaca, la risolve e valida il double-submit CSRF', async () => {
    const redis = new FakeRedis();
    const service = new WebSessionService(redis as any);
    const res = response();
    await service.create({ headers: {} } as any, res.value as any, user, false);

    const sessionId = res.cookies.get('doflow_session')!;
    const csrf = res.cookies.get('doflow_csrf')!;
    expect(sessionId).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect([...redis.values.keys()][0]).not.toContain(sessionId);
    expect(res.options.get('doflow_session')).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
    expect(res.options.get('doflow_session')).not.toHaveProperty('maxAge');

    const request = {
      headers: {
        cookie: `doflow_session=${sessionId}; doflow_csrf=${csrf}`,
        'x-csrf-token': csrf,
      },
    } as any;
    const stored = await service.resolve(request);
    expect(stored?.user).toMatchObject({ sub: user.sub, tenantSlug: 'doflow' });
    expect(() => service.assertCsrf(request, stored!)).not.toThrow();
    expect(() =>
      service.assertCsrf(
        { headers: { cookie: `doflow_session=${sessionId}` } } as any,
        stored!,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('remember-me persiste solo tramite TTL Redis e Max-Age del cookie', async () => {
    const redis = new FakeRedis();
    const service = new WebSessionService(redis as any);
    const res = response();
    await service.create({ headers: {} } as any, res.value as any, user, true);
    expect(res.options.get('doflow_session')).toMatchObject({ httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1_000 });
    expect(res.options.get('doflow_csrf')).toMatchObject({ httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1_000 });
  });

  it('usa cookie __Host Secure in produzione e un CSRF cookie leggibile senza payload auth', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const service = new WebSessionService(new FakeRedis() as any);
      const res = response();
      await service.create({ headers: {} } as any, res.value as any, user, true);
      expect(res.options.get('__Host-doflow_session')).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
      expect(res.options.get('__Host-doflow_session')).not.toHaveProperty('domain');
      expect(res.options.get('doflow_csrf')).toMatchObject({ httpOnly: false, secure: true });
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it('accetta soltanto origin browser esplicitamente consentite', () => {
    const previousOrigins = process.env.CORS_ORIGINS;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.doflow.it,https://tenant.doflow.it';
    try {
      const service = new WebSessionService(new FakeRedis() as any);
      expect(() => service.assertBrowserOrigin({ headers: { origin: 'https://app.doflow.it' } } as any)).not.toThrow();
      expect(() => service.assertBrowserOrigin({ headers: { origin: 'https://evil.invalid' } } as any))
        .toThrow(ForbiddenException);
      expect(() => service.assertBrowserOrigin({ headers: {} } as any)).toThrow(ForbiddenException);
    } finally {
      if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
      else process.env.CORS_ORIGINS = previousOrigins;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('revoca tutte le sessioni indicizzate per utente dopo un reset password', async () => {
    const redis = new FakeRedis();
    const service = new WebSessionService(redis as any);
    await service.create({ headers: {} } as any, response().value as any, user, true);
    await service.create({ headers: {} } as any, response().value as any, user, true);

    expect(redis.values.size).toBe(2);
    await expect(service.revokeUserSessions('doflow', user.id)).resolves.toBe(2);
    expect(redis.values.size).toBe(0);
  });

  it('risolve una sessione opaca tenant-scoped anche per un tenant non Doflow', async () => {
    const redis = new FakeRedis();
    const service = new WebSessionService(redis as any);
    const res = response();
    const secondaryUser = {
      ...user,
      tenantId: 'acceptance_secondary',
      tenantSlug: 'acceptance-secondary',
    };
    await service.create({ headers: {} } as any, res.value as any, secondaryUser, false);

    const sessionId = res.cookies.get('doflow_session')!;
    const stored = await service.resolve({
      headers: { cookie: `doflow_session=${sessionId}` },
    } as any);

    expect(stored?.user).toMatchObject({
      sub: secondaryUser.sub,
      tenantId: 'acceptance_secondary',
      tenantSlug: 'acceptance-secondary',
    });
  });

  it('supporta il control plane public senza esporre identità nel cookie', async () => {
    const redis = new FakeRedis();
    const service = new WebSessionService(redis as any);
    const res = response();
    const superadmin = { ...user, tenantId: 'public', tenantSlug: 'public', role: 'superadmin' };
    await service.create({ headers: {} } as any, res.value as any, superadmin, true);

    const sessionId = res.cookies.get('doflow_session')!;
    const stored = await service.resolve({ headers: { cookie: `doflow_session=${sessionId}` } } as any);
    expect(stored?.user).toMatchObject({ tenantSlug: 'public', role: 'superadmin' });
    expect(sessionId).not.toContain('public');
    expect(sessionId).not.toContain(superadmin.sub);
  });
});
