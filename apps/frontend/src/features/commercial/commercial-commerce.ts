export const serviceCategories = ["Siti web", "E-commerce", "Software", "Gestionale SaaS", "Marketing", "Assistenza", "Altro"] as const
export type ServiceCategory = (typeof serviceCategories)[number]

export const saleOrigins = ["Commerciale", "Acquisto diretto DoFlow", "Demo commerciale", "Referral", "Campagna", "Altro"] as const
export type SaleOrigin = (typeof saleOrigins)[number]

export const orderStatuses = ["Bozza", "Confermato", "Acconto richiesto", "Parzialmente pagato", "Pagato", "Annullato", "Rimborsato"] as const
export type OrderStatus = (typeof orderStatuses)[number]

export const paymentMethods = ["Bonifico", "Carta", "Contanti", "PayPal", "Stripe", "Altro"] as const
export const paymentTypes = ["Acconto", "Saldo", "Rata", "Rimborso"] as const

const paymentStatusLabels: Record<string, string> = {
  not_started: "Non iniziato",
  partial: "Parzialmente pagato",
  paid: "Pagato",
  refunded_partial: "Parzialmente rimborsato",
  refunded: "Rimborsato",
  overdue: "Scaduto",
}

export function commercePaymentStatusLabel(value?: string | null) {
  return value ? paymentStatusLabels[value] ?? value.replaceAll("_", " ") : "Non iniziato"
}

export type ServicePromotion = { id: string; name: string; kind: "percentage" | "fixed"; value: number; active: boolean; validFrom?: string; validUntil?: string; combinable?: boolean }
export type ServiceExtra = { id: string; name: string; price: number; active: boolean; version?: number }
export type ServiceProjectTemplate = { name: string; projectType: "website" | "ecommerce" | "landing" | "branding" | "marketing" | "maintenance" | "consulting" | "software" | "saas" | "other"; phases: string[] }
export type ServiceBillingPlan = {
  id: string
  name: string
  description: string
  oneTimePrice: number
  recurringPrice: number
  recurrence: "monthly" | "annual"
  renewal: "required" | "optional"
  included: string[]
  active: boolean
}
export type CommercialService = {
  id: string
  version: number
  name: string
  category: ServiceCategory
  description: string
  price: number
  currency?: string
  unit?: string
  taxRate?: number
  billingType?: "one_time" | "recurring" | "mixed"
  sortOrder?: number
  status: "active" | "inactive"
  availability: "available" | "limited" | "unavailable"
  deposit: number
  balance: number
  installments: number
  promotions: ServicePromotion[]
  extras: ServiceExtra[]
  renewal: { enabled: boolean; interval: "monthly" | "quarterly" | "annual"; price: number }
  billingPlans?: ServiceBillingPlan[]
  projectTemplate?: ServiceProjectTemplate
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommercialSale = {
  id: string
  version: number
  customerId?: string
  leadId?: string
  opportunityId?: string
  serviceId: string
  salespersonId: string
  origin: SaleOrigin
  value: number
  cost?: number
  currency?: string
  date: string
  status: "Bozza" | "In trattativa" | "Vinta" | "Persa" | "Annullata"
  dealId: string
  orderId?: string
  projectId?: string
  notes?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommercialOrderItem = {
  id: string
  serviceId: string
  name: string
  descriptionSnapshot?: string
  categorySnapshot?: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate?: number
  taxAmount?: number
  currency?: string
  catalogVersion?: number
  lineSubtotal?: number
  lineTotal?: number
  planId?: string
  planName?: string
  oneTimePrice?: number
  recurringPrice?: number
  firstPeriodTotal?: number
  renewalPrice?: number
  recurrence?: "monthly" | "annual"
  renewalRequired?: boolean
  includedSnapshot?: string[]
  nextDueAt?: string
}
export type CommercialOrder = {
  id: string
  version: number
  idempotencyKey?: string
  code: string
  customerId: string
  saleId?: string
  leadId?: string
  opportunityId?: string
  dealId?: string
  items: CommercialOrderItem[]
  salespersonId: string
  discount: number
  subtotal?: number
  taxTotal?: number
  total: number
  invoicedAmount?: number
  deposit: number
  balance: number
  currency?: string
  grossCollected?: number
  refundedTotal?: number
  netCollected?: number
  residual?: number
  paymentStatus?: "not_started" | "partial" | "paid" | "refunded_partial" | "refunded" | "overdue"
  installments: number
  projectId?: string
  administrativeStatus: OrderStatus
  orderDate: string
  dueDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommercialPayment = {
  id: string
  version: number
  orderId: string
  amount: number
  date: string
  method: (typeof paymentMethods)[number]
  reference: string
  type: (typeof paymentTypes)[number]
  status: "Da confermare" | "Confermato" | "Fallito" | "Annullato"
  effectiveDate?: string
  originalPaymentId?: string
  refundReason?: string
  operatorId?: string
  salespersonId?: string
  notes?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export const contractStatuses = ["Da preparare", "Preparato", "Inviato", "In attesa di firma", "Firmato", "Rifiutato", "Scaduto", "Sostituito", "Archiviato"] as const
export type ContractStatus = (typeof contractStatuses)[number]
export const contractSendMethods = ["Email", "WhatsApp", "Consegna manuale", "Altro"] as const
export type ContractSendAttempt = { id: string; kind: "invio" | "reinvio" | "promemoria"; method: (typeof contractSendMethods)[number]; sentAt: string; operatorId: string; note?: string }
export type CommercialContract = {
  id: string
  recordVersion?: number
  code: string
  title: string
  version: number
  status: ContractStatus
  customerId: string
  leadId?: string
  saleId?: string
  orderId: string
  quoteId?: string
  serviceIds: string[]
  salespersonId: string
  projectId?: string
  createdAt: string
  updatedAt: string
  preparedAt?: string
  sentAt?: string
  signedAt?: string
  signatureDueAt?: string
  signatoryName: string
  operatorId: string
  documentName?: string
  documentReference?: string
  notes?: string
  sendHistory: ContractSendAttempt[]
  visibility: "internal" | "client"
  parentContractId?: string
  replacedById?: string
  archivedAt?: string
}

export const renewalStatuses = ["Attivo", "In scadenza", "Da rinnovare", "Promemoria inviato", "Pagato", "Scaduto", "Sospeso", "Annullato"] as const
export type RenewalStatus = (typeof renewalStatuses)[number]
export type RenewalHistoryEntry = { id: string; kind: "attivazione" | "promemoria" | "ordine" | "pagamento" | "stato"; date: string; detail: string; actorId: string }
export type CommercialRenewal = {
  id: string
  recordVersion?: number
  customerId: string
  serviceId: string
  planId: string
  planName: string
  sourceOrderId: string
  sourceContractId?: string
  salespersonId: string
  projectId?: string
  recurrence: "monthly" | "annual"
  renewalRequired: boolean
  priceSnapshot: number
  includedSnapshot: string[]
  activatedAt: string
  nextDueAt: string
  mode: "automatic" | "manual"
  ownerId: string
  status: RenewalStatus
  renewalOrderId?: string
  renewalPaymentId?: string
  reminderActivityId?: string
  history: RenewalHistoryEntry[]
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommerceSettings = {
  requireSignedContractForProject: boolean
  requireDepositForProject: boolean
  supplierProfile: {
    brandName: string
    legalHolder: string
    vatNumber: string
    address: string
    email: string
    phone: string
    legalName?: string
    taxCode?: string
    postalCode?: string
    city?: string
    province?: string
    country?: string
    certifiedEmail?: string
    sdiCode?: string
    website?: string
    logoUrl?: string
  }
  currency?: "EUR"
  defaultVatRate?: number
  documentSettings?: { quotePrefix: string; quoteValidityDays: number; paymentTerms: string; bankDetails: string; defaultNotes: string }
  salesSettings?: { defaultDepositPercent: number; enabledPaymentMethods: string[]; renewalReminderDays: number }
}

export const defaultCommerceSettings: CommerceSettings = {
  requireSignedContractForProject: true,
  requireDepositForProject: true,
  supplierProfile: { brandName: "DoFlow", legalHolder: "", vatNumber: "", address: "", email: "", phone: "", legalName: "", taxCode: "", postalCode: "", city: "", province: "", country: "Italia", certifiedEmail: "", sdiCode: "", website: "" },
  currency: "EUR",
  defaultVatRate: 22,
  documentSettings: { quotePrefix: "DF-PREV", quoteValidityDays: 30, paymentTerms: "Bonifico entro la scadenza indicata", bankDetails: "", defaultNotes: "" },
  salesSettings: { defaultDepositPercent: 50, enabledPaymentMethods: ["Bonifico", "Carta", "Contanti", "PayPal"], renewalReminderDays: 30 },
}

export function normalizeCommerceSettings(settings?: Partial<CommerceSettings>): CommerceSettings {
  return { ...defaultCommerceSettings, ...settings, supplierProfile: { ...defaultCommerceSettings.supplierProfile, ...(settings?.supplierProfile ?? {}) }, documentSettings: { ...defaultCommerceSettings.documentSettings!, ...(settings?.documentSettings ?? {}) }, salesSettings: { ...defaultCommerceSettings.salesSettings!, ...(settings?.salesSettings ?? {}) } }
}

export function calculateServicePlanTotal(service: CommercialService, plan?: ServiceBillingPlan) {
  return service.price + (plan?.recurringPrice ?? 0)
}

export function serviceRequiresAnnualPlan(service: CommercialService) {
  return Boolean(service.billingPlans?.some((plan) => plan.active && plan.renewal === "required"))
}

/** Proiezione read-only dei valori canonici già calcolati e restituiti dal backend. */
export function orderFinancialsFromServer(order: CommercialOrder) {
  const cancelled = order.administrativeStatus === "Annullato"
  const sold = cancelled ? 0 : Math.max(0, order.total)
  const grossCollected = Math.max(0, order.grossCollected ?? 0)
  const refunded = Math.max(0, order.refundedTotal ?? 0)
  const netCollected = Math.max(0, order.netCollected ?? 0)
  const residual = cancelled ? 0 : Math.max(0, order.residual ?? 0)
  const invoiced = Math.max(0, Math.min(order.invoicedAmount ?? 0, sold))
  const status = cancelled ? "Annullato" : commercePaymentStatusLabel(order.paymentStatus)
  return { paid: netCollected, grossCollected, refunded, netCollected, invoiced, sold, residual, toInvoice: Math.max(0, sold - invoiced), status }
}

export function refundableAmount(payment: CommercialPayment, payments: CommercialPayment[]) {
  if (payment.type === "Rimborso" || payment.status !== "Confermato" || payment.archivedAt) return 0
  const refunded = payments.filter((item) => !item.archivedAt && item.status === "Confermato" && item.type === "Rimborso" && item.originalPaymentId === payment.id).reduce((sum, item) => sum + Math.abs(item.amount), 0)
  return Math.max(0, Math.abs(payment.amount) - refunded)
}

/** Effimero: serve soltanto a comporre il draft; lo snapshot autorevole nasce nel backend. */
export function createOrderDraftItem(service: CommercialService, planId?: string): CommercialOrderItem {
  const plan = service.billingPlans?.find((item) => item.id === planId && item.active)
  const firstPeriodTotal = plan ? plan.oneTimePrice + plan.recurringPrice : service.price
  return {
    id: crypto.randomUUID(), serviceId: service.id, name: plan ? `${service.name} · ${plan.name}` : service.name, quantity: 1,
    unitPrice: firstPeriodTotal, discount: 0, planId: plan?.id, planName: plan?.name, oneTimePrice: plan?.oneTimePrice,
    recurringPrice: plan?.recurringPrice, firstPeriodTotal, renewalPrice: plan?.recurringPrice, recurrence: plan?.recurrence,
    renewalRequired: plan?.renewal === "required", includedSnapshot: plan ? [...plan.included] : undefined,
  }
}

/** Stima UI non persistita; il totale canonico viene sempre ricalcolato dal backend. */
export function estimateOrderDraftTotal(items: CommercialOrderItem[], discount: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice) - Math.max(0, item.discount), 0)
  return Math.max(0, subtotal - Math.max(0, discount))
}
