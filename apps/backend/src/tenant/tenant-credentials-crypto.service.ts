import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { CredentialSecretPayload } from './tenant-credentials.types';

type EncryptedSecretRecord = {
  encrypted_payload: string;
  payload_iv: string;
  payload_auth_tag: string;
  encrypted_dek: string;
  dek_iv: string;
  dek_auth_tag: string;
  key_version: string;
  payload_version: number;
  secret_version: number;
};

@Injectable()
export class TenantCredentialsCryptoService {
  private readonly payloadVersion = 1;

  encryptPayload(schema: string, itemId: string, secretVersion: number, payload: CredentialSecretPayload): EncryptedSecretRecord {
    const dek = randomBytes(32);
    let kek: Buffer | null = null;
    let payloadClear: Buffer | null = null;
    try {
      const active = this.getActiveKek();
      kek = active.kek;
      const keyVersion = active.keyVersion;
      const payloadIv = randomBytes(12);
      const payloadCipher = createCipheriv('aes-256-gcm', dek, payloadIv);
      payloadCipher.setAAD(this.aad(schema, itemId, secretVersion, this.payloadVersion));
      payloadClear = Buffer.from(JSON.stringify(payload), 'utf8');
      const payloadBytes = Buffer.concat([
        payloadCipher.update(payloadClear),
        payloadCipher.final(),
      ]);
      const payloadTag = payloadCipher.getAuthTag();

      const dekIv = randomBytes(12);
      const dekCipher = createCipheriv('aes-256-gcm', kek, dekIv);
      dekCipher.setAAD(this.aad(schema, itemId, secretVersion, this.payloadVersion, 'dek'));
      const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
      const dekTag = dekCipher.getAuthTag();

      return {
        encrypted_payload: payloadBytes.toString('base64'),
        payload_iv: payloadIv.toString('base64'),
        payload_auth_tag: payloadTag.toString('base64'),
        encrypted_dek: encryptedDek.toString('base64'),
        dek_iv: dekIv.toString('base64'),
        dek_auth_tag: dekTag.toString('base64'),
        key_version: keyVersion,
        payload_version: this.payloadVersion,
        secret_version: secretVersion,
      };
    } finally {
      dek.fill(0);
      if (kek) kek.fill(0);
      if (payloadClear) payloadClear.fill(0);
    }
  }

  decryptPayload(schema: string, itemId: string, row: Record<string, any>): CredentialSecretPayload {
    const secretVersion = Number(row.secret_version);
    const payloadVersion = Number(row.payload_version || this.payloadVersion);
    const kek = this.getKekByVersion(String(row.key_version || ''));
    const encryptedDek = this.fromBase64(row.encrypted_dek, 'encrypted_dek');
    const dekIv = this.fromBase64(row.dek_iv, 'dek_iv', 12);
    const dekTag = this.fromBase64(row.dek_auth_tag, 'dek_auth_tag', 16);

    const dekDecipher = createDecipheriv('aes-256-gcm', kek, dekIv);
    dekDecipher.setAAD(this.aad(schema, itemId, secretVersion, payloadVersion, 'dek'));
    dekDecipher.setAuthTag(dekTag);
    const dek = Buffer.concat([dekDecipher.update(encryptedDek), dekDecipher.final()]);
    let clear: Buffer | null = null;

    try {
      const payloadIv = this.fromBase64(row.payload_iv, 'payload_iv', 12);
      const payloadTag = this.fromBase64(row.payload_auth_tag, 'payload_auth_tag', 16);
      const payloadCiphertext = this.fromBase64(row.encrypted_payload, 'encrypted_payload');
      const payloadDecipher = createDecipheriv('aes-256-gcm', dek, payloadIv);
      payloadDecipher.setAAD(this.aad(schema, itemId, secretVersion, payloadVersion));
      payloadDecipher.setAuthTag(payloadTag);
      clear = Buffer.concat([payloadDecipher.update(payloadCiphertext), payloadDecipher.final()]);
      return JSON.parse(clear.toString('utf8')) as CredentialSecretPayload;
    } finally {
      dek.fill(0);
      kek.fill(0);
      if (clear) clear.fill(0);
    }
  }

  private aad(schema: string, itemId: string, secretVersion: number, payloadVersion: number, suffix = 'payload'): Buffer {
    return Buffer.from(JSON.stringify({
      tenant_schema: schema,
      credential_item_id: itemId,
      secret_version: secretVersion,
      payload_version: payloadVersion,
      part: suffix,
    }), 'utf8');
  }

  private getActiveKek(): { keyVersion: string; kek: Buffer } {
    const rawVersion = String(process.env.DOFLOW_CREDENTIALS_ACTIVE_KEY_VERSION || '').trim();
    if (!rawVersion) {
      throw new InternalServerErrorException('Chiave credenziali non configurata');
    }
    return { keyVersion: this.normalizeKeyVersion(rawVersion), kek: this.getKekByVersion(rawVersion) };
  }

  private getKekByVersion(version: string): Buffer {
    const normalized = this.normalizeKeyVersion(version);
    const envName = `DOFLOW_CREDENTIALS_KEK_${normalized.toUpperCase()}`;
    const encoded = String(process.env[envName] || '').trim();
    if (!encoded) throw new InternalServerErrorException('Chiave credenziali non configurata');
    const key = this.fromBase64(encoded, envName, 32);
    if (key.length !== 32) throw new InternalServerErrorException('Chiave credenziali non valida');
    return key;
  }

  private normalizeKeyVersion(version: string): string {
    const raw = String(version || '').trim();
    if (!raw) throw new InternalServerErrorException('Versione chiave credenziali non configurata');
    return raw.toLowerCase().startsWith('v') ? raw.toLowerCase() : `v${raw}`;
  }

  private fromBase64(value: unknown, label: string, expectedLength?: number): Buffer {
    const text = String(value || '').trim();
    if (!text) throw new InternalServerErrorException(`Payload credenziali non valido: ${label}`);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
      throw new InternalServerErrorException(`Payload credenziali non valido: ${label}`);
    }
    const decoded = Buffer.from(text, 'base64');
    const normalized = decoded.toString('base64');
    if (normalized !== text) throw new InternalServerErrorException(`Payload credenziali non valido: ${label}`);
    if (expectedLength !== undefined && decoded.length !== expectedLength) {
      throw new InternalServerErrorException(`Payload credenziali non valido: ${label}`);
    }
    return decoded;
  }
}
