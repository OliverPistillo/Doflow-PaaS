import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import { TenantCallsLivekitProviderService } from './tenant-calls-livekit-provider.service';

describe('TenantCallsLivekitProviderService', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.LIVEKIT_URL = 'wss://calls.example.test';
    process.env.LIVEKIT_API_KEY = 'calls-test-key';
    process.env.LIVEKIT_API_SECRET = 'calls-test-secret-with-enough-entropy';
    process.env.LIVEKIT_TOKEN_TTL_SECONDS = '180';
  });

  afterAll(() => { process.env = previous; });

  it('issues a short-lived token scoped to exactly one opaque room', async () => {
    const service = new TenantCallsLivekitProviderService();
    const access = await service.issueToken({
      identity: 'u:opaque-user-hash',
      name: 'Utente Doflow',
      callId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      roomKey: 'df-QPpJkYxDXQp9m0S0fGfG3vV-uACZJjHL',
      kind: 'internal',
      callType: 'video',
    });
    const decoded = await new TokenVerifier(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).verify(access.token);
    expect(access).toMatchObject({ serverUrl: 'wss://calls.example.test', expiresInSeconds: 180 });
    expect(decoded.sub).toBe('u:opaque-user-hash');
    expect(decoded.video).toMatchObject({
      roomJoin: true,
      room: 'df-QPpJkYxDXQp9m0S0fGfG3vV-uACZJjHL',
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    expect(decoded.video?.roomCreate).not.toBe(true);
    expect(decoded.metadata).not.toContain('tenant');
  });

  it('verifies the exact raw webhook body and rejects an invalid signature', async () => {
    const service = new TenantCallsLivekitProviderService();
    const body = JSON.stringify({ event: 'room_started', room: { name: 'df-opaque-room' } });
    const authorization = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
    authorization.sha256 = createHash('sha256').update(body).digest('base64');
    await expect(service.verifyWebhook(Buffer.from(body), await authorization.toJwt()))
      .resolves.toMatchObject({ event: 'room_started', room: { name: 'df-opaque-room' } });
    await expect(service.verifyWebhook(Buffer.from(body), 'invalid.jwt.value'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed without exposing which provider field is missing', async () => {
    delete process.env.LIVEKIT_API_SECRET;
    const service = new TenantCallsLivekitProviderService();
    await expect(service.issueToken({
      identity: 'u:test', name: 'Test', callId: 'id', roomKey: 'room', kind: 'guest', callType: 'audio',
    })).rejects.toMatchObject({ response: expect.objectContaining({ error: 'LIVEKIT_PROVIDER_UNCONFIGURED' }) });
  });
});
