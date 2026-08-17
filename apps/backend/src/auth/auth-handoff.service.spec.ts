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
      token: 'header.payload.signature',
      user,
      tenantTarget: 'acme',
      rememberMe: false,
    });

    expect(created.handoff).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(created.handoff).not.toContain('header.payload.signature');
    expect(created.expiresIn).toBe(AUTH_HANDOFF_TTL_SECONDS);
    expect(redis.lastTtl).toBe(90);

    await expect(service.exchange(created.handoff, 'acme')).resolves.toMatchObject({
      kind: 'login',
      token: 'header.payload.signature',
      tenantTarget: 'acme',
      authStage: 'FULL',
      next: 'dashboard',
      rememberMe: false,
    });
    await expect(service.exchange(created.handoff, 'acme')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lega il codice al tenant e invalida anche un tentativo sul tenant errato', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createLogin({ token: 'jwt', user, tenantTarget: 'acme' });
    await expect(service.exchange(created.handoff, 'other')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchange(created.handoff, 'acme')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rifiuta codici scaduti o casuali', async () => {
    const redis = new FakeRedis();
    const service = new AuthHandoffService(redis as any);
    const created = await service.createLogin({ token: 'jwt', user, tenantTarget: 'acme' });
    redis.values.clear();
    await expect(service.exchange(created.handoff, 'acme')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchange('random-unknown-code-12345678901234567890', 'acme'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forza il passaggio MFA per ogni sessione parziale', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createLogin({
      token: 'jwt',
      user: { ...user, authStage: 'MFA_SETUP_NEEDED' },
      tenantTarget: 'acme',
      next: 'dashboard',
    });
    await expect(service.exchange(created.handoff, 'acme')).resolves.toMatchObject({
      authStage: 'MFA_SETUP_NEEDED',
      next: 'mfa',
    });
  });

  it('rifiuta la creazione cross-tenant', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    await expect(service.createLogin({ token: 'jwt', user, tenantTarget: 'other' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('trasporta il token Google firmato solo nel payload di exchange', async () => {
    const service = new AuthHandoffService(new FakeRedis() as any);
    const created = await service.createGoogleSignup({
      googleSignupToken: 'signed.google.jwt',
      email: 'new@example.test',
      fullName: 'Nuovo Utente',
    });
    expect(created.handoff).not.toContain('signed.google.jwt');
    await expect(service.exchange(created.handoff, 'public')).resolves.toMatchObject({
      kind: 'google_signup',
      googleSignupToken: 'signed.google.jwt',
    });
  });
});
