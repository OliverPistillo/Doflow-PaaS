import { PresenceRegistryService } from './presence-registry.service';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE = 'desktop-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('PresenceRegistryService Desktop sessions', () => {
  it('keeps Desktop presence tenant-, user- and device-scoped with a short TTL', async () => {
    const client = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      mget: jest.fn().mockResolvedValue([JSON.stringify({ userId: USER, status: 'online', source: 'desktop', lastSeenAt: new Date().toISOString() })]),
      scan: jest.fn().mockResolvedValue(['0', [`presence:tenant_a:${USER}:desktop-${DEVICE}`]]),
      del: jest.fn(),
    };
    const service = new PresenceRegistryService(
      { getClient: () => client } as never,
      { broadcastToTenant: jest.fn() } as never,
    );

    await expect(service.desktopHeartbeat('tenant_a', USER, DEVICE)).resolves.toMatchObject({ source: 'desktop', status: 'online' });
    expect(client.set).toHaveBeenCalledWith(
      `presence:tenant_a:${USER}:desktop-${DEVICE}`,
      expect.any(String),
      'EX',
      45,
    );
    await expect(service.hasDesktopSession('tenant_a', USER, DEVICE)).resolves.toBe(true);
    expect(client.mget).toHaveBeenLastCalledWith(`presence:tenant_a:${USER}:desktop-${DEVICE}`);
  });

  it('does not treat ordinary browser presence as a Desktop endpoint', async () => {
    const client = {
      get: jest.fn(),
      set: jest.fn(),
      mget: jest.fn().mockResolvedValue([JSON.stringify({ userId: USER, status: 'online', source: 'ws', lastSeenAt: new Date().toISOString() })]),
      scan: jest.fn().mockResolvedValue(['0', [`presence:tenant_a:${USER}:desktop-any`]]),
      del: jest.fn(),
    };
    const service = new PresenceRegistryService(
      { getClient: () => client } as never,
      { broadcastToTenant: jest.fn() } as never,
    );
    await expect(service.hasDesktopSession('tenant_a', USER)).resolves.toBe(false);
  });

  it('preserves Desktop transport proof when a manual status override is active', async () => {
    let stored = '';
    const client = {
      get: jest.fn().mockResolvedValue(JSON.stringify({ userId: USER, status: 'away', source: 'manual' })),
      set: jest.fn(async (_key: string, value: string) => { stored = value; return 'OK'; }),
      mget: jest.fn(async () => [stored]),
      scan: jest.fn().mockResolvedValue(['0', [`presence:tenant_a:${USER}:desktop-${DEVICE}`]]),
      del: jest.fn(),
    };
    const service = new PresenceRegistryService(
      { getClient: () => client } as never,
      { broadcastToTenant: jest.fn() } as never,
    );
    await expect(service.desktopHeartbeat('tenant_a', USER, DEVICE)).resolves.toMatchObject({
      source: 'desktop',
      status: 'away',
    });
    await expect(service.hasDesktopSession('tenant_a', USER, DEVICE)).resolves.toBe(true);
  });
});
