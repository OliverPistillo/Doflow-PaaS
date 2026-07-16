export const CREDENTIAL_KINDS = [
  'hosting',
  'wordpress',
  'server',
  'dns',
  'domain_registrar',
  'email',
  'social',
  'analytics',
  'marketing',
  'api_key',
  'database',
  'cloud',
  'repository',
  'payment_provider',
  'other',
] as const;

export const CREDENTIAL_ENVIRONMENTS = ['production', 'staging', 'development', 'test', 'internal', 'other'] as const;
export const CREDENTIAL_STATUSES = ['active', 'expiring', 'expired', 'rotation_due', 'revoked', 'archived'] as const;
export const CREDENTIAL_ACCESS_SCOPES = ['admin_only', 'restricted'] as const;

export const CREDENTIAL_LINK_ENTITY_TYPES = [
  'company',
  'contact',
  'lead',
  'opportunity',
  'briefing',
  'quote',
  'contract',
  'paperwork_dossier',
  'project',
  'task',
  'document',
  'recurring_service',
  'renewal',
  'domain',
] as const;

export const CREDENTIAL_LINK_RELATIONS = ['belongs_to', 'grants_access_to', 'manages', 'related_to', 'primary_for'] as const;

export const CREDENTIAL_AUDIT_ACTIONS = [
  'credential_created',
  'credential_updated',
  'credential_archived',
  'credential_restored',
  'secret_created',
  'secret_revealed',
  'secret_reveal_denied',
  'secret_rotated',
  'permission_granted',
  'permission_updated',
  'permission_revoked',
  'link_created',
  'link_deleted',
  'export_created',
  'alert_sent',
] as const;

export const CREDENTIAL_AUDIT_OUTCOMES = ['success', 'denied', 'failed', 'skipped'] as const;

export const CREDENTIAL_SECRET_KEYS = [
  'username',
  'password',
  'apiKey',
  'secretKey',
  'token',
  'recoveryCodes',
  'privateNotes',
  'customFields',
] as const;

export const CREDENTIAL_MODULE_PERMISSION_KEYS = [
  'credentials',
  'credentials.read',
  'credentials.create',
  'credentials.edit',
  'credentials.reveal',
  'credentials.manage_permissions',
  'credentials.audit',
] as const;

export type CredentialSecretPayload = {
  username?: string | null;
  password?: string | null;
  apiKey?: string | null;
  secretKey?: string | null;
  token?: string | null;
  recoveryCodes?: string[] | null;
  privateNotes?: string | null;
  customFields?: Array<{ label: string; value: string; secret?: boolean }> | null;
};

export type AuthUser = { id: string; email?: string; role: string };

export function redactCredentialSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactCredentialSensitive(entry));
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  const sensitive = new Set([
    'username',
    'password',
    'secret',
    'apiKey',
    'apikey',
    'api_key',
    'secretKey',
    'secretkey',
    'secret_key',
    'token',
    'recoveryCodes',
    'recoverycodes',
    'recovery_codes',
    'privateNotes',
    'privatenotes',
    'private_notes',
    'customFields',
    'customfields',
    'custom_fields',
    'encryptedPayload',
    'encryptedpayload',
    'encrypted_payload',
    'encryptedDek',
    'encrypteddek',
    'encrypted_dek',
    'payloadIv',
    'payloadiv',
    'payload_iv',
    'payloadAuthTag',
    'payloadauthtag',
    'payload_auth_tag',
    'dekIv',
    'dekiv',
    'dek_iv',
    'dekAuthTag',
    'dekauthtag',
    'dek_auth_tag',
    'authorization',
    'cookie',
  ]);

  for (const [key, entry] of Object.entries(source)) {
    const normalized = key.replace(/[_-]/g, '').toLowerCase();
    if (sensitive.has(key) || sensitive.has(key.toLowerCase()) || sensitive.has(normalized)) {
      redacted[key] = '[redacted]';
    } else {
      redacted[key] = redactCredentialSensitive(entry);
    }
  }

  return redacted;
}

export function hasCredentialSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasCredentialSensitiveKey(entry));
  if (!value || typeof value !== 'object') return false;
  const sensitive = new Set([
    'username',
    'password',
    'secret',
    'secretkey',
    'apikey',
    'token',
    'recoverycodes',
    'privatenotes',
    'customfields',
    'authorization',
    'cookie',
  ]);
  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    const normalized = key.replace(/[_-]/g, '').toLowerCase();
    return sensitive.has(normalized) || hasCredentialSensitiveKey(entry);
  });
}
