"use client";

import { apiFetch } from "@/lib/api";

export type OperationsRecordKind = "company" | "opportunity" | "project";
export type OperationsTarget = { record_kind: OperationsRecordKind; record_id: string };

export type MaterialRequest = {
  id: string;
  company_id?: string | null;
  opportunity_id?: string | null;
  project_id?: string | null;
  title: string;
  description?: string | null;
  status: "requested" | "received" | "waived";
  due_at?: string | null;
  requested_by?: string | null;
  requested_by_label?: string | null;
  received_document_id?: string | null;
  received_document_title?: string | null;
  received_document_filename?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type AdministrationSummary = {
  total_invoiced: number;
  total_paid: number;
  total_remaining: number;
  total_overdue: number;
  next_deadline?: string | null;
  next_renewal?: string | null;
  total_expected: number;
  payment_status: string;
};

export type RecordAdministrationItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  status?: string | null;
  signature_status?: string | null;
  signed_at?: string | null;
  invoice_number?: string | null;
  due_date?: string | null;
  next_due_date?: string | null;
  currency?: string | null;
  billing_cycle?: string | null;
  total?: number | string | null;
  paid_total?: number | string | null;
  remaining_total?: number | string | null;
  amount?: number | string | null;
  auto_renew?: boolean | null;
};

export type RecordAdministration = {
  summary: AdministrationSummary;
  quotes: RecordAdministrationItem[];
  contracts: RecordAdministrationItem[];
  invoices: RecordAdministrationItem[];
  payments: RecordAdministrationItem[];
  deadlines: RecordAdministrationItem[];
  recurring_services: RecordAdministrationItem[];
  renewals: RecordAdministrationItem[];
};

function query(target: OperationsTarget, extra?: Record<string, string>) {
  const params = new URLSearchParams({ ...target, ...(extra || {}) });
  return params.toString();
}

export const recordOperationsApi = {
  materials(target: OperationsTarget, status = "all") {
    return apiFetch<{ items: MaterialRequest[] }>(`/tenant/record-operations/materials?${query(target, { status })}`);
  },
  createMaterial(target: OperationsTarget, body: { title: string; description?: string; due_at?: string }) {
    return apiFetch<MaterialRequest>("/tenant/record-operations/materials", {
      method: "POST",
      body: JSON.stringify({ ...target, ...body }),
    });
  },
  receiveMaterial(id: string, documentId: string) {
    return apiFetch<MaterialRequest>(`/tenant/record-operations/materials/${id}/received`, {
      method: "PATCH",
      body: JSON.stringify({ document_id: documentId }),
    });
  },
  waiveMaterial(id: string) {
    return apiFetch<MaterialRequest>(`/tenant/record-operations/materials/${id}/waive`, { method: "PATCH" });
  },
  administration(target: OperationsTarget) {
    return apiFetch<RecordAdministration>(`/tenant/record-operations/administration?${query(target)}`);
  },
  createPayment(invoiceId: string, body: Record<string, unknown>) {
    return apiFetch<Record<string, unknown>>(`/tenant/finance/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  completeDeadline(id: string) {
    return apiFetch(`/tenant/finance/deadlines/${id}/complete`, { method: "PATCH" });
  },
  completeRenewal(id: string) {
    return apiFetch(`/tenant/finance/renewals/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid" }),
    });
  },
};
