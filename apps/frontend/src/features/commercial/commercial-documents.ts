export const quoteStatuses = ["Bozza", "Inviato", "Visualizzato", "Accettato", "Rifiutato", "Scaduto", "Sostituito"] as const
export type QuoteStatus = (typeof quoteStatuses)[number]
export type QuoteLine = { id: string; serviceId?: string; description: string; quantity: number; unitPrice: number; discount: number }
export type CommercialQuote = {
  id: string; code: string; version: number; recordVersion?: number; status: QuoteStatus; leadId?: string; customerId?: string; salespersonId: string
  lines: QuoteLine[]; subtotal: number; discount: number; vatRate: number; vatAmount: number; total: number; validUntil: string
  conditions: string; notes?: string; createdAt: string; updatedAt: string; sentAt?: string; viewedAt?: string; acceptedAt?: string
  parentQuoteId?: string; replacedById?: string; archivedAt?: string
}

export const invoiceStatuses = ["Bozza", "Proforma", "Emessa esternamente", "Parzialmente pagata", "Pagata", "Scaduta", "Annullata", "Stornata"] as const
export type InvoiceStatus = (typeof invoiceStatuses)[number]
export type CommercialInvoice = {
  id: string; recordVersion?: number; code: string; kind: "invoice" | "credit_note"; status: InvoiceStatus; customerId: string; orderId: string
  paymentIds: string[]; refundIds: string[]; lines: QuoteLine[]; taxableAmount: number; vatRate: number; vatAmount: number
  total: number; dueAt: string; issuedAt?: string; notes?: string; parentInvoiceId?: string; createdAt: string; updatedAt: string; archivedAt?: string
}

export type FiscalAdapter = { provider: "Provider fiscale"; enabled: false; mode: "adapter-only"; warning: string }
export const fiscalAdapter: FiscalAdapter = { provider: "Provider fiscale", enabled: false, mode: "adapter-only", warning: "Documento persistito dal backend locale e non trasmesso allo SDI." }
