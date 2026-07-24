"use client";

import { apiFetch } from "@/lib/api";

export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number; canManage?: boolean };

export type ContractTemplate = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  body_markdown?: string | null;
  variables?: unknown;
  default_checklist?: unknown;
  is_active?: boolean;
  version_label?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Contract = {
  id: string;
  contract_number: string;
  title: string;
  description?: string | null;
  template_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  quote_id?: string | null;
  project_id?: string | null;
  opportunity_id?: string | null;
  owner_user_id?: string | null;
  assigned_to_user_id?: string | null;
  status: string;
  signature_status: string;
  priority: string;
  contract_type: string;
  amount?: number | string | null;
  currency?: string | null;
  payment_terms?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  renewal_date?: string | null;
  due_date?: string | null;
  sent_at?: string | null;
  approved_at?: string | null;
  signed_at?: string | null;
  activated_at?: string | null;
  cancelled_at?: string | null;
  archived_at?: string | null;
  internal_notes?: string | null;
  public_notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ContractVersion = {
  id: string;
  contract_id: string;
  version_number: number;
  title: string;
  body_markdown: string;
  variables?: unknown;
  status: string;
  change_note?: string | null;
  created_at?: string | null;
};

export type ContractSigner = {
  id: string;
  contract_id: string;
  signer_type: string;
  name: string;
  email?: string | null;
  role_title?: string | null;
  status: string;
  signed_at?: string | null;
  declined_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ContractChecklistItem = {
  id: string;
  contract_id: string;
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

export type ContractActivity = {
  id: string;
  contract_id?: string | null;
  action: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type ContractsSummary = {
  contracts?: {
    totalContracts: number;
    draftContracts: number;
    sentContracts: number;
    waitingSignatureContracts: number;
    signedContracts: number;
    expiringContracts: number;
    overdueContracts: number;
    recentContracts?: Contract[];
  };
  paperwork?: unknown;
};

export type CreateContractInput = Partial<Contract> & Record<string, unknown>;
export type UpdateContractInput = Partial<Contract> & Record<string, unknown>;

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

export const contractsApi = {
  summary: () => apiFetch<ContractsSummary>("/tenant/contracts/summary"),
  listTemplates: (params?: QueryParams) => apiFetch<ListResponse<ContractTemplate>>(`/tenant/contracts/templates${queryString(params)}`),
  createTemplate: (body: Record<string, unknown>) => apiFetch<ContractTemplate>("/tenant/contracts/templates", { method: "POST", body: JSON.stringify(body) }),
  seedTemplates: () => apiFetch<{ success: boolean }>("/tenant/contracts/templates/seed-base", { method: "POST" }),
  getTemplate: (id: string) => apiFetch<ContractTemplate>(`/tenant/contracts/templates/${id}`),
  updateTemplate: (id: string, body: Record<string, unknown>) => apiFetch<ContractTemplate>(`/tenant/contracts/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTemplate: (id: string) => apiFetch<{ success: boolean }>(`/tenant/contracts/templates/${id}`, { method: "DELETE" }),
  list: (params?: QueryParams) => apiFetch<ListResponse<Contract>>(`/tenant/contracts${queryString(params)}`),
  create: (body: CreateContractInput) => apiFetch<Contract>("/tenant/contracts", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) => apiFetch<Contract>(`/tenant/contracts/${id}`),
  update: (id: string, body: UpdateContractInput) => apiFetch<Contract>(`/tenant/contracts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<{ success: boolean }>(`/tenant/contracts/${id}`, { method: "DELETE" }),
  setStatus: (id: string, status: string) => apiFetch<Contract>(`/tenant/contracts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  archive: (id: string) => apiFetch<Contract>(`/tenant/contracts/${id}/archive`, { method: "PATCH" }),
  restore: (id: string) => apiFetch<Contract>(`/tenant/contracts/${id}/restore`, { method: "PATCH" }),
  fromQuote: (quoteId: string) => apiFetch<Contract>(`/tenant/contracts/from-quote/${quoteId}`, { method: "POST" }),
  fromProject: (projectId: string) => apiFetch<Contract>(`/tenant/contracts/from-project/${projectId}`, { method: "POST" }),
  versions: (id: string) => apiFetch<ListResponse<ContractVersion>>(`/tenant/contracts/${id}/versions`),
  createVersion: (id: string, body: Record<string, unknown>) => apiFetch<ContractVersion>(`/tenant/contracts/${id}/versions`, { method: "POST", body: JSON.stringify(body) }),
  updateVersion: (id: string, versionId: string, body: Record<string, unknown>) => apiFetch<ContractVersion>(`/tenant/contracts/${id}/versions/${versionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVersion: (id: string, versionId: string) => apiFetch<{ success: boolean }>(`/tenant/contracts/${id}/versions/${versionId}`, { method: "DELETE" }),
  signers: (id: string) => apiFetch<ListResponse<ContractSigner>>(`/tenant/contracts/${id}/signers`),
  createSigner: (id: string, body: Record<string, unknown>) => apiFetch<ContractSigner>(`/tenant/contracts/${id}/signers`, { method: "POST", body: JSON.stringify(body) }),
  updateSigner: (id: string, signerId: string, body: Record<string, unknown>) => apiFetch<ContractSigner>(`/tenant/contracts/${id}/signers/${signerId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSigner: (id: string, signerId: string) => apiFetch<{ success: boolean }>(`/tenant/contracts/${id}/signers/${signerId}`, { method: "DELETE" }),
  checklist: (id: string) => apiFetch<ListResponse<ContractChecklistItem>>(`/tenant/contracts/${id}/checklist`),
  createChecklistItem: (id: string, body: Record<string, unknown>) => apiFetch<ContractChecklistItem>(`/tenant/contracts/${id}/checklist`, { method: "POST", body: JSON.stringify(body) }),
  updateChecklistItem: (id: string, itemId: string, body: Record<string, unknown>) => apiFetch<ContractChecklistItem>(`/tenant/contracts/${id}/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteChecklistItem: (id: string, itemId: string) => apiFetch<{ success: boolean }>(`/tenant/contracts/${id}/checklist/${itemId}`, { method: "DELETE" }),
  completeChecklistItem: (id: string, itemId: string) => apiFetch<ContractChecklistItem>(`/tenant/contracts/${id}/checklist/${itemId}/complete`, { method: "PATCH" }),
  approveChecklistItem: (id: string, itemId: string) => apiFetch<ContractChecklistItem>(`/tenant/contracts/${id}/checklist/${itemId}/approve`, { method: "PATCH" }),
  rejectChecklistItem: (id: string, itemId: string) => apiFetch<ContractChecklistItem>(`/tenant/contracts/${id}/checklist/${itemId}/reject`, { method: "PATCH" }),
  linkDocument: (id: string, documentId: string) => apiFetch(`/tenant/contracts/${id}/documents/${documentId}`, { method: "POST" }),
  activity: (id: string) => apiFetch<ListResponse<ContractActivity>>(`/tenant/contracts/${id}/activity`),
  export: (id: string) => apiFetch<Record<string, unknown>>(`/tenant/contracts/${id}/export`),
};
