import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ensureTenantCredentialsTables } from './tenant-credentials-schema';
import { TenantCredentialsCryptoService } from './tenant-credentials-crypto.service';
import { TenantCredentialsService } from './tenant-credentials.service';
import { redactCredentialSensitive } from './tenant-credentials.types';

describe('TenantCredentialsCryptoService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION = 'v1';
    process.env.DOFLOW_CREDENTIALS_KEK_V1 = Buffer.alloc(32, 7).toString('base64');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('cripta e decripta un payload con AAD tenant/item/versione', () => {
    const service = new TenantCredentialsCryptoService();
    const itemId = '11111111-1111-4111-8111-111111111111';
    const encrypted = service.encryptPayload('doflow', itemId, 1, {
      username: 'admin',
      password: 'super-secret',
      customFields: [{ label: 'PIN', value: '1234', secret: true }],
    });

    expect(encrypted.encrypted_payload).toBeTruthy();
    expect(encrypted.encrypted_payload).not.toContain('super-secret');
    expect(encrypted.key_version).toBe('v1');
    expect(service.decryptPayload('doflow', itemId, encrypted)).toMatchObject({
      username: 'admin',
      password: 'super-secret',
    });
  });

  it('fallisce chiuso se la KEK non e configurata', () => {
    delete process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION;
    const service = new TenantCredentialsCryptoService();
    expect(() => service.encryptPayload('doflow', '11111111-1111-4111-8111-111111111111', 1, { password: 'x' }))
      .toThrow(InternalServerErrorException);
  });
});

describe('TenantCredentialsService validation', () => {
  function makeService() {
    const service = new TenantCredentialsService(
      { query: jest.fn() } as any,
      new TenantCredentialsCryptoService(),
      {} as any,
      { user: { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' }, headers: {} },
    );
    return service as any;
  }

  it('rifiuta campi segreti non allowlist', () => {
    const service = makeService();

    expect(() => service.validateSecretPayload({ password: 'ok', webhook: 'nope' }))
      .toThrow(BadRequestException);
  });

  it('redige campi sensibili da metadata/log/export', () => {
    const redacted = redactCredentialSensitive({
      nested: {
        password: 'secret',
        apiKey: 'api',
        token: 'token',
      },
      title: 'Credenziale',
    }) as any;

    expect(redacted.nested.password).toBe('[redacted]');
    expect(redacted.nested.apiKey).toBe('[redacted]');
    expect(redacted.nested.token).toBe('[redacted]');
    expect(redacted.title).toBe('Credenziale');
  });
});

describe('tenant credentials schema', () => {
  it('bootstrap idempotente crea le tabelle senza DROP TABLE', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await ensureTenantCredentialsTables({ query } as any, 'doflow');
    await ensureTenantCredentialsTables({ query } as any, 'doflow');

    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "doflow".credential_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "doflow".credential_secrets');
    expect(sql).toContain('credential_alert_dedupe');
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
