"use client";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { getTenantHeader } from "@/lib/tenant-fetch";

export type DocumentFolder = {
  id: string;
  parent_id?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  visibility: string;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type TenantDocument = {
  id: string;
  folder_id?: string | null;
  folder_name?: string | null;
  title: string;
  description?: string | null;
  original_filename: string;
  stored_filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | string | null;
  storage_provider?: string | null;
  storage_bucket?: string | null;
  checksum?: string | null;
  category: string;
  visibility: string;
  status: string;
  entity_type?: string | null;
  entity_id?: string | null;
  uploaded_by?: string | null;
  uploaded_by_email?: string | null;
  metadata?: Record<string, unknown> | null;
  version_group_id?: string | null;
  version_number?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type DocumentActivity = {
  id: string;
  document_id?: string | null;
  action: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type DocumentLink = {
  id: string;
  document_id: string;
  entity_type: string;
  entity_id: string;
  relation_type: string;
  created_by?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

export type DocumentSummary = {
  totalDocuments: number;
  recentDocuments: TenantDocument[];
  projectDocuments: number;
  financeDocuments: number;
  storageUsedBytes: number;
};

export type ListResponse<T> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

export type DocumentFilters = {
  search?: string;
  folder_id?: string;
  category?: string;
  visibility?: string;
  status?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  sortDir?: string;
};

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function queryString(params?: QueryParams) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}

export function getDocumentsSummary() {
  return apiFetch<DocumentSummary>("/tenant/documents/summary");
}

export function listDocumentFolders(params?: QueryParams) {
  return apiFetch<ListResponse<DocumentFolder>>(`/tenant/documents/folders${queryString(params)}`);
}

export function createDocumentFolder(body: Partial<DocumentFolder>) {
  return apiFetch<DocumentFolder>("/tenant/documents/folders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateDocumentFolder(id: string, body: Partial<DocumentFolder>) {
  return apiFetch<DocumentFolder>(`/tenant/documents/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteDocumentFolder(id: string) {
  return apiFetch<{ success: boolean }>(`/tenant/documents/folders/${id}`, { method: "DELETE" });
}

export function listDocuments(params?: DocumentFilters) {
  return apiFetch<ListResponse<TenantDocument>>(`/tenant/documents${queryString(params)}`);
}

export function listDocumentsForEntity(entityType: string, entityId: string, params?: DocumentFilters) {
  return apiFetch<ListResponse<TenantDocument>>(`/tenant/documents/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}${queryString(params)}`);
}

export function getDocument(id: string) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}`);
}

export function updateDocument(id: string, body: Partial<TenantDocument>) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function archiveDocument(id: string) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}/archive`, { method: "PATCH" });
}

export function restoreDocument(id: string) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}/restore`, { method: "PATCH" });
}

export function deleteDocument(id: string) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}`, { method: "DELETE" });
}

export function getDocumentActivity(id: string) {
  return apiFetch<ListResponse<DocumentActivity>>(`/tenant/documents/${id}/activity`);
}

export function createDocumentLink(id: string, body: Partial<DocumentLink>) {
  return apiFetch<DocumentLink>(`/tenant/documents/${id}/links`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteDocumentLink(id: string, linkId: string) {
  return apiFetch<{ success: boolean }>(`/tenant/documents/${id}/links/${linkId}`, { method: "DELETE" });
}

export function uploadDocument(formData: FormData) {
  return apiFetch<TenantDocument>("/tenant/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export function uploadDocumentVersion(id: string, formData: FormData) {
  return apiFetch<TenantDocument>(`/tenant/documents/${id}/versions`, {
    method: "POST",
    body: formData,
  });
}

export async function downloadDocumentBlob(document: Pick<TenantDocument, "id" | "original_filename">) {
  const headers: Record<string, string> = {
    ...getTenantHeader(),
  };
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("doflow_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBaseUrl()}/tenant/documents/${document.id}/download`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Download fallito (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : document.original_filename || "documento";
  return { blob, filename };
}
