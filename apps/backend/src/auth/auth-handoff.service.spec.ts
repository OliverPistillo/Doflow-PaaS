import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AUTH_HANDOFF_TTL_SECONDS, AuthHandoffService } from './auth-handoff.service';

class FakeRedis {
  readonly values = new Map<string, string>();
  lastTtl?: number;

  async set(key: string, value: string, ttl?: number) {
    this.values.set(key, value);
    this.lastTtl = ttl;
  }

  getClient() {
    const values = this.values;
    let key = '';
    return {
      multi() {
        return {
          get(input: string) { key = input; return this; },
          del() { return this; },
          async exec() {
            const value = values.get(key) ?? null;
            values.delete(key);
            return [[null, value], [null, value ? 1 : 0]];
          },
        };
      },
    };
  }
}

describe('AuthHandoffService', () => {
  const user = {
    sub: 'user-1',
    tenantId: 'tenant_acme',
    tenantSlug: 'acme',
    role: 'owner',
    authStage: 'FULL',
  };

  it('crea un codice opaco con TTL breve e lo consuma una sola volta', async () => {
    const redis = new FakeRedis();
    const service = new AuthHandoffService(redis as any);
    const created = await service.createLogin({
      user,
      tenantTarget: 'acme',
      rememberMe: false,
    });

    expect(created.handoff).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(created.expiresIn).toBe(AUTH_HANDOFF_TTL_SECONDS);
    expect(redis.lastTtl).toBe(90);

    await expect(service.exchange(created.handoff, 'acme', 'localhost')).resolves.toMatchObject({
      kind: 'login',
      tenantTarget: 'acme',
      authStage: 'FULL',
      next: 'dashboard',
      rememberMe: false,
    });
    await expect(service.exchange(created.handoff, 'acme', 'localhost')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lega il codice al tenant e invalida anche un tentativo sul tenant errato', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createLogin({ user, tenantTarget: 'acme' });
    await expect(service.exchange(created.handoff, 'other', 'localhost')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchange(created.handoff, 'acme', 'localhost')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rifiuta codici scaduti o casuali', async () => {
    const redis = new FakeRedis();
    const service = new AuthHandoffService(redis as any);
    const created = await service.createLogin({ user, tenantTarget: 'acme' });
    redis.values.clear();
    await expect(service.exchange(created.handoff, 'acme', 'localhost')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchange('random-unknown-code-12345678901234567890', 'acme', 'localhost'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forza il passaggio MFA per ogni sessione parziale', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createLogin({
      user: { ...user, authStage: 'MFA_SETUP_NEEDED' },
      tenantTarget: 'acme',
      next: 'dashboard',
    });
    await expect(service.exchange(created.handoff, 'acme', 'localhost')).resolves.toMatchObject({
      authStage: 'MFA_SETUP_NEEDED',
      next: 'mfa',
    });
  });

  it('rifiuta la creazione cross-tenant', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    await expect(service.createLogin({ user, tenantTarget: 'other' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lega il codice all host di destinazione e invalida il replay sul host corretto', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createLogin({ user, tenantTarget: 'acme' });
    await expect(service.exchange(created.handoff, 'acme', 'evil.invalid'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchange(created.handoff, 'acme', 'localhost'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('scambia il profilo Google con un grant opaco, breve e single-use', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createGoogleSignup({
      googleId: 'google-user-1',
      email: 'new@example.test',
      fullName: 'Nuovo Utente',
    });
    const exchange = await service.exchange(created.handoff, 'public', 'localhost');
    expect(exchange).toMatchObject({
      kind: 'google_signup',
      email: 'new@example.test',
    });
    expect((exchange as any).signupGrant).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    await expect(service.consumeGoogleSignupGrant((exchange as any).signupGrant)).resolves.toMatchObject({
      googleId: 'google-user-1',
      email: 'new@example.test',
    });
    await expect(service.consumeGoogleSignupGrant((exchange as any).signupGrant)).rejects.toBeDefined();
  });
});
