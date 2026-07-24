"use client";

export type CredentialsParams = Record<string, string | number | boolean | null | undefined>;
export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };

export type CredentialsDashboard = {
  totalCredentials: number;
  activeCredentials: number;
  archivedCredentials: number;
  expiringCredentials: number;
  renewalsDue: number;
  rotationDue: number;
  expiredCredentials: number;
  sources?: Record<string, boolean>;
};

export type CredentialsOptions = {
  kinds?: string[];
  environments?: string[];
  statuses?: string[];
  access_scopes?: string[];
  entity_types?: string[];
  relation_types?: string[];
  sort_fields?: string[];
  [key: string]: unknown;
};

export type CredentialItem = {
  id: string;
  title: string;
  kind: string;
  provider?: string | null;
  account_label?: string | null;
  login_url?: string | null;
  domain_name?: string | null;
  environment?: string | null;
  status?: string | null;
  access_scope?: string | null;
  owner_user_id?: string | null;
  expires_at?: string | null;
  renewal_at?: string | null;
  rotation_due_at?: string | null;
  auto_renew?: boolean;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  has_secret?: boolean;
  secret_version?: number | null;
  last_rotated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type CredentialSecretPayload = {
  username?: string;
  password?: string;
  apiKey?: string;
  secretKey?: string;
  token?: string;
  recoveryCodes?: string[];
  privateNotes?: string;
  customFields?: Array<{ label: string; value: string; secret?: boolean }>;
};

export type CredentialRevealResponse = {
  credential_id?: string;
  secret_version?: number;
  revealed_at?: string;
  secret?: CredentialSecretPayload;
  payload?: CredentialSecretPayload;
};

export type CredentialPermission = {
  id: string;
  credential_id?: string;
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  can_view_metadata: boolean;
  can_reveal_secret: boolean;
  can_edit: boolean;
  can_manage_permissions: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CredentialLink = {
  id: string;
  credential_id?: string;
  entity_type: string;
  entity_id: string;
  relation: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type CredentialAuditEntry = {
  id: string;
  credential_id?: string | null;
  action: string;
  outcome?: string | null;
  actor_user_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type CredentialRotation = {
  id: string;
  credential_id?: string;
  previous_secret_version?: number | null;
  new_secret_version?: number | null;
  rotated_by?: string | null;
  reason?: string | null;
  rotated_at?: string | null;
  next_rotation_due_at?: string | null;
  created_at?: string | null;
};

export type CredentialActivity = CredentialAuditEntry & {
  title?: string | null;
  kind?: string | null;
};

export type CreateCredentialInput = Partial<CredentialItem> & {
  secret?: CredentialSecretPayload;
};

export type UpdateCredentialInput = Partial<Omit<CredentialItem, "id" | "has_secret" | "secret_version">>;

export type ReplaceSecretInput = {
  secret: CredentialSecretPayload;
  reason?: string;
};

export type RotateSecretInput = {
  secret: CredentialSecretPayload;
  reason: string;
  next_rotation_due_at?: string | null;
};

export type CreatePermissionInput = Omit<CredentialPermission, "id" | "credential_id" | "created_at" | "updated_at">;
export type UpdatePermissionInput = Partial<Omit<CreatePermissionInput, "user_id">>;
export type CreateLinkInput = Omit<CredentialLink, "id" | "credential_id" | "created_at">;

