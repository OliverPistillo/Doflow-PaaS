import { InternalServerErrorException } from '@nestjs/common';
import { TenantCredentialsCryptoService } from './tenant-credentials-crypto.service';

describe('TenantCredentialsCryptoService strict crypto', () => {
  const originalEnv = { ...process.env };
  const itemId = '11111111-1111-4111-8111-111111111111';
  const payload = {
    username: 'vault-user',
    password: 'vault-password',
    apiKey: 'vault-api-key',
    token: 'vault-token',
    privateNotes: 'vault-private-notes',
    recoveryCodes: ['vault-recovery-1'],
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION = 'v1';
    process.env.DOFLOW_CREDENTIALS_KEK_V1 = Buffer.alloc(32, 17).toString('base64');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function service() {
    return new TenantCredentialsCryptoService();
  }

  function encrypt() {
    return service().encryptPayload('tenant_a', itemId, 1, payload);
  }

  it('encrypt/decrypt corretto', () => {
    const encrypted = encrypt();
    expect(service().decryptPayload('tenant_a', itemId, encrypted)).toMatchObject(payload);
  });

  it('stesso plaintext produce ciphertext e IV diversi', () => {
    const first = encrypt();
    const second = encrypt();
    expect(first.encrypted_payload).not.toBe(second.encrypted_payload);
    expect(first.payload_iv).not.toBe(second.payload_iv);
    expect(first.encrypted_dek).not.toBe(second.encrypted_dek);
    expect(first.dek_iv).not.toBe(second.dek_iv);
  });

  it('tamper ciphertext fallisce', () => {
    const encrypted = encrypt();
    encrypted.encrypted_payload = flipBase64(encrypted.encrypted_payload);
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('tamper payload auth tag fallisce', () => {
    const encrypted = encrypt();
    encrypted.payload_auth_tag = flipBase64(encrypted.payload_auth_tag);
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('tamper encrypted DEK fallisce', () => {
    const encrypted = encrypt();
    encrypted.encrypted_dek = flipBase64(encrypted.encrypted_dek);
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('tamper DEK auth tag fallisce', () => {
    const encrypted = encrypt();
    encrypted.dek_auth_tag = flipBase64(encrypted.dek_auth_tag);
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('AAD tenant differente fallisce', () => {
    const encrypted = encrypt();
    expect(() => service().decryptPayload('tenant_b', itemId, encrypted)).toThrow();
  });

  it('AAD credential ID differente fallisce', () => {
    const encrypted = encrypt();
    expect(() => service().decryptPayload('tenant_a', '22222222-2222-4222-8222-222222222222', encrypted)).toThrow();
  });

  it('secret version differente fallisce', () => {
    const encrypted = encrypt();
    encrypted.secret_version = 2;
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('payload version differente fallisce', () => {
    const encrypted = encrypt();
    encrypted.payload_version = 2;
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow();
  });

  it('KEK mancante fallisce chiuso', () => {
    delete process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION;
    expect(() => service().encryptPayload('tenant_a', itemId, 1, payload)).toThrow(InternalServerErrorException);
  });

  it('Base64 invalido fallisce', () => {
    process.env.DOFLOW_CREDENTIALS_KEK_V1 = 'not-valid-base64!';
    expect(() => service().encryptPayload('tenant_a', itemId, 1, payload)).toThrow(InternalServerErrorException);
  });

  it('Base64 valido ma non 32 byte fallisce', () => {
    process.env.DOFLOW_CREDENTIALS_KEK_V1 = Buffer.alloc(31, 1).toString('base64');
    expect(() => service().encryptPayload('tenant_a', itemId, 1, payload)).toThrow(InternalServerErrorException);
  });

  it('key version sconosciuta fallisce', () => {
    const encrypted = encrypt();
    encrypted.key_version = 'v9';
    expect(() => service().decryptPayload('tenant_a', itemId, encrypted)).toThrow(InternalServerErrorException);
  });

  it('nessun plaintext compare nel risultato cifrato serializzato', () => {
    const serialized = JSON.stringify(encrypt());
    for (const value of ['vault-user', 'vault-password', 'vault-api-key', 'vault-token', 'vault-private-notes', 'vault-recovery-1']) {
      expect(serialized).not.toContain(value);
    }
  });

  function flipBase64(value: string): string {
    const buf = Buffer.from(value, 'base64');
    buf[0] = buf[0] ^ 1;
    return buf.toString('base64');
  }
});
