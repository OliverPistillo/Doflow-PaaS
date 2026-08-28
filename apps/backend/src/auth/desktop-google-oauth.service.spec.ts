import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  DESKTOP_GOOGLE_FLOW_TTL_SECONDS,
  DesktopGoogleOAuthService,
} from './desktop-google-oauth.service';

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

describe('DesktopGoogleOAuthService', () => {
  it('crea state server-side a TTL breve e single-use', async () => {
    const redis = new FakeRedis();
    const service = new DesktopGoogleOAuthService(redis as any);
    const created = await service.create({ nativeState: 'n'.repeat(43), callbackPort: 49152 });
    expect(created.googleState).toMatch(/^doflow-desktop-v1\.[A-Za-z0-9_-]{32,128}$/);
    expect(redis.lastTtl).toBe(DESKTOP_GOOGLE_FLOW_TTL_SECONDS);
    await expect(service.consumeGoogleState(created.googleState)).resolves.toMatchObject({
      version: 1,
      nativeState: 'n'.repeat(43),
      callbackPort: 49152,
    });
    await expect(service.consumeGoogleState(created.googleState)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([0, 80, 65536, 'not-a-port'])('rifiuta callback port non valida %s', async (callbackPort) => {
    const service = new DesktopGoogleOAuthService(new FakeRedis() as any);
    await expect(service.create({ nativeState: 'n'.repeat(43), callbackPort }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('costruisce soltanto callback loopback fissa e non accetta URL arbitrari', async () => {
    const service = new DesktopGoogleOAuthService(new FakeRedis() as any);
    const flow = { version: 1 as const, nativeState: 'n'.repeat(43), callbackPort: 49152, createdAt: new Date().toISOString() };
    const url = new URL(service.callbackUrl(flow, { handoff: 'h'.repeat(43), tenant: 'doflow', kind: 'login' }));
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.protocol).toBe('http:');
    expect(url.pathname).toBe('/doflow/oauth/callback');
    expect(url.searchParams.has('accessToken')).toBe(false);
  });

  it('rifiuta state mancanti, malformati e scaduti', async () => {
    const service = new DesktopGoogleOAuthService(new FakeRedis() as any);
    await expect(service.consumeGoogleState('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.consumeGoogleState('doflow-desktop-v1.short')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.consumeGoogleState(`doflow-desktop-v1.${'x'.repeat(43)}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
