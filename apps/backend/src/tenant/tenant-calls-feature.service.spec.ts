import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { TenantCallsFeatureService } from './tenant-calls-feature.service';

describe('TenantCallsFeatureService rollout authority', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.LIVEKIT_ENABLED = 'true';
    process.env.DESKTOP_CALLS_ENABLED = 'true';
    process.env.DESKTOP_CALLS_GUEST_ENABLED = 'true';
    process.env.LIVEKIT_URL = 'wss://calls.example.test';
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret';
  });

  afterAll(() => { process.env = previous; });

  it('requires an active tenant subscription and never enables browser internal calls', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ enabled: true }]) };
    const service = new TenantCallsFeatureService(dataSource as never);
    await expect(service.availability('tenant_a')).resolves.toMatchObject({
      enabled: true,
      configured: true,
      tenantEnabled: true,
      guestEnabled: true,
      browserInternalCalls: false,
      reason: 'ready',
    });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining("s.\"moduleKey\"='collab.calls'"), ['tenant_a']);
  });

  it('fails closed when the tenant feature is absent', async () => {
    const service = new TenantCallsFeatureService({ query: jest.fn().mockResolvedValue([{ enabled: false }]) } as never);
    await expect(service.requireInternal('tenant_a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports missing provider configuration without preventing application startup', async () => {
    delete process.env.LIVEKIT_API_SECRET;
    const service = new TenantCallsFeatureService({ query: jest.fn().mockResolvedValue([{ enabled: true }]) } as never);
    await expect(service.availability('tenant_a')).resolves.toMatchObject({
      enabled: false,
      configured: false,
      reason: 'provider-unconfigured',
    });
    await expect(service.requireInternal('tenant_a')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
