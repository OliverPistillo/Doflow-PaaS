import { BadRequestException } from '@nestjs/common';

export const CREDENTIAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCredentialUuid(value: unknown): value is string {
  const text = String(value || '').trim();
  return CREDENTIAL_UUID_RE.test(text);
}

export function requireCredentialUuid(value: unknown, label = 'ID'): string {
  const text = String(value || '').trim();
  if (!isCredentialUuid(text)) throw new BadRequestException(`${label} non valido`);
  return text;
}

export function credentialUuidOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return isCredentialUuid(text) ? text : null;
}
