import { apiFetch } from "@/lib/api";

export type CommercialList<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CommercialCompany = {
  id: string;
  name: string;
  legal_name?: string | null;
  vat_number?: string | null;
  fiscal_code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  status?: string | null;
  source?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  notes?: string | null;
  owner_user_id?: string | null;
  logo_url?: string | null;
  logo_updated_at?: string | null;
  logo_updated_by?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  version: number;
  deleted_at?: string | null;
  merged_into_id?: string | null;
};

export type CommercialContact = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  first_name: string;
  last_name?: string | null;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
  version: number;
  deleted_at?: string | null;
  merged_into_id?: string | null;
};

export type CommercialLead = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  title: string;
  status?: string | null;
  commercial_stage?: string | null;
  commercial_stage_unmapped?: boolean;
  budget_estimate?: number | string | null;
  urgency?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  version: number;
};

export type CommercialOpportunity = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  lead_id?: string | null;
  title: string;
  service_type?: string | null;
  lead_source?: string | null;
  lead_interest?: string | null;
  lead_urgency?: string | null;
  value_estimate?: number | string | null;
  probability?: number | null;
  stage: string;
  ui_stage?: string | null;
  commercial_stage_unmapped?: boolean;
  expected_close_date?: string | null;
  assigned_to?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  urgency?: string | null;
  intake_submission_id?: string | null;
  intake_form_data?: Record<string, unknown> | null;
  intake_attribution?: Record<string, unknown> | null;
  intake_landing_url?: string | null;
  intake_source_origin?: string | null;
  intake_created_at?: string | null;
  campaign_id?: string | null;
  commercial_attribution?: Record<string, unknown> | null;
  updated_at?: string | null;
  created_at?: string | null;
  version: number;
  pipeline_order?: number | string | null;
  converted_company_id?: string | null;
  converted_contact_id?: string | null;
  converted_at?: string | null;
  deleted_at?: string | null;
  merged_into_id?: string | null;
};

export type CommercialActivity = {
  id: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
  type: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  status?: string | null;
  priority?: string | null;
  metadata?: Record<string, unknown> | null;
  kanban_order?: number | string | null;
  assigned_to?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  version: number;
  contact_id?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  deleted_at?: string | null;
};

export type CommercialDuplicateCandidate = {
  id: string;
  type: "lead" | "client" | "contact";
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  taxCode?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
  owner?: string | null;
  status?: string | null;
  customerId?: string | null;
  version: number;
};

export type CommercialDuplicateGroup = {
  id: string;
  pairKey: string;
  level: "certain" | "probable";
  candidates: [CommercialDuplicateCandidate, CommercialDuplicateCandidate];
  reasons: string[];
  matchingFields: string[];
  score: number;
};

export type CommercialCustomerAggregate = {
  company: CommercialCompany;
  contacts: CommercialContact[];
  opportunities: CommercialOpportunity[];
  activities: CommercialActivity[];
  communications: Array<Record<string, unknown> & { id: string; version: number }>;
  attributions: Array<Record<string, unknown> & { id: string }>;
};

export type CommercialPipelineStage = {
  stage: string;
  kind?: "positive" | "outcome";
  label: string;
  count: number;
  totalValue: number;
  items: CommercialOpportunity[];
};

export type CommercialPipeline = {
  model?: string;
  stages: CommercialPipelineStage[];
  unmappedCount?: number;
  unmappedItems?: CommercialOpportunity[];
};

export type CommercialQuote = {
  id: string;
  quote_number?: string | null;
  title: string;
  status: string;
  company_id?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  tax_total?: number | string | null;
  total?: number | string | null;
  valid_until?: string | null;
  accepted_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  version?: number | null;
  parent_quote_id?: string | null;
  replaced_by_id?: string | null;
  document_discount?: number | string | null;
  tax_rate?: number | string | null;
  client_notes?: string | null;
  internal_notes?: string | null;
  terms?: string | null;
  created_by?: string | null;
  items?: Array<{
    id: string;
    service_template_id?: string | null;
    name?: string | null;
    description?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    discount?: number | string | null;
    tax_rate?: number | string | null;
  }>;
  updated_at?: string | null;
  created_at?: string | null;
};

type QueryValue = string | number | boolean | null | undefined;

function queryString(query: Record<string, QueryValue> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

const idempotencyHeaders = (key?: string) => ({
  "Idempotency-Key": key || crypto.randomUUID(),
});

export const commercialApi = {
  companies(query: Record<string, QueryValue> = {}, signal?: AbortSignal) {
    return apiFetch<CommercialList<CommercialCompany>>(`/tenant/crm/companies${queryString(query)}`, { signal });
  },
  company(id: string) {
    return apiFetch<CommercialCompany>(`/tenant/crm/companies/${encodeURIComponent(id)}`);
  },
  contacts(query: Record<string, QueryValue> = {}, signal?: AbortSignal) {
    return apiFetch<CommercialList<CommercialContact>>(`/tenant/crm/contacts${queryString(query)}`, { signal });
  },
  contact(id: string) {
    return apiFetch<CommercialContact>(`/tenant/crm/contacts/${encodeURIComponent(id)}`);
  },
  leads(query: Record<string, QueryValue> = {}, signal?: AbortSignal) {
    return apiFetch<CommercialList<CommercialLead>>(`/tenant/crm/leads${queryString(query)}`, { signal });
  },
  opportunities(query: Record<string, QueryValue> = {}, signal?: AbortSignal) {
    return apiFetch<CommercialList<CommercialOpportunity>>(`/tenant/crm/opportunities${queryString(query)}`, { signal });
  },
  opportunity(id: string) {
    return apiFetch<CommercialOpportunity>(`/tenant/crm/opportunities/${encodeURIComponent(id)}`);
  },
  activities(query: Record<string, QueryValue> = {}, signal?: AbortSignal) {
    return apiFetch<CommercialList<CommercialActivity>>(`/tenant/crm/activities${queryString(query)}`, { signal });
  },
  pipeline(signal?: AbortSignal) {
    return apiFetch<CommercialPipeline>("/tenant/crm/pipeline", { signal });
  },
  quotes(query: Record<string, QueryValue> = {}) {
    return apiFetch<CommercialList<CommercialQuote>>(`/tenant/quotes${queryString(query)}`);
  },
  createQuote(payload: Record<string, unknown>) {
    return apiFetch<Record<string, unknown> & { id: string }>("/tenant/quotes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateQuote(id: string, payload: Record<string, unknown>) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  updateQuoteStatus(id: string, status: string) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  createQuoteVersion(id: string, versionId?: string) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body: JSON.stringify(versionId ? { id: versionId } : {}),
    });
  },
  replaceQuoteItems(id: string, items: Record<string, unknown>[]) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}/items`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
  },
  acceptQuote(id: string) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}/accept`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
  },
  rejectQuote(id: string) {
    return apiFetch<Record<string, unknown> & { id: string }>(`/tenant/quotes/${encodeURIComponent(id)}/reject`, {
      method: "PATCH",
    });
  },
  createCompany(payload: Partial<CommercialCompany>) {
    return apiFetch<CommercialCompany>("/tenant/crm/companies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createContact(payload: Partial<CommercialContact>) {
    return apiFetch<CommercialContact>("/tenant/crm/contacts", { method: "POST", body: JSON.stringify(payload) });
  },
  updateContact(id: string, payload: Partial<CommercialContact>) {
    return apiFetch<CommercialContact>(`/tenant/crm/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteContact(id: string) {
    return apiFetch<{ success: boolean }>(`/tenant/crm/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  createOpportunity(payload: Partial<CommercialOpportunity>) {
    return apiFetch<CommercialOpportunity>("/tenant/crm/opportunities", { method: "POST", body: JSON.stringify(payload) });
  },
  createLead(payload: {
    companyName: string;
    title: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    serviceType?: string;
    source?: string;
    value?: number;
    probability?: number;
    stage?: string;
    assignedTo?: string;
    nextAction?: string;
    nextActionAt?: string;
    campaignId?: string;
  }, idempotencyKey?: string) {
    return apiFetch<{ item: CommercialOpportunity; correlationId: string }>("/tenant/commercial/leads", {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  updateOpportunity(id: string, payload: Partial<CommercialOpportunity>) {
    return apiFetch<CommercialOpportunity>(`/tenant/crm/opportunities/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteOpportunity(id: string) {
    return apiFetch<{ success: boolean }>(`/tenant/crm/opportunities/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  createActivity(payload: Record<string, unknown>) {
    return apiFetch<CommercialActivity>("/tenant/crm/activities", { method: "POST", body: JSON.stringify(payload) });
  },
  updateActivity(id: string, payload: Record<string, unknown>) {
    return apiFetch<CommercialActivity>(`/tenant/crm/activities/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteActivity(id: string) {
    return apiFetch<{ success: boolean }>(`/tenant/crm/activities/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  updateCompany(id: string, payload: Partial<CommercialCompany>) {
    return apiFetch<CommercialCompany>(`/tenant/crm/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteCompany(id: string) {
    return apiFetch<{ success: boolean }>(`/tenant/crm/companies/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  moveOpportunity(id: string, stage: string) {
    return apiFetch<CommercialOpportunity>(`/tenant/crm/opportunities/${encodeURIComponent(id)}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
  },
  transitionOpportunity(id: string, payload: { stage: string; version: number; reason?: string; note?: string }, idempotencyKey?: string) {
    return apiFetch<{ item: CommercialOpportunity; unchanged: boolean; correlationId: string }>(`/tenant/commercial/pipeline/${encodeURIComponent(id)}/transition`, {
      method: "PATCH",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  reorderPipeline(stage: string, leadIds: string[], idempotencyKey?: string) {
    return apiFetch<{ ok: true; stage: string; leadIds: string[] }>("/tenant/commercial/pipeline/reorder", {
      method: "PATCH",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ stage, leadIds }),
    });
  },
  reorderActivities(
    activityId: string,
    status: "todo" | "in_progress" | "waiting_client" | "completed" | "cancelled",
    items: Array<{ id: string; version: number; order: number }>,
    idempotencyKey?: string,
  ) {
    return apiFetch<{ items: CommercialActivity[]; unchanged: boolean; correlationId: string }>("/tenant/commercial/activities/reorder", {
      method: "PATCH",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ activityId, status, items }),
    });
  },
  archive(resource: "lead" | "customer" | "contact" | "activity" | "communication", id: string, version: number, reason?: string, idempotencyKey?: string) {
    return apiFetch<{ item: Record<string, unknown> & { id: string; version: number } }>(`/tenant/commercial/archive/${resource}/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ version, reason }),
    });
  },
  restore(resource: "lead" | "customer" | "contact" | "activity" | "communication", id: string, version: number, idempotencyKey?: string) {
    return apiFetch<{ item: Record<string, unknown> & { id: string; version: number } }>(`/tenant/commercial/archive/${resource}/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ version }),
    });
  },
  convertOpportunity(id: string, payload: { version: number; createOnboardingActivity: boolean; existingCompanyId?: string }, idempotencyKey?: string) {
    return apiFetch<{ status: "created" | "existing"; clientId: string; opportunity: CommercialOpportunity; correlationId: string }>(`/tenant/commercial/leads/${encodeURIComponent(id)}/convert`, {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  updateAttribution(
    id: string,
    payload: { version: number; campaignId?: string | null; source?: string; medium?: string; content?: string; term?: string },
    idempotencyKey?: string,
  ) {
    return apiFetch<{ item: CommercialOpportunity; unchanged: boolean; correlationId: string }>(`/tenant/commercial/leads/${encodeURIComponent(id)}/attribution`, {
      method: "PATCH",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  duplicateGroups(signal?: AbortSignal) {
    return apiFetch<{ analyzedAt: string; groups: CommercialDuplicateGroup[]; ignored: CommercialDuplicateGroup[] }>("/tenant/commercial/duplicates", { signal });
  },
  decideDuplicate(leftId: string, rightId: string, decision: "ignored" | "pending", reason?: string, idempotencyKey?: string) {
    return apiFetch<{ ok: true; pairKey: string; decision: string }>("/tenant/commercial/duplicates/decision", {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ leftId, rightId, decision, reason }),
    });
  },
  mergeDuplicates(payload: { primaryId: string; secondaryId: string; primaryVersion: number; secondaryVersion: number; fields?: Record<string, unknown> }, idempotencyKey?: string) {
    return apiFetch<{ ok: true; primaryId: string; secondaryId: string; recordType: string; item: Record<string, unknown> & { version: number }; correlationId: string }>("/tenant/commercial/duplicates/merge", {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  customerAggregate(id: string, signal?: AbortSignal) {
    return apiFetch<CommercialCustomerAggregate>(`/tenant/commercial/customers/${encodeURIComponent(id)}`, { signal });
  },
  communications(signal?: AbortSignal) {
    return apiFetch<CommercialList<Record<string, unknown> & { id: string; version: number }>>("/tenant/commercial/communications", { signal });
  },
  setPrimaryContact(companyId: string, contactId: string, version: number, idempotencyKey?: string) {
    return apiFetch<{ item: CommercialContact }>(`/tenant/commercial/customers/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}/primary`, {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ version }),
    });
  },
  createCommunication(companyId: string, payload: Record<string, unknown>, idempotencyKey?: string) {
    return apiFetch<{ item: Record<string, unknown> & { id: string; version: number } }>(`/tenant/commercial/customers/${encodeURIComponent(companyId)}/communications`, {
      method: "POST",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    });
  },
  updateCommunication(companyId: string, communicationId: string, version: number, updates: Record<string, unknown>, idempotencyKey?: string) {
    return apiFetch<{ item: Record<string, unknown> & { id: string; version: number } }>(`/tenant/commercial/customers/${encodeURIComponent(companyId)}/communications/${encodeURIComponent(communicationId)}`, {
      method: "PATCH",
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ version, updates }),
    });
  },
};
