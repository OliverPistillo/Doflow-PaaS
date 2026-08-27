export const supportCategories = ["Sito web", "Dominio", "Hosting", "Email", "WordPress/CMS", "E-commerce", "Pagamenti", "Bug grafico", "Bug funzionale", "Prestazioni", "Sicurezza", "SEO tecnico", "Software", "Gestionale", "SaaS", "API/Integrazione", "Database", "Altro"] as const
export const supportPriorities = ["Bassa", "Media", "Alta", "Urgente", "Critica"] as const
export const supportSlaHoursByPriority: Record<(typeof supportPriorities)[number], number> = { Bassa: 72, Media: 24, Alta: 8, Urgente: 4, Critica: 1 }
export const supportStatuses = ["Nuovo", "Da valutare", "Assegnato", "In lavorazione", "In attesa cliente", "In attesa fornitore", "Bloccato", "In revisione", "Risolto", "Chiuso", "Riaperto", "Annullato"] as const

export type SupportCategory = (typeof supportCategories)[number]
export type SupportPriority = (typeof supportPriorities)[number]
export type SupportStatus = (typeof supportStatuses)[number]

export type SupportTicket = {
  id: string
  code: string
  title: string
  description: string
  customerId?: string
  projectId?: string
  service: string
  category: SupportCategory
  priority: SupportPriority
  impact: "Basso" | "Medio" | "Alto" | "Critico"
  urgency: "Bassa" | "Media" | "Alta" | "Immediata"
  status: SupportStatus
  requesterId: string
  assigneeId?: string
  collaboratorIds: string[]
  supervisorId?: string
  openedAt: string
  dueAt?: string
  slaHours: number
  estimatedMinutes?: number
  cause?: string
  solution?: string
  attachmentMetadata: Array<{ id: string; name: string; mimeType: string; size: number }>
  approvalId?: string
  resolvedAt?: string
  closedAt?: string
  reopenedAt?: string
  reopenedReason?: string
  updatedAt: string
  archivedAt?: string
}

export const approvalStatuses = ["Bozza", "Da inviare", "In attesa approvazione", "Correzioni richieste", "Approvato", "Sostituito", "Revocato"] as const
export type ApprovalStatus = (typeof approvalStatuses)[number]
export type OperationalApproval = {
  id: string
  objectType: "website" | "software" | "activity" | "phase" | "deliverable" | "support_ticket" | "document" | "publication" | "delivery"
  objectId: string
  version: number
  authorId: string
  requesterId: string
  requiredApproverId: string
  status: ApprovalStatus
  requestedAt?: string
  decidedAt?: string
  comment?: string
  rejectionReason?: string
  overrideReason?: string
  decidedBy?: string
  attachments: Array<{ id: string; name: string; mimeType: string; size: number }>
  supersedesId?: string
  createdAt: string
  updatedAt: string
}

export const websiteWorkflowStatuses = ["Da pianificare", "Briefing incompleto", "Materiali da ricevere", "Pronto per lo sviluppo", "In sviluppo", "In revisione interna", "Correzioni richieste", "Da approvare — Responsabile Web", "Approvato internamente — Pronto per il cliente", "In revisione cliente", "Modifiche cliente", "Pronto per la pubblicazione", "Pubblicato", "Consegnato", "In manutenzione", "Bloccato", "Annullato"] as const
export type WebsiteWorkflowStatus = (typeof websiteWorkflowStatuses)[number]
