import { apiFetch } from "@/lib/api";

const json = (method: string, body?: unknown, idempotent = false): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(idempotent ? { "Idempotency-Key": crypto.randomUUID() } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const path = (value: string) => encodeURIComponent(value);

export const backendContractsApi = {
  calendar: {
    get: () => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations"),
    update: (enabledCategories: string[]) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations", json("PATCH", { enabledCategories })),
    sync: (events: Record<string, unknown>[], categories: string[]) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations/sync", json("POST", { events, categories }, true)),
    rotateIcsToken: () => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations/ics-token", json("POST")),
    revokeIcsToken: () => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations/ics-token/revoke", json("POST")),
    disconnectGoogle: () => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/calendar-integrations/google/disconnect", json("POST")),
  },
  commerceSettings: {
    get: () => apiFetch<Record<string, unknown> | null>("/tenant/backend-contracts/commerce-settings"),
    update: (body: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/commerce-settings", json("PATCH", body)),
  },
  customer: {
    state: () => apiFetch<{ care: Record<string, unknown>[]; documents: Record<string, unknown>[]; finance: Record<string, unknown>[]; financeRedacted: boolean }>("/tenant/backend-contracts/customers-state"),
    care: (id: string) => apiFetch<Record<string, unknown> | null>(`/tenant/backend-contracts/customers/${path(id)}/care`),
    updateCare: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/customers/${path(id)}/care`, json("PATCH", body)),
    finance: (id: string) => apiFetch<Record<string, unknown> | null>(`/tenant/backend-contracts/customers/${path(id)}/finance`),
    updateFinance: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/customers/${path(id)}/finance`, json("PATCH", body, true)),
    documents: (id: string) => apiFetch<{ items: Record<string, unknown>[] }>(`/tenant/backend-contracts/customers/${path(id)}/documents`),
    addDocument: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/customers/${path(id)}/documents`, json("POST", body, true)),
    updateDocument: (id: string, documentId: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/customers/${path(id)}/documents/${path(documentId)}`, json("PATCH", body)),
    removeDocument: (id: string, documentId: string) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/customers/${path(id)}/documents/${path(documentId)}`, json("DELETE")),
  },
  inbox: {
    state: () => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/inbox/state"),
    update: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/inbox/conversations/${path(id)}`, json("PATCH", body, true)),
    schedule: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/inbox/conversations/${path(id)}/messages`, json("POST", body, true)),
    email: (id: string, text: string, idempotencyKey: string, subject?: string) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/inbox/conversations/${path(id)}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ text, subject }),
    }),
    draft: (id: string, text: string) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/inbox/conversations/${path(id)}/draft`, json("PUT", { text })),
    read: (id: string) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/inbox/conversations/${path(id)}/read`, json("POST")),
    filters: (filters: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/inbox/filters", json("PUT", { filters })),
  },
  guidedCalls: {
    list: () => apiFetch<{ items: Record<string, unknown>[] }>("/tenant/backend-contracts/guided-calls"),
    create: (body: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/guided-calls", json("POST", body, true)),
    update: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/guided-calls/${path(id)}`, json("PATCH", body, true)),
    message: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/guided-calls/${path(id)}/messages`, json("POST", body, true)),
    messageStatus: (id: string, messageId: string, status: string) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/guided-calls/${path(id)}/messages/${path(messageId)}`, json("PATCH", { status })),
    complete: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/guided-calls/${path(id)}/complete`, json("POST", body, true)),
  },
  teamDuties: {
    list: () => apiFetch<{ items: Record<string, unknown>[] }>("/tenant/backend-contracts/team-duties"),
    create: (body: Record<string, unknown>) => apiFetch<Record<string, unknown>>("/tenant/backend-contracts/team-duties", json("POST", body, true)),
    update: (id: string, body: Record<string, unknown>) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/team-duties/${path(id)}`, json("PATCH", body, true)),
    approve: (id: string, optimisticVersion: number) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/team-duties/${path(id)}/approve`, json("POST", { optimisticVersion }, true)),
    history: (id: string) => apiFetch<{ items: Record<string, unknown>[] }>(`/tenant/backend-contracts/team-duties/${path(id)}/history`),
    read: (id: string, version: number) => apiFetch<Record<string, unknown>>(`/tenant/backend-contracts/team-duties/${path(id)}/read`, json("POST", { version })),
  },
};
