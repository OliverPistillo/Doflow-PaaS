"use client";

import { apiFetch } from "@/lib/api";
import type {
  CreateCredentialInput,
  CreateLinkInput,
  CreatePermissionInput,
  CredentialActivity,
  CredentialAuditEntry,
  CredentialItem,
  CredentialLink,
  CredentialPermission,
  CredentialRevealResponse,
  CredentialRotation,
  CredentialsDashboard,
  CredentialsOptions,
  CredentialsParams,
  ListResponse,
  ReplaceSecretInput,
  RotateSecretInput,
  UpdateCredentialInput,
  UpdatePermissionInput,
} from "@/lib/tenant-credentials-types";

function qs(params?: CredentialsParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function post<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body || {}), cache: "no-store" });
}

export const credentialsApi = {
  options: () => apiFetch<CredentialsOptions>("/tenant/credentials/options"),
  dashboard: () => apiFetch<CredentialsDashboard>("/tenant/credentials/dashboard"),
  list: (params?: CredentialsParams) => apiFetch<ListResponse<CredentialItem>>(`/tenant/credentials${qs(params)}`),
  expiring: (params?: CredentialsParams) => apiFetch<ListResponse<CredentialItem>>(`/tenant/credentials/expiring${qs(params)}`),
  renewalsDue: (params?: CredentialsParams) => apiFetch<ListResponse<CredentialItem>>(`/tenant/credentials/renewals-due${qs(params)}`),
  rotationDue: (params?: CredentialsParams) => apiFetch<ListResponse<CredentialItem>>(`/tenant/credentials/rotation-due${qs(params)}`),
  activity: (params?: CredentialsParams) => apiFetch<ListResponse<CredentialActivity>>(`/tenant/credentials/activity${qs(params)}`),
  exportAll: () => apiFetch<Record<string, unknown>>("/tenant/credentials/export"),
  create: (body: CreateCredentialInput) => post<CredentialItem>("/tenant/credentials", body),
  get: (credentialId: string) => apiFetch<CredentialItem>(`/tenant/credentials/${credentialId}`),
  update: (credentialId: string, body: UpdateCredentialInput) => apiFetch<CredentialItem>(`/tenant/credentials/${credentialId}`, { method: "PATCH", body: JSON.stringify(body) }),
  archive: (credentialId: string) => apiFetch<{ ok?: boolean }>(`/tenant/credentials/${credentialId}`, { method: "DELETE" }),
  restore: (credentialId: string) => post<CredentialItem>(`/tenant/credentials/${credentialId}/restore`),
  replaceSecret: (credentialId: string, body: ReplaceSecretInput) => post<{ ok?: boolean; secret_version?: number }>(`/tenant/credentials/${credentialId}/secret`, body),
  reveal: (credentialId: string, reason: string) => post<CredentialRevealResponse>(`/tenant/credentials/${credentialId}/reveal`, { reason }),
  rotate: (credentialId: string, body: RotateSecretInput) => post<{ ok: boolean; secret_version: number; last_rotated_at?: string | null; rotation_due_at?: string | null }>(`/tenant/credentials/${credentialId}/rotate`, body),
  permissions: (credentialId: string) => apiFetch<ListResponse<CredentialPermission>>(`/tenant/credentials/${credentialId}/permissions`),
  createPermission: (credentialId: string, body: CreatePermissionInput) => post<CredentialPermission>(`/tenant/credentials/${credentialId}/permissions`, body),
  updatePermission: (credentialId: string, permissionId: string, body: UpdatePermissionInput) => apiFetch<CredentialPermission>(`/tenant/credentials/${credentialId}/permissions/${permissionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePermission: (credentialId: string, permissionId: string) => apiFetch<{ ok?: boolean }>(`/tenant/credentials/${credentialId}/permissions/${permissionId}`, { method: "DELETE" }),
  links: (credentialId: string) => apiFetch<ListResponse<CredentialLink>>(`/tenant/credentials/${credentialId}/links`),
  createLink: (credentialId: string, body: CreateLinkInput) => post<CredentialLink>(`/tenant/credentials/${credentialId}/links`, body),
  deleteLink: (credentialId: string, linkId: string) => apiFetch<{ ok?: boolean }>(`/tenant/credentials/${credentialId}/links/${linkId}`, { method: "DELETE" }),
  audit: (credentialId: string) => apiFetch<ListResponse<CredentialAuditEntry>>(`/tenant/credentials/${credentialId}/audit`),
  rotations: (credentialId: string) => apiFetch<ListResponse<CredentialRotation>>(`/tenant/credentials/${credentialId}/rotations`),
  exportOne: (credentialId: string) => apiFetch<Record<string, unknown>>(`/tenant/credentials/${credentialId}/export`),
};

export type {
  CreateCredentialInput,
  CredentialItem,
  CredentialSecretPayload,
  CredentialsDashboard,
  CredentialsOptions,
  ReplaceSecretInput,
  RotateSecretInput,
} from "@/lib/tenant-credentials-types";

