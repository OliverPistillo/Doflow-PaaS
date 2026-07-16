import { BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { TenantCredentialsCryptoService } from './tenant-credentials-crypto.service';
import { TenantCredentialsPermissionsService } from './tenant-credentials-permissions.service';
import { TenantCredentialsSchedulerService } from './tenant-credentials-scheduler.service';
import { TenantCredentialsService } from './tenant-credentials.service';
import { CREDENTIAL_MODULE_PERMISSION_KEYS, redactCredentialSensitive } from './tenant-credentials.types';
import { TenantDashboardService } from './tenant-dashboard.service';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'tenant_a' };
const USER = { sub: '22222222-2222-4222-8222-222222222222', role: 'user', tenantId: 'tenant_a' };

describe('TenantCredentialsService validation/plaintext/rate-limit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION = 'v1';
    process.env.DOFLOW_CREDENTIALS_KEK_V1 = Buffer.alloc(32, 19).toString('base64');
    TenantCredentialsService.resetRevealRateLimitForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeService(user = OWNER) {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantCredentialsService(
      { query } as any,
      new TenantCredentialsCryptoService(),
      { isAdmin: jest.fn(() => user.role === 'owner'), assertCanCreate: jest.fn(), assertCanReadItem: jest.fn(), assertCanEditItem: jest.fn(), assertCanRevealItem: jest.fn(), assertCanManagePermissions: jest.fn(), canUseModule: jest.fn().mockResolvedValue(true) } as any,
      { user, headers: {} },
    ) as any;
    return { service, query };
  }

  it('rifiuta secret payload extra e limiti di recovery/custom/private notes', () => {
    const { service } = makeService();
    expect(() => service.validateSecretPayload({ password: 'ok', webhook: 'no' })).toThrow(BadRequestException);
    expect(() => service.validateSecretPayload({ recoveryCodes: new Array(51).fill('x') })).toThrow(BadRequestException);
    expect(() => service.validateSecretPayload({ customFields: new Array(51).fill({ label: 'x', value: 'y' }) })).toThrow(BadRequestException);
    expect(() => service.validateSecretPayload({ customFields: [{ label: 'x'.repeat(121), value: 'y' }] })).toThrow(BadRequestException);
    expect(() => service.validateSecretPayload({ customFields: [{ label: 'x', value: 'y'.repeat(10001) }] })).toThrow(BadRequestException);
    expect(() => service.validateSecretPayload({ privateNotes: 'x'.repeat(10001) })).toThrow(BadRequestException);
  });

  it('rifiuta metadata con chiavi sensibili, URL invalida, enum e sort non allowlisted', async () => {
    const { service } = makeService();
    expect(() => service.validateItemInput({ title: 'A', kind: 'hosting', metadata: { nested: { password: 'secret' } } }, true)).toThrow(BadRequestException);
    expect(() => service.validateItemInput({ title: 'A', kind: 'hosting', login_url: 'ftp://example.com' }, true)).toThrow(BadRequestException);
    expect(() => service.validateItemInput({ title: 'A', kind: 'not_allowed' }, true)).toThrow(BadRequestException);
    await expect(service.list({ sort: 'encrypted_payload' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limita reveal a 10/minuto per tenant+utente con 429 e separa utente/tenant', () => {
    const { service } = makeService(USER);
    const authUser = { id: USER.sub, role: USER.role };
    for (let i = 0; i < 10; i += 1) expect(() => service.checkRevealRate(authUser)).not.toThrow();
    try {
      service.checkRevealRate(authUser);
      throw new Error('expected rate limit');
    } catch (err: any) {
      expect(err.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }

    const otherUser = makeService({ ...USER, sub: '33333333-3333-4333-8333-333333333333' }).service;
    expect(() => otherUser.checkRevealRate({ id: '33333333-3333-4333-8333-333333333333', role: 'user' })).not.toThrow();

    const otherTenant = makeService({ ...USER, tenantId: 'tenant_b' }).service;
    expect(() => otherTenant.checkRevealRate({ id: USER.sub, role: 'user' })).not.toThrow();

    const buckets = (TenantCredentialsService as any).revealBuckets;
    for (const entry of buckets.values()) entry.resetAt = Date.now() - 1;
    expect(() => service.checkRevealRate(authUser)).not.toThrow();
  });

  it('dashboard contiene soltanto conteggi aggregati', async () => {
    const { service, query } = makeService();
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    query.mockResolvedValueOnce([{
      totalCredentials: 1,
      activeCredentials: 1,
      archivedCredentials: 0,
      expiringCredentials: 0,
      renewalsDue: 0,
      rotationDue: 0,
      expiredCredentials: 0,
    }]);

    const result = await service.dashboard();

    expect(result).toEqual({
      totalCredentials: 1,
      activeCredentials: 1,
      archivedCredentials: 0,
      expiringCredentials: 0,
      renewalsDue: 0,
      rotationDue: 0,
      expiredCredentials: 0,
    });
    expect(JSON.stringify(result)).not.toMatch(/title|provider|domain_name|metadata|recentCredentials|credential_item_id/i);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('create metadata-only rilegge e restituisce un id UUID valido senza get(undefined)', async () => {
    const createdId = '13be3fc9-0186-4ae5-975e-8b85b4c56d05';
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO "tenant_a".credential_items')) return [{ id: createdId }];
        return [];
      }),
    };
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      expect(params).not.toContain(undefined);
      if (sql.includes('WHERE ci.id = $1')) {
        expect(params[0]).toBe(createdId);
        return [{ id: createdId, title: 'Vault', kind: 'hosting', environment: 'production', status: 'active', access_scope: 'restricted' }];
      }
      return [];
    });
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query } as any,
      new TenantCredentialsCryptoService(),
      { assertCanCreate: jest.fn(), assertCanReadItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);

    const result = await service.create({ title: 'Vault', kind: 'hosting' });

    expect(result.id).toBe(createdId);
    expect(JSON.stringify(result)).not.toContain('password');
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('create con secret restituisce id valido e non contiene il secret', async () => {
    const createdId = 'd71b7039-30ea-498c-bd2a-06644a9c3ce2';
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO "tenant_a".credential_items')) return [{ id: createdId }];
        return [];
      }),
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('WHERE ci.id = $1')) {
        return [{ id: createdId, title: 'Vault', kind: 'hosting', environment: 'production', status: 'active', access_scope: 'restricted', has_secret: true, secret_version: 1 }];
      }
      return [];
    });
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query } as any,
      new TenantCredentialsCryptoService(),
      { assertCanCreate: jest.fn(), assertCanReadItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);

    const result = await service.create({ title: 'Vault', kind: 'hosting', secret: { username: 'valid-user', password: 'valid-password' } });

    expect(result.id).toBe(createdId);
    expect(result.has_secret).toBe(true);
    expect(JSON.stringify(result)).not.toContain('valid-password');
    expect(JSON.stringify(runner.query.mock.calls)).not.toContain('valid-password');
  });

  it('detail/delete/restore/reveal/rotate accettano UUID v4 reali nei parametri', async () => {
    const validId = '13be3fc9-0186-4ae5-975e-8b85b4c56d05';
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('WHERE ci.id = $1')) {
        return [{ id: validId, title: 'Vault', kind: 'hosting', environment: 'production', status: 'active', access_scope: 'restricted' }];
      }
      if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [{ secret_version: 1 }];
      if (sql.includes('UPDATE "tenant_a".credential_items') && sql.includes('RETURNING last_rotated_at')) return [{ last_rotated_at: '2026-07-16T08:00:00.000Z', rotation_due_at: null }];
      return [];
    });
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query,
    };
    const service = new TenantCredentialsService(
      { query, createQueryRunner: () => runner } as any,
      new TenantCredentialsCryptoService(),
      { assertCanReadItem: jest.fn(), assertCanEditItem: jest.fn(), assertCanRevealItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);

    await expect(service.get(validId)).resolves.toMatchObject({ id: validId });
    await expect(service.archive(validId)).resolves.toEqual({ ok: true });
    await expect(service.restore(validId)).resolves.toMatchObject({ id: validId });
    await expect(service.reveal(validId, { reason: 'Accesso operativo autorizzato' })).rejects.not.toMatchObject({ response: { message: 'credential_id non valido' } });
    await expect(service.rotate(validId, { reason: 'Rotazione operativa autorizzata', secret: { password: 'new-password' } })).resolves.toMatchObject({ ok: true, secret_version: 2 });
  });

  it('operations.credentialsSummary contiene soltanto conteggi aggregati', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)::int AS "totalCredentials"')) {
        return [{ totalCredentials: 1, activeCredentials: 1, expiringCredentials: 0, renewalsDue: 0, rotationDue: 0, expiredCredentials: 0 }];
      }
      return [];
    });
    const service = new TenantDashboardService(
      { query } as any,
      { getCurrentAccess: jest.fn() } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' } },
    ) as any;
    jest.spyOn(service, 'tableExists').mockResolvedValue(true);

    const result = await service.buildCredentialsSummary('tenant_a', { id: OWNER.sub, role: 'owner' });

    expect(result).toEqual({
      totalCredentials: 1,
      activeCredentials: 1,
      expiringCredentials: 0,
      renewalsDue: 0,
      rotationDue: 0,
      expiredCredentials: 0,
      sources: { credential_items: true },
    });
    expect(JSON.stringify(result)).not.toMatch(/title|provider|domain_name|metadata|recentCredentials|credential_item_id/i);
  });

  it('non passa plaintext nelle query credential_secrets', async () => {
    const { service } = makeService();
    const calls: any[][] = [];
    const runner = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        calls.push([sql, params]);
        if (sql.includes('SELECT secret_version')) return [{ secret_version: 1 }];
        return [];
      }),
    };
    await service.upsertSecret(runner, 'tenant_a', '44444444-4444-4444-8444-444444444444', {
      username: 'plain-user',
      password: 'plain-password',
      apiKey: 'plain-api',
      token: 'plain-token',
      privateNotes: 'plain-notes',
      recoveryCodes: ['plain-recovery'],
    }, 2, { id: OWNER.sub, role: 'owner' }, true);

    const serialized = JSON.stringify(calls);
    for (const value of ['plain-user', 'plain-password', 'plain-api', 'plain-token', 'plain-notes', 'plain-recovery']) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toContain('credential_rotation_history');
  });

  it('rollback se la creazione item+secret fallisce durante insert secret', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO "tenant_a".credential_items')) return [{ id: '4f52eac3-aee6-4d27-ab51-48632ca2df2a' }];
        if (sql.includes('INSERT INTO "tenant_a".credential_secrets')) throw new Error('secret insert failed');
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanCreate: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);

    await expect(service.create({ title: 'Vault', kind: 'hosting', secret: { password: 'rollback-secret' } })).rejects.toThrow('secret insert failed');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('replace di segreto esistente senza reason restituisce 400', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [{ secret_version: 1 }];
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanEditItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));

    await expect(service.replaceSecret('11111111-1111-4111-8111-111111111111', { secret: { password: 'new-secret' } })).rejects.toBeInstanceOf(BadRequestException);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('creazione primo segreto senza reason puo funzionare', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [];
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanEditItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));

    await expect(service.replaceSecret('11111111-1111-4111-8111-111111111111', { secret: { password: 'first-secret' } })).resolves.toMatchObject({ ok: true, secret_version: 1 });
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('rotate valida reason obbligatoria e vieta pattern sensibili', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));
    await expect(service.rotate('id', { secret: { password: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rotate('id', { reason: 'abcd', secret: { password: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rotate('id', { reason: 'password=supersecret', secret: { password: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rotate('id', { reason: 'Bearer abcdefghijklmnopqrstuvwxyz', secret: { password: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reveal con reason JWT viene rifiutato e audita valore neutro', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantCredentialsService(
      { query } as any,
      new TenantCredentialsCryptoService(),
      { assertCanRevealItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';

    await expect(service.reveal('id', { reason: jwt })).rejects.toBeInstanceOf(BadRequestException);

    const serialized = JSON.stringify(query.mock.calls);
    expect(serialized).toContain('Motivo rifiutato dalla validazione');
    expect(serialized).not.toContain(jwt);
  });

  it('rotate aggiorna versioni, date, history e non restituisce segreto', async () => {
    const calls: any[][] = [];
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string, params: any[] = []) => {
        calls.push([sql, params]);
        if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [{ secret_version: 1 }];
        if (sql.includes('UPDATE "tenant_a".credential_items')) return [{ last_rotated_at: '2026-07-16T08:00:00.000Z', rotation_due_at: '2026-12-01T00:00:00.000Z' }];
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanEditItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));

    const result = await service.rotate('id', {
      secret: { password: 'rotated-secret', token: 'rotated-token' },
      reason: 'Rotazione trimestrale operativa',
      next_rotation_due_at: '2026-12-01T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true, secret_version: 2, last_rotated_at: '2026-07-16T08:00:00.000Z', rotation_due_at: '2026-12-01T00:00:00.000Z' });
    const serialized = JSON.stringify(calls);
    expect(serialized).toContain('credential_rotation_history');
    expect(serialized).toContain('Rotazione trimestrale operativa');
    expect(serialized).toContain('2026-12-01T00:00:00.000Z');
    expect(serialized).not.toContain('rotated-secret');
    expect(serialized).not.toContain('rotated-token');
    expect(JSON.stringify(result)).not.toContain('rotated-secret');
  });

  it('rollback se rotation history fallisce durante rotate', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [{ secret_version: 1 }];
        if (sql.includes('SELECT secret_version')) return [{ secret_version: 1 }];
        if (sql.includes('UPDATE "tenant_a".credential_secrets')) return [];
        if (sql.includes('UPDATE "tenant_a".credential_items')) return [{ last_rotated_at: '2026-07-16T08:00:00.000Z', rotation_due_at: null }];
        if (sql.includes('INSERT INTO "tenant_a".credential_rotation_history')) throw new Error('rotation history failed');
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanEditItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));

    await expect(service.rotate('11111111-1111-4111-8111-111111111111', { secret: { password: 'rotated-secret' }, reason: 'Rotazione operativa richiesta' })).rejects.toThrow('rotation history failed');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rollback se audit rotate fallisce', async () => {
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM "tenant_a".credential_secrets')) return [{ secret_version: 1 }];
        if (sql.includes('UPDATE "tenant_a".credential_items')) return [{ last_rotated_at: '2026-07-16T08:00:00.000Z', rotation_due_at: null }];
        if (sql.includes('INSERT INTO "tenant_a".credential_audit_log')) throw new Error('audit failed');
        return [];
      }),
    };
    const service = new TenantCredentialsService(
      { createQueryRunner: () => runner, query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      { assertCanEditItem: jest.fn(), isAdmin: jest.fn(() => true) } as any,
      { user: { ...OWNER, tenantId: 'tenant_a' }, headers: {} },
    ) as any;
    jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'requireUuid').mockImplementation((value: unknown) => String(value));

    await expect(service.rotate('11111111-1111-4111-8111-111111111111', { secret: { password: 'rotated-secret' }, reason: 'Rotazione operativa richiesta' })).rejects.toThrow('audit failed');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('redazione ricorsiva case-insensitive copre header e campi cifrati', () => {
    const redacted = redactCredentialSensitive({
      Authorization: 'Bearer token',
      Cookie: 'session=secret',
      nested: [{ ApiKEY: 'api', PayloadIv: 'iv', CustomFields: [{ value: 'secret' }] }],
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('Bearer token');
    expect(serialized).not.toContain('session=secret');
    expect(serialized).not.toContain('api');
    expect(serialized).not.toContain('iv');
    expect(serialized).not.toContain('secret');
  });
});

describe('TenantCredentialsPermissionsService ACL/module integration', () => {
  it('owner/admin/superadmin hanno accesso pieno', async () => {
    const service = new TenantCredentialsPermissionsService({ query: jest.fn() } as any);
    expect(service.isAdmin({ id: OWNER.sub, role: 'owner' })).toBe(true);
    await expect(service.assertCanRevealItem('tenant_a', '44444444-4444-4444-8444-444444444444', { id: OWNER.sub, role: 'owner' })).resolves.toBeUndefined();
  });

  it('module permission senza ACL non basta, view non implica reveal, edit non implica manage', async () => {
    const query = jest.fn();
    const service = new TenantCredentialsPermissionsService({ query } as any);
    const user = { id: USER.sub, role: 'user' };
    jest.spyOn(service, 'canUseModule').mockResolvedValue(true);
    jest.spyOn(service, 'getItemAcl').mockResolvedValue({
      can_view_metadata: true,
      can_reveal_secret: false,
      can_edit: true,
      can_manage_permissions: false,
    });

    await expect(service.assertCanReadItem('tenant_a', '44444444-4444-4444-8444-444444444444', user)).resolves.toBeUndefined();
    await expect(service.assertCanRevealItem('tenant_a', '44444444-4444-4444-8444-444444444444', user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertCanManagePermissions('tenant_a', '44444444-4444-4444-8444-444444444444', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registra i nomi esatti dei permessi modulo credentials', () => {
    expect(CREDENTIAL_MODULE_PERMISSION_KEYS).toEqual([
      'credentials',
      'credentials.read',
      'credentials.create',
      'credentials.edit',
      'credentials.reveal',
      'credentials.manage_permissions',
      'credentials.audit',
    ]);
  });

  it('senza module permission restituisce 403 anche con ACL', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('team_module_permissions')) return [];
      if (sql.includes('credential_permissions')) return [{ can_view_metadata: true, can_reveal_secret: true, can_edit: true, can_manage_permissions: true }];
      return [];
    });
    const service = new TenantCredentialsPermissionsService({ query } as any);
    await expect(service.assertCanReadItem('tenant_a', '44444444-4444-4444-8444-444444444444', { id: USER.sub, role: 'user' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TenantCredentialsService multi-tenant SQL scoping', () => {
  it('usa sempre lo schema del tenant corrente per le query di lista', async () => {
    const schemas: string[] = [];
    function serviceFor(tenantId: string) {
      const query = jest.fn(async (sql: string) => {
        const match = sql.match(/"([^"]+)"\.credential_/);
        if (match) schemas.push(match[1]);
        if (sql.includes('credential_items ci') && sql.includes('WHERE ci.id')) return [{ id: '4f52eac3-aee6-4d27-ab51-48632ca2df2a', title: 'A', kind: 'hosting', environment: 'production', status: 'active', access_scope: 'restricted' }];
        return [];
      });
      const service = new TenantCredentialsService(
        { query } as any,
        new TenantCredentialsCryptoService(),
        { isAdmin: jest.fn(() => true), assertCanReadItem: jest.fn(), assertCanEditItem: jest.fn(), assertCanRevealItem: jest.fn(), assertCanManagePermissions: jest.fn(), canUseModule: jest.fn().mockResolvedValue(true) } as any,
        { user: { sub: OWNER.sub, role: 'owner', tenantId }, headers: {} },
      ) as any;
      jest.spyOn(service, 'ensureSchema').mockResolvedValue(undefined);
      return service;
    }

    await serviceFor('tenant_a').list({});
    await serviceFor('tenant_b').list({});
    expect(schemas).toContain('tenant_a');
    expect(schemas).toContain('tenant_b');
    expect(schemas.every((schema) => schema === 'tenant_a' || schema === 'tenant_b')).toBe(true);
  });
});

describe('TenantCredentialsSchedulerService', () => {
  it('enumera tenant attivi, prosegue se un tenant fallisce e deduplica notifiche senza segreti', async () => {
    const query = jest.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM public.tenants')) return [{ schema_name: 'tenant_a' }, { schema_name: 'tenant_b' }];
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('CREATE EXTENSION')) return [];
      if (sql.includes('FROM "tenant_a".credential_items')) throw new Error('tenant broken');
      if (sql.includes('FROM "tenant_b".credential_items')) {
        return [{ id: '44444444-4444-4444-8444-444444444444', title: 'Hosting', owner_user_id: null, alert_type: 'expires_at', due_at: '2026-07-20T00:00:00.000Z' }];
      }
      if (sql.includes('credential_alert_dedupe') && sql.includes('SELECT id')) return [];
      if (sql.includes('credential_alert_dedupe') && sql.includes('INSERT INTO')) return [{ id: '55555555-5555-4555-8555-555555555555' }];
      if (sql.includes('credential_audit_log')) return [];
      return [];
    });
    const notifications = { createNotification: jest.fn().mockResolvedValue({ created: true }) };
    const service = new TenantCredentialsSchedulerService({ query } as any, notifications as any);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    await service.processCredentialAlerts();

    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    const payload = notifications.createNotification.mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toMatch(/password|token|secret|apiKey/i);
    expect(payload.fingerprint).toContain('credentials:44444444-4444-4444-8444-444444444444:expires_at');
  });
});
