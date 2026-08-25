import type {
  CommercialOrder,
  CommercialPayment,
  CommercialSale,
  CommercialService,
} from "@/features/commercial/commercial-commerce";
import { apiFetch } from "@/lib/api";

type Raw = Record<string, unknown> & { id: string };
type Page = { items: Raw[]; redacted?: boolean };

const text = (value: unknown) => String(value ?? "");
const number = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};
const date = (value: unknown, fallback = new Date(0).toISOString()) => {
  const result = new Date(String(value || fallback));
  return Number.isNaN(result.getTime()) ? fallback : result.toISOString();
};
const operationKey = (scope: string) => `${scope}:${crypto.randomUUID()}`;
const headers = (key: string) => ({ "Idempotency-Key": key });

export type CommerceEconomics = {
  sold: number;
  orderCount: number;
  ordered: number;
  grossCollected: number;
  refunded: number;
  netCollected: number;
  residual: number;
  openOrders: number;
  payingCustomers: number;
  trend: Array<{ period: string; ordered: number; netCollected: number; refunded: number }>;
};

export type ProjectCommerceEconomics = {
  summary: {
    total: number;
    grossCollected: number;
    refunded: number;
    netCollected: number;
    residual: number;
    status: string;
  };
  orders: CommercialOrder[];
  payments: CommercialPayment[];
  deadlines: Array<{ id: string; title: string; type: string; status: string; amount: number; currency: string; dueDate?: string }>;
};

export type CustomerCommerceEconomics = {
  summary: {
    orderCount: number;
    ordered: number;
    grossCollected: number;
    refunded: number;
    netCollected: number;
    residual: number;
  };
  sales: CommercialSale[];
  orders: CommercialOrder[];
  payments: CommercialPayment[];
  projects: Array<{ id: string; name: string; status: string; orderId?: string }>;
};

export function mapCommerceService(service: Raw): CommercialService {
  return {
    id: service.id,
    version: Math.max(1, number(service.version)),
    name: text(service.name),
    category: (text(service.category) || "Altro") as CommercialService["category"],
    description: text(service.description),
    price: number(service.price),
    currency: text(service.currency) || undefined,
    unit: text(service.unit) || undefined,
    taxRate: number(service.tax_rate),
    billingType: (text(service.billing_type) || undefined) as CommercialService["billingType"],
    sortOrder: number(service.sort_order),
    status: text(service.status) === "inactive" ? "inactive" : "active",
    availability: (text(service.availability) || "available") as CommercialService["availability"],
    deposit: number(service.deposit),
    balance: number(service.balance),
    installments: Math.max(1, number(service.installments)),
    promotions: Array.isArray(service.promotions)
      ? service.promotions.map((promotion) => {
        const raw = promotion as Raw;
        return {
          id: raw.id,
          name: text(raw.name),
          kind: text(raw.kind) === "percentage" ? "percentage" as const : "fixed" as const,
          value: number(raw.value),
          active: raw.active !== false,
          validFrom: text(raw.valid_from) || undefined,
          validUntil: text(raw.valid_until) || undefined,
          combinable: raw.combinable === true,
        };
      })
      : [],
    extras: Array.isArray(service.extras)
      ? service.extras.map((extra) => {
        const raw = extra as Raw;
        return { id: raw.id, name: text(raw.name), price: number(raw.price), active: raw.active !== false, version: number(raw.version) || 1 };
      })
      : [],
    renewal: {
      enabled: service.renewal_enabled === true,
      interval: (text(service.renewal_interval) || "annual") as CommercialService["renewal"]["interval"],
      price: number(service.renewal_price),
    },
    billingPlans: Array.isArray(service.billing_plans)
      ? service.billing_plans.map((plan) => {
        const raw = plan as Raw;
        return {
          id: raw.id,
          name: text(raw.name),
          description: text(raw.description),
          oneTimePrice: number(raw.one_time_price),
          recurringPrice: number(raw.recurring_price),
          recurrence: text(raw.recurrence) === "monthly" ? "monthly" as const : "annual" as const,
          renewal: text(raw.renewal) === "required" ? "required" as const : "optional" as const,
          included: Array.isArray(raw.included) ? raw.included.map(String) : [],
          active: raw.active !== false,
        };
      })
      : [],
    projectTemplate: service.project_template_name
      ? {
        name: text(service.project_template_name),
        projectType: (text(service.project_template_type) || "other") as NonNullable<CommercialService["projectTemplate"]>["projectType"],
        phases: Array.isArray(service.project_template_phases) ? service.project_template_phases.map(String) : [],
      }
      : undefined,
    createdAt: date(service.created_at),
    updatedAt: date(service.updated_at, date(service.created_at)),
    archivedAt: service.deleted_at ? date(service.deleted_at) : undefined,
  };
}

export function mapCommerceSale(sale: Raw): CommercialSale {
  return {
    id: sale.id,
    version: Math.max(1, number(sale.version)),
    customerId: text(sale.company_id) || undefined,
    leadId: text(sale.lead_id) || undefined,
    opportunityId: text(sale.opportunity_id) || undefined,
    serviceId: text(sale.service_id),
    salespersonId: text(sale.salesperson_id),
    origin: (text(sale.origin) || "Commerciale") as CommercialSale["origin"],
    value: number(sale.value),
    cost: sale.cost == null ? undefined : number(sale.cost),
    currency: text(sale.currency) || undefined,
    date: text(sale.sale_date),
    status: (text(sale.status) || "Bozza") as CommercialSale["status"],
    dealId: text(sale.deal_id),
    orderId: text(sale.order_id) || undefined,
    projectId: text(sale.project_id) || undefined,
    notes: text(sale.notes) || undefined,
    createdAt: date(sale.created_at),
    updatedAt: date(sale.updated_at, date(sale.created_at)),
    archivedAt: sale.deleted_at ? date(sale.deleted_at) : undefined,
  };
}

export function mapCommerceOrder(order: Raw): CommercialOrder {
  return {
    id: order.id,
    version: Math.max(1, number(order.version)),
    idempotencyKey: text(order.idempotency_key) || undefined,
    code: text(order.code),
    customerId: text(order.company_id),
    saleId: text(order.sale_id) || undefined,
    leadId: text(order.lead_id) || undefined,
    opportunityId: text(order.opportunity_id) || undefined,
    dealId: text(order.deal_id) || undefined,
    salespersonId: text(order.salesperson_id),
    items: Array.isArray(order.items)
      ? order.items.map((item) => {
        const raw = item as Raw;
        return {
          id: raw.id,
          serviceId: text(raw.service_id),
          name: text(raw.service_name_snapshot),
          descriptionSnapshot: text(raw.service_description_snapshot) || undefined,
          categorySnapshot: text(raw.service_category_snapshot) || undefined,
          quantity: number(raw.quantity),
          unitPrice: number(raw.unit_price_snapshot),
          discount: number(raw.discount),
          taxRate: number(raw.tax_rate_snapshot),
          taxAmount: number(raw.tax_amount),
          currency: text(raw.currency_snapshot) || undefined,
          catalogVersion: number(raw.catalog_version_snapshot) || 1,
          lineSubtotal: number(raw.line_subtotal),
          lineTotal: number(raw.line_total),
          planId: text(raw.plan_id) || undefined,
          planName: text(raw.plan_name_snapshot) || undefined,
          oneTimePrice: raw.one_time_price_snapshot == null ? undefined : number(raw.one_time_price_snapshot),
          recurringPrice: raw.recurring_price_snapshot == null ? undefined : number(raw.recurring_price_snapshot),
          firstPeriodTotal: raw.first_period_total == null ? undefined : number(raw.first_period_total),
          renewalPrice: raw.renewal_price_snapshot == null ? undefined : number(raw.renewal_price_snapshot),
          recurrence: text(raw.recurrence) === "monthly" ? "monthly" as const : text(raw.recurrence) === "annual" ? "annual" as const : undefined,
          renewalRequired: raw.renewal_required == null ? undefined : raw.renewal_required === true,
          includedSnapshot: Array.isArray(raw.included_snapshot) ? raw.included_snapshot.map(String) : undefined,
          nextDueAt: text(raw.next_due_at) || undefined,
        };
      })
      : [],
    currency: text(order.currency) || undefined,
    discount: number(order.discount),
    subtotal: number(order.subtotal),
    taxTotal: number(order.tax_total),
    total: number(order.total),
    deposit: number(order.deposit),
    balance: number(order.balance),
    grossCollected: number(order.gross_collected),
    refundedTotal: number(order.refunded_total),
    netCollected: number(order.net_collected),
    residual: number(order.residual),
    paymentStatus: (text(order.payment_status) || "not_started") as CommercialOrder["paymentStatus"],
    installments: Math.max(1, number(order.installments)),
    projectId: text(order.project_id) || undefined,
    administrativeStatus: (text(order.administrative_status) || "Bozza") as CommercialOrder["administrativeStatus"],
    orderDate: text(order.order_date),
    dueDate: text(order.due_date) || undefined,
    notes: text(order.notes) || undefined,
    createdAt: date(order.created_at),
    updatedAt: date(order.updated_at, date(order.created_at)),
    archivedAt: order.deleted_at ? date(order.deleted_at) : undefined,
  };
}

export function mapCommercePayment(payment: Raw): CommercialPayment {
  const rawStatus = text(payment.status).toLowerCase();
  const method: Record<string, CommercialPayment["method"]> = {
    bank_transfer: "Bonifico", cash: "Contanti", card: "Carta",
    paypal: "PayPal", stripe: "Stripe", other: "Altro",
  };
  return {
    id: payment.id,
    version: Math.max(1, number(payment.version)),
    orderId: text(payment.order_id),
    amount: number(payment.amount),
    date: text(payment.payment_date) || date(payment.created_at).slice(0, 10),
    method: method[text(payment.method).toLowerCase()] || "Altro",
    reference: text(payment.reference),
    type: text(payment.payment_type) === "refund" ? "Rimborso" : "Saldo",
    originalPaymentId: text(payment.original_payment_id) || undefined,
    refundReason: text(payment.refund_reason) || undefined,
    status: rawStatus === "confirmed" ? "Confermato" : rawStatus === "failed" ? "Fallito" : rawStatus === "cancelled" ? "Annullato" : "Da confermare",
    effectiveDate: text(payment.payment_date) || undefined,
    operatorId: text(payment.created_by) || undefined,
    notes: text(payment.notes) || undefined,
    createdAt: date(payment.created_at),
    updatedAt: date(payment.updated_at, date(payment.created_at)),
    archivedAt: payment.deleted_at ? date(payment.deleted_at) : undefined,
  };
}

function mapEconomics(raw: Record<string, unknown>): CommerceEconomics {
  return {
    sold: number(raw.sold),
    orderCount: number(raw.order_count),
    ordered: number(raw.ordered),
    grossCollected: number(raw.gross_collected),
    refunded: number(raw.refunded),
    netCollected: number(raw.net_collected),
    residual: number(raw.residual),
    openOrders: number(raw.open_orders),
    payingCustomers: number(raw.paying_customers),
    trend: Array.isArray(raw.trend) ? raw.trend.map((entry) => {
      const row = entry as Record<string, unknown>;
      return { period: text(row.period), ordered: number(row.ordered), netCollected: number(row.net_collected), refunded: number(row.refunded) };
    }) : [],
  };
}

export const commerceApi = {
  async state() {
    const [services, sales, orders, payments] = await Promise.all([
      apiFetch<Page>("/tenant/doflow/commerce/services"),
      apiFetch<Page>("/tenant/doflow/commerce/sales"),
      apiFetch<Page>("/tenant/doflow/commerce/orders"),
      apiFetch<Page>("/tenant/doflow/commerce/payments"),
    ]);
    return {
      services: services.items.map(mapCommerceService),
      sales: sales.items.map(mapCommerceSale),
      orders: orders.items.map(mapCommerceOrder),
      payments: payments.items.map(mapCommercePayment),
      redacted: payments.redacted === true,
    };
  },
  async order(id: string) {
    return mapCommerceOrder(await apiFetch<Raw>(`/tenant/doflow/commerce/orders/${id}`));
  },
  async payments() {
    const page = await apiFetch<Page>("/tenant/doflow/commerce/payments");
    return { items: page.items.map(mapCommercePayment), redacted: page.redacted === true };
  },
  async history(aggregateType: "service" | "sale" | "order" | "payment" | "refund", aggregateId: string) {
    return apiFetch<{ items: Array<Record<string, unknown> & { id: string; event_type: string; created_at: string; actor_name?: string }> }>(`/tenant/doflow/commerce/history/${aggregateType}/${aggregateId}`);
  },
  async economics(start?: string, end?: string, salespersonId?: string) {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (salespersonId) params.set("salespersonId", salespersonId);
    const query = params.size ? `?${params}` : "";
    return mapEconomics(await apiFetch<Record<string, unknown>>(`/tenant/doflow/commerce/economics/summary${query}`));
  },
  async projectEconomics(projectId: string): Promise<ProjectCommerceEconomics> {
    const raw = await apiFetch<{
      summary: Record<string, unknown>;
      orders: Raw[];
      payments: Raw[];
      deadlines: Raw[];
    }>(`/tenant/doflow/commerce/projects/${projectId}/economics`);
    return {
      summary: {
        total: number(raw.summary.total),
        grossCollected: number(raw.summary.grossCollected),
        refunded: number(raw.summary.refunded),
        netCollected: number(raw.summary.netCollected),
        residual: number(raw.summary.residual),
        status: text(raw.summary.status),
      },
      orders: raw.orders.map(mapCommerceOrder),
      payments: raw.payments.map(mapCommercePayment),
      deadlines: raw.deadlines.map((deadline) => ({
        id: deadline.id,
        title: text(deadline.title),
        type: text(deadline.type),
        status: text(deadline.status),
        amount: number(deadline.amount),
        currency: text(deadline.currency) || "EUR",
        dueDate: text(deadline.due_date) || undefined,
      })),
    };
  },
  async customerEconomics(customerId: string): Promise<CustomerCommerceEconomics> {
    const raw = await apiFetch<{
      summary: Record<string, unknown>;
      sales: Raw[];
      orders: Raw[];
      payments: Raw[];
      projects: Raw[];
    }>(`/tenant/doflow/commerce/customers/${customerId}/economics`);
    return {
      summary: {
        orderCount: number(raw.summary.order_count),
        ordered: number(raw.summary.ordered),
        grossCollected: number(raw.summary.gross_collected),
        refunded: number(raw.summary.refunded),
        netCollected: number(raw.summary.net_collected),
        residual: number(raw.summary.residual),
      },
      sales: raw.sales.map(mapCommerceSale),
      orders: raw.orders.map(mapCommerceOrder),
      payments: raw.payments.map(mapCommercePayment),
      projects: raw.projects.map((project) => ({
        id: project.id,
        name: text(project.name),
        status: text(project.status),
        orderId: text(project.order_id) || undefined,
      })),
    };
  },
  createService(body: unknown) {
    const key = operationKey("service-create");
    return apiFetch<Raw>("/tenant/doflow/commerce/services", { method: "POST", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceService);
  },
  updateService(id: string, body: unknown) {
    const key = operationKey("service-update");
    return apiFetch<Raw>(`/tenant/doflow/commerce/services/${id}`, { method: "PATCH", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceService);
  },
  archiveService(id: string, version: number) {
    const key = operationKey("service-archive");
    return apiFetch(`/tenant/doflow/commerce/services/${id}`, { method: "DELETE", headers: headers(key), body: JSON.stringify({ version }) });
  },
  restoreService(id: string) {
    const key = operationKey("service-restore");
    return apiFetch<Raw>(`/tenant/doflow/commerce/services/${id}/restore`, { method: "POST", headers: headers(key), body: "{}" }).then(mapCommerceService);
  },
  createSale(body: unknown) {
    const key = operationKey("sale-create");
    return apiFetch<Raw>("/tenant/doflow/commerce/sales", { method: "POST", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceSale);
  },
  updateSale(id: string, body: unknown) {
    const key = operationKey("sale-update");
    return apiFetch<Raw>(`/tenant/doflow/commerce/sales/${id}`, { method: "PATCH", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceSale);
  },
  archiveSale(id: string, version: number) {
    const key = operationKey("sale-archive");
    return apiFetch(`/tenant/doflow/commerce/sales/${id}`, { method: "DELETE", headers: headers(key), body: JSON.stringify({ version }) });
  },
  createOrder(body: unknown, key = operationKey("order-create")) {
    return apiFetch<Raw>("/tenant/doflow/commerce/orders", { method: "POST", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceOrder);
  },
  updateOrder(id: string, body: unknown) {
    const key = operationKey("order-update");
    return apiFetch<Raw>(`/tenant/doflow/commerce/orders/${id}`, { method: "PATCH", headers: headers(key), body: JSON.stringify(body) }).then(mapCommerceOrder);
  },
  archiveOrder(id: string, version: number) {
    const key = operationKey("order-archive");
    return apiFetch(`/tenant/doflow/commerce/orders/${id}`, { method: "DELETE", headers: headers(key), body: JSON.stringify({ version }) });
  },
  restoreOrder(id: string) {
    const key = operationKey("order-restore");
    return apiFetch<Raw>(`/tenant/doflow/commerce/orders/${id}/restore`, { method: "POST", headers: headers(key), body: "{}" }).then(mapCommerceOrder);
  },
  createPayment(body: unknown) {
    const key = operationKey("payment-create");
    return apiFetch<{ payment: Raw; order: Raw }>("/tenant/doflow/commerce/payments", { method: "POST", headers: headers(key), body: JSON.stringify(body) });
  },
  createRefund(body: unknown) {
    const key = operationKey("refund-create");
    return apiFetch<{ refund: Raw; order: Raw }>("/tenant/doflow/commerce/refunds", { method: "POST", headers: headers(key), body: JSON.stringify(body) });
  },
  updatePayment(id: string, body: unknown) {
    const key = operationKey("payment-update");
    return apiFetch<{ payment: Raw; order: Raw }>(`/tenant/doflow/commerce/payments/${id}`, { method: "PATCH", headers: headers(key), body: JSON.stringify(body) });
  },
  archivePayment(id: string, version: number) {
    const key = operationKey("payment-archive");
    return apiFetch(`/tenant/doflow/commerce/payments/${id}`, { method: "DELETE", headers: headers(key), body: JSON.stringify({ version }) });
  },
  generateProject(orderId: string) {
    const key = operationKey("order-project");
    return apiFetch<{ ok: true; projectId: string; existing: boolean }>(`/tenant/doflow/commerce/orders/${orderId}/project`, { method: "POST", headers: headers(key), body: "{}" });
  },
};
