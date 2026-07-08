import { TenantClientPortalService } from './tenant-client-portal.service';

describe('TenantClientPortalService', () => {
  function service() {
    return new TenantClientPortalService(
      { query: jest.fn() } as any,
      { headers: {}, tenantId: 'doflow' } as any,
    ) as any;
  }

  it('hashes invite tokens without storing the raw token', () => {
    const svc = service();
    const raw = 'plain-invite-token';
    const hashed = svc.hashToken(raw);

    expect(hashed).not.toBe(raw);
    expect(hashed).toHaveLength(64);
    expect(svc.hashToken(raw)).toBe(hashed);
  });

  it('sanitizes projects for client portal responses', () => {
    const svc = service();
    const sanitized = svc.sanitizeProjectForClient({
      id: 'project-id',
      name: 'Sito cliente',
      internal_notes: 'non visibile',
      total_expected: 1000,
      hourly_rate: 80,
      client_notes: 'nota cliente',
      progress: 40,
    });

    expect(sanitized).toMatchObject({
      id: 'project-id',
      name: 'Sito cliente',
      client_notes: 'nota cliente',
      progress: 40,
    });
    expect(sanitized).not.toHaveProperty('internal_notes');
    expect(sanitized).not.toHaveProperty('total_expected');
    expect(sanitized).not.toHaveProperty('hourly_rate');
  });
});
