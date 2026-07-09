"use client";

import { apiFetch } from "@/lib/api";

export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };

export type PaperworkDossier = {
  id: string;
  title: string;
  description?: string | null;
  dossier_type: string;
  company_id?: string | null;
  contact_id?: string | null;
  quote_id?: string | null;
  project_id?: string | null;
  contract_id?: string | null;
  owner_user_id?: string | null;
  assigned_to_user_id?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaperworkItem = {
  id: string;
  dossier_id: string;
  title: string;
  description?: string | null;
  category: string;
  is_required: boolean;
  status: string;
  assigned_to_user_id?: string | null;
  due_date?: string | null;
  linked_document_id?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaperworkActivity = {
  id: string;
  dossier_id?: string | null;
  action: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type PaperworkSummary = {
  openDossiers: number;
  blockedDossiers: number;
  overdueDossiers: number;
  missingItems: number;
  dueSoonItems: number;
  recentDossiers?: PaperworkDossier[];
};

export type CreateDossierInput = Partial<PaperworkDossier> & Record<string, unknown>;
export type UpdateDossierInput = Partial<PaperworkDossier> & Record<string, unknown>;

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

export const paperworkApi = {
  summary: () => apiFetch<PaperworkSummary>("/tenant/paperwork/summary"),
  list: (params?: QueryParams) => apiFetch<ListResponse<PaperworkDossier>>(`/tenant/paperwork/dossiers${queryString(params)}`),
  create: (body: CreateDossierInput) => apiFetch<PaperworkDossier>("/tenant/paperwork/dossiers", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/dossiers/${id}`),
  update: (id: string, body: UpdateDossierInput) => apiFetch<PaperworkDossier>(`/tenant/paperwork/dossiers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<{ success: boolean }>(`/tenant/paperwork/dossiers/${id}`, { method: "DELETE" }),
  setStatus: (id: string, status: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/dossiers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  archive: (id: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/dossiers/${id}/archive`, { method: "PATCH" }),
  restore: (id: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/dossiers/${id}/restore`, { method: "PATCH" }),
  fromContract: (contractId: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/from-contract/${contractId}`, { method: "POST" }),
  fromProject: (projectId: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/from-project/${projectId}`, { method: "POST" }),
  fromQuote: (quoteId: string) => apiFetch<PaperworkDossier>(`/tenant/paperwork/from-quote/${quoteId}`, { method: "POST" }),
  items: (id: string) => apiFetch<ListResponse<PaperworkItem>>(`/tenant/paperwork/dossiers/${id}/items`),
  createItem: (id: string, body: Record<string, unknown>) => apiFetch<PaperworkItem>(`/tenant/paperwork/dossiers/${id}/items`, { method: "POST", body: JSON.stringify(body) }),
  updateItem: (id: string, itemId: string, body: Record<string, unknown>) => apiFetch<PaperworkItem>(`/tenant/paperwork/dossiers/${id}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteItem: (id: string, itemId: string) => apiFetch<{ success: boolean }>(`/tenant/paperwork/dossiers/${id}/items/${itemId}`, { method: "DELETE" }),
  completeItem: (id: string, itemId: string) => apiFetch<PaperworkItem>(`/tenant/paperwork/dossiers/${id}/items/${itemId}/complete`, { method: "PATCH" }),
  approveItem: (id: string, itemId: string) => apiFetch<PaperworkItem>(`/tenant/paperwork/dossiers/${id}/items/${itemId}/approve`, { method: "PATCH" }),
  rejectItem: (id: string, itemId: string) => apiFetch<PaperworkItem>(`/tenant/paperwork/dossiers/${id}/items/${itemId}/reject`, { method: "PATCH" }),
  linkDocument: (id: string, documentId: string, itemId?: string) => apiFetch(itemId ? `/tenant/paperwork/dossiers/${id}/items/${itemId}/documents/${documentId}` : `/tenant/paperwork/dossiers/${id}/documents/${documentId}`, { method: "POST" }),
  activity: (id: string) => apiFetch<ListResponse<PaperworkActivity>>(`/tenant/paperwork/dossiers/${id}/activity`),
  export: (id: string) => apiFetch<Record<string, unknown>>(`/tenant/paperwork/dossiers/${id}/export`),
};
