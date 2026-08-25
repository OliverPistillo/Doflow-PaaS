"use client";

import type {
  CommercialContract,
  CommercialRenewal,
} from "@/features/commercial/commercial-commerce";
import type {
  CommercialInvoice,
  CommercialQuote,
} from "@/features/commercial/commercial-documents";
import { apiFetch } from "@/lib/api";

type Raw = Record<string, unknown> & { id: string };
type AuthorityState = {
  quotes: Raw[];
  contracts: Raw[];
  invoices: Raw[];
  renewals: Raw[];
  customer_finance: Raw[];
  redacted: boolean;
};

export type DocumentRevenueCustomerFinance = {
  customerId: string;
  grossInvoiced: number;
  credits: number;
  netInvoiced: number;
  netPaid: number;
};

export type DocumentRevenueSummary = {
  grossRevenue?: number;
  creditNotes?: number;
  netRevenue?: number;
  invoiceCount?: number;
  redacted: boolean;
};

const text = (value: unknown) => String(value ?? "");
const number = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};
const date = (value: unknown, fallback = new Date(0).toISOString()) => {
  const parsed = new Date(String(value || fallback));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};
const records = (value: unknown) =>
  Array.isArray(value) ? (value as Raw[]) : [];
const operationKey = (scope: string) => `${scope}:${crypto.randomUUID()}`;
const headers = (key: string) => ({ "Idempotency-Key": key });

const quoteStatus: Record<string, CommercialQuote["status"]> = {
  draft: "Bozza",
  sent: "Inviato",
  viewed: "Visualizzato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  expired: "Scaduto",
  replaced: "Sostituito",
};
const contractStatus: Record<string, CommercialContract["status"]> = {
  draft: "Da preparare",
  prepared: "Preparato",
  sent: "Inviato",
  waiting_signature: "In attesa di firma",
  signed: "Firmato",
  rejected: "Rifiutato",
  expired: "Scaduto",
  cancelled: "Archiviato",
  archived: "Archiviato",
};
const invoiceStatus: Record<string, CommercialInvoice["status"]> = {
  draft: "Bozza",
  proforma: "Proforma",
  issued: "Emessa esternamente",
  sent: "Emessa esternamente",
  partially_paid: "Parzialmente pagata",
  paid: "Pagata",
  overdue: "Scaduta",
  cancelled: "Annullata",
  void: "Stornata",
};
const renewalStatus: Record<string, CommercialRenewal["status"]> = {
  active: "Attivo",
  upcoming: "In scadenza",
  due: "Da rinnovare",
  reminded: "Promemoria inviato",
  invoiced: "Da rinnovare",
  paid: "Pagato",
  expired: "Scaduto",
  suspended: "Sospeso",
  cancelled: "Annullato",
};

export function mapAuthorityQuote(raw: Raw): CommercialQuote {
  return {
    id: raw.id,
    code: text(raw.quote_number) || raw.id,
    version: Math.max(1, number(raw.version)),
    recordVersion: Math.max(1, number(raw.optimistic_version)),
    status: quoteStatus[text(raw.status)] || "Bozza",
    leadId: text(raw.lead_id) || undefined,
    customerId: text(raw.company_id) || undefined,
    salespersonId: text(raw.created_by),
    lines: records(raw.items).map((item) => ({
      id: item.id,
      serviceId: text(item.service_id) || undefined,
      description:
        text(item.service_description_snapshot) ||
        text(item.description) ||
        text(item.service_name_snapshot) ||
        text(item.name),
      quantity: number(item.quantity),
      unitPrice: number(item.unit_price),
      discount: number(item.discount),
    })),
    subtotal: number(raw.subtotal),
    discount: number(raw.document_discount),
    vatRate: number(raw.tax_rate),
    vatAmount: number(raw.tax_total),
    total: number(raw.total),
    validUntil: text(raw.valid_until).slice(0, 10),
    conditions: text(raw.terms),
    notes: text(raw.internal_notes) || undefined,
    createdAt: date(raw.created_at),
    updatedAt: date(raw.updated_at, date(raw.created_at)),
    sentAt: raw.sent_at ? date(raw.sent_at) : undefined,
    viewedAt: raw.viewed_at ? date(raw.viewed_at) : undefined,
    acceptedAt: raw.accepted_at ? date(raw.accepted_at) : undefined,
    parentQuoteId: text(raw.parent_quote_id) || undefined,
    replacedById: text(raw.replaced_by_id) || undefined,
    archivedAt: raw.archived_at ? date(raw.archived_at) : undefined,
  };
}

export function mapAuthorityContract(raw: Raw): CommercialContract {
  const versions = records(raw.versions);
  const current = versions.find(
    (version) => version.id === text(raw.current_version_id),
  ) || versions.at(-1);
  const signers = records(raw.signers).filter(
    (signer) =>
      !current || text(signer.contract_version_id) === current.id,
  );
  const metadata = (raw.metadata && typeof raw.metadata === "object"
    ? raw.metadata
    : {}) as Record<string, unknown>;
  const version = Math.max(1, number(current?.version_number));
  const baseCode = text(raw.contract_number) || raw.id;
  return {
    id: raw.id,
    recordVersion: Math.max(1, number(raw.optimistic_version)),
    code: /-V\d+$/.test(baseCode) ? baseCode : `${baseCode}-V${version}`,
    title: text(raw.title),
    version,
    status: contractStatus[text(raw.status)] || "Da preparare",
    customerId: text(raw.company_id),
    leadId: text(raw.opportunity_id) || undefined,
    saleId: text(metadata.sale_id) || undefined,
    orderId: text(raw.order_id),
    quoteId: text(raw.quote_id) || undefined,
    serviceIds: Array.isArray(metadata.service_ids)
      ? metadata.service_ids.map(String)
      : [],
    salespersonId:
      text(raw.owner_user_id || raw.assigned_to_user_id),
    projectId: text(raw.project_id) || undefined,
    createdAt: date(raw.created_at),
    updatedAt: date(raw.updated_at, date(raw.created_at)),
    preparedAt: date(current?.created_at || raw.created_at),
    sentAt: raw.sent_at ? date(raw.sent_at) : undefined,
    signedAt: raw.signed_at ? date(raw.signed_at) : undefined,
    signatureDueAt: text(raw.due_date).slice(0, 10) || undefined,
    signatoryName:
      text(signers[0]?.name) || text(metadata.signatory_name) || "Da definire",
    operatorId: text(raw.updated_by || raw.created_by || raw.owner_user_id),
    documentName: text(metadata.document_name) || undefined,
    documentReference: text(metadata.document_reference) || undefined,
    notes: text(raw.internal_notes) || undefined,
    sendHistory: records(raw.send_events).map((event) => ({
      id: event.id,
      kind: (text(event.event_kind) || "invio") as "invio" | "reinvio" | "promemoria",
      method: (text(event.method) || "Altro") as CommercialContract["sendHistory"][number]["method"],
      sentAt: date(event.created_at),
      operatorId: text(event.actor_id),
      note: text(event.note) || undefined,
    })),
    visibility:
      text(metadata.visibility) === "client" ? "client" : "internal",
    parentContractId: text(raw.parent_contract_id) || undefined,
    replacedById: text(raw.replaced_by_id) || undefined,
    archivedAt: raw.archived_at ? date(raw.archived_at) : undefined,
  };
}

export function mapAuthorityInvoice(raw: Raw): CommercialInvoice {
  const items = records(raw.items);
  const taxable = number(raw.subtotal);
  return {
    id: raw.id,
    recordVersion: Math.max(1, number(raw.optimistic_version)),
    code: text(raw.invoice_number) || raw.id,
    kind: text(raw.type) === "credit_note" ? "credit_note" : "invoice",
    status: invoiceStatus[text(raw.status)] || "Bozza",
    customerId: text(raw.company_id),
    orderId: text(raw.order_id),
    paymentIds: Array.isArray(raw.payment_ids) ? raw.payment_ids.map(String) : [],
    refundIds: Array.isArray(raw.refund_ids) ? raw.refund_ids.map(String) : [],
    lines: items.map((item) => ({
      id: item.id,
      serviceId: text(item.service_id) || undefined,
      description:
        text(item.service_description_snapshot) ||
        text(item.description) ||
        text(item.service_name_snapshot) ||
        text(item.name),
      quantity: number(item.quantity),
      unitPrice: number(item.unit_price),
      discount: number(item.discount),
    })),
    taxableAmount: taxable,
    vatRate: taxable > 0 ? (number(raw.tax_total) / taxable) * 100 : 0,
    vatAmount: number(raw.tax_total),
    total: number(raw.total),
    dueAt: text(raw.due_date).slice(0, 10),
    issuedAt: text(raw.issue_date).slice(0, 10) || undefined,
    notes: text(raw.credit_reason || raw.internal_notes) || undefined,
    parentInvoiceId: text(raw.parent_invoice_id) || undefined,
    createdAt: date(raw.created_at),
    updatedAt: date(raw.updated_at, date(raw.created_at)),
    archivedAt: raw.archived_at ? date(raw.archived_at) : undefined,
  };
}

export function mapAuthorityRenewal(raw: Raw): CommercialRenewal {
  const recurring = (raw.recurring_service &&
    typeof raw.recurring_service === "object"
      ? raw.recurring_service
      : {}) as Raw;
  return {
    id: raw.id,
    recordVersion: Math.max(1, number(raw.optimistic_version)),
    customerId: text(raw.company_id),
    serviceId: text(recurring.service_id),
    planId: text(recurring.plan_id),
    planName: text(recurring.plan_name_snapshot || raw.title),
    sourceOrderId: text(raw.source_order_id),
    sourceContractId: text(recurring.source_contract_id) || undefined,
    salespersonId: text(raw.salesperson_id),
    projectId: text(raw.project_id) || undefined,
    recurrence: text(raw.recurrence) === "monthly" ? "monthly" : "annual",
    renewalRequired: raw.renewal_required === true,
    priceSnapshot: number(raw.amount),
    includedSnapshot: Array.isArray(raw.included_snapshot)
      ? raw.included_snapshot.map(String)
      : [],
    activatedAt: date(raw.activated_at || raw.created_at),
    nextDueAt: text(raw.due_date).slice(0, 10),
    mode: text(raw.management_mode) === "automatic" ? "automatic" : "manual",
    ownerId: text(raw.owner_user_id || raw.salesperson_id),
    status: renewalStatus[text(raw.status)] || "Attivo",
    renewalOrderId: text(raw.renewal_order_id) || undefined,
    renewalPaymentId: text(raw.renewal_payment_id) || undefined,
    history: records(raw.history).map((entry) => ({
      id: entry.id,
      kind: text(entry.event_type).includes("reminder")
        ? "promemoria"
        : text(entry.event_type).includes("order")
          ? "ordine"
          : text(entry.event_type).includes("activated")
            ? "attivazione"
            : "stato",
      date: date(entry.created_at),
      detail:
        text(
          entry.metadata && typeof entry.metadata === "object"
            ? (entry.metadata as Record<string, unknown>).message
            : undefined,
        ) || text(entry.event_type),
      actorId: text(entry.actor_id),
    })),
    createdAt: date(raw.created_at),
    updatedAt: date(raw.updated_at, date(raw.created_at)),
    archivedAt: raw.deleted_at ? date(raw.deleted_at) : undefined,
  };
}

export async function loadDocumentRevenueState(signal?: AbortSignal) {
  const state = await apiFetch<AuthorityState>(
    "/tenant/doflow/document-revenue/state",
    { signal },
  );
  return {
    quotes: state.quotes.map(mapAuthorityQuote),
    contracts: state.contracts.map(mapAuthorityContract),
    invoices: state.invoices.map(mapAuthorityInvoice),
    renewals: state.renewals.map(mapAuthorityRenewal),
    customerFinance: state.customer_finance.map((row) => ({
      customerId: text(row.company_id),
      grossInvoiced: number(row.gross_invoiced),
      credits: number(row.credits),
      netInvoiced: number(row.net_invoiced),
      netPaid: number(row.net_paid),
    })),
    redacted: state.redacted,
  };
}

function mutate<T>(path: string, method: string, body: unknown, key: string) {
  return apiFetch<T>(path, {
    method,
    headers: headers(key),
    body: JSON.stringify(body),
  });
}

export const documentRevenueApi = {
  state: loadDocumentRevenueState,
  summary() {
    return apiFetch<DocumentRevenueSummary>(
      "/tenant/doflow/document-revenue/summary",
    );
  },
  createQuote(body: unknown, key = operationKey("quote-create")) {
    return mutate<{ id: string }>("/tenant/doflow/document-revenue/quotes", "POST", body, key);
  },
  updateQuote(id: string, body: unknown, key = operationKey("quote-update")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/quotes/${id}`, "PATCH", body, key);
  },
  quoteVersion(id: string, key = operationKey("quote-version")) {
    return mutate<{ id: string; existing: boolean }>(`/tenant/doflow/document-revenue/quotes/${id}/versions`, "POST", {}, key);
  },
  generateContract(body: unknown, key = operationKey("contract-generate")) {
    return mutate<{ id: string; existing: boolean }>("/tenant/doflow/document-revenue/contracts", "POST", body, key);
  },
  updateContract(id: string, body: unknown, key = operationKey("contract-update")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/contracts/${id}`, "PATCH", body, key);
  },
  sendContract(id: string, body: unknown, key = operationKey("contract-send")) {
    return mutate<{ attemptId: string }>(`/tenant/doflow/document-revenue/contracts/${id}/send`, "POST", body, key);
  },
  signContract(id: string, body: unknown, key = operationKey("contract-sign")) {
    return mutate<{ eventId: string; existing: boolean }>(`/tenant/doflow/document-revenue/contracts/${id}/signatures`, "POST", body, key);
  },
  contractVersion(id: string, key = operationKey("contract-version")) {
    return mutate<{ id: string; existing: boolean }>(`/tenant/doflow/document-revenue/contracts/${id}/versions`, "POST", {}, key);
  },
  archiveContract(id: string, version: number, key = operationKey("contract-archive")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/contracts/${id}`, "DELETE", { version }, key);
  },
  createInvoice(body: unknown, key = operationKey("invoice-create")) {
    return mutate<{ id: string; existing: boolean }>("/tenant/doflow/document-revenue/invoices", "POST", body, key);
  },
  transitionInvoice(id: string, status: CommercialInvoice["status"], key = operationKey("invoice-transition")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/invoices/${id}/transition`, "POST", { status }, key);
  },
  creditNote(id: string, amount: number, reason: string, key = operationKey("credit-note")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/invoices/${id}/credit-notes`, "POST", { amount, reason }, key);
  },
  activateRenewal(orderId: string, itemId: string, key = operationKey("renewal-activate")) {
    return mutate<{ id: string; existing: boolean }>("/tenant/doflow/document-revenue/renewals", "POST", { orderId, itemId }, key);
  },
  updateRenewal(id: string, body: unknown, key = operationKey("renewal-update")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/renewals/${id}`, "PATCH", body, key);
  },
  remindRenewal(id: string, key = operationKey("renewal-reminder")) {
    return mutate<{ activityId: string; existing: boolean }>(`/tenant/doflow/document-revenue/renewals/${id}/reminders`, "POST", {}, key);
  },
  renewalOrder(id: string, key = operationKey("renewal-order")) {
    return mutate<{ orderId: string; activityId: string; existing: boolean }>(`/tenant/doflow/document-revenue/renewals/${id}/order`, "POST", {}, key);
  },
  archiveRenewal(id: string, version: number, key = operationKey("renewal-archive")) {
    return mutate<{ id: string }>(`/tenant/doflow/document-revenue/renewals/${id}`, "DELETE", { version }, key);
  },
};
