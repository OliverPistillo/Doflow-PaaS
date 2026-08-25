export type PipelineStage =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "unqualified"
  | "not-interested"
  | "follow-up"
  | "lost"

export type LeadStatus = PipelineStage

export type LeadSource = "Google Ads" | "Meta Ads" | "LinkedIn" | "Referral" | "Organico" | "Evento" | "Instagram" | "Manuale"

export type TeamMember = {
  id: string
  name: string
  initials: string
}

export type DoFlowFormSubmission = {
  projectType: "Sito vetrina" | "E-commerce" | "Landing page" | "Altro"
  goals: Array<"Ricevere più contatti" | "Vendere online" | "Rafforzare il brand" | "Lanciare un progetto">
  timing: "Il prima possibile" | "Entro 1–2 mesi" | "Tra 3 mesi o più" | "Sto valutando"
  province: string
  privacyAccepted: boolean
  submittedAt: string
  sourcePage: string
  landingPage: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
}

export type OriginalLeadRequest = {
  projectType: "Sito vetrina" | "E-commerce" | "Landing page" | "Altro"
  objectives: Array<"Ricevere più contatti" | "Vendere online" | "Rafforzare il brand" | "Lanciare un progetto">
  timing: "Il prima possibile" | "Entro 1-2 mesi" | "Tra 3 mesi o più" | "Sto valutando"
  fullName: string
  company?: string
  email: string
  phone: string
  province: string
  privacyAccepted: boolean
  submittedAt: string
  source: "Sito DoFlow"
  sourceUrl?: string
}

export type CommercialLead = {
  id: string
  /** Versione PostgreSQL usata per optimistic concurrency. */
  version?: number
  /** Nome con cui l'opportunità viene identificata nella scheda commerciale. */
  opportunityName?: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  vatNumber?: string
  taxCode?: string
  /** Sede operativa del lead, distinta dai dati inviati nel form originale. */
  location?: string
  source: LeadSource
  campaignId?: string
  campaignAdGroupId?: string
  campaignAdId?: string
  service: string
  services?: string[]
  stage: PipelineStage
  /** Alias mantenuto per la compatibilità delle route Commerciali esistenti. */
  status: PipelineStage
  value: number
  probability: number
  assigneeId: string
  /** Alias mantenuto per la compatibilità delle route Commerciali esistenti. */
  owner: string
  createdAt: string
  lastContact: string
  nextAction: string
  nextActionAt: string
  daysInStage: number
  convertedClientId?: string
  convertedAt?: string
  archivedAt?: string
  archivedBy?: string
  archivedReason?: string
  mergedIntoId?: string
  exportedToContactsAt?: string
  exportedToContactsBy?: string
  exportBatchId?: string
  materialsStatus?: "Da richiedere" | "Richiesto" | "Ricevuto" | "Incompleto"
  proposal?: {
    code: string
    version: number
    status: "Da preparare" | "Preparata" | "Inviata" | "Visualizzata" | "Accettata" | "Rifiutata" | "Scaduta"
    amount: number
    createdAt: string
    sentAt?: string
    viewedAt?: string
    acceptedAt?: string
    dueAt?: string
  }
  formSubmission?: DoFlowFormSubmission
  originalRequest?: OriginalLeadRequest
}

export type CommercialTrendPoint = {
  id: string
  label: string
  newLeads: number
  openDeals: number
  wonDeals: number
  pipelineValue: number
  weightedValue: number
}

export type CommercialActivityType = "status-change" | "email" | "proposal" | "note" | "call" | "meeting" | "demo"
export type CommercialActivityStatus = "completed" | "planned"
export type CommercialActivityPriority = "normal" | "high" | "urgent"

export type CommercialActivity = {
  id: string
  leadId: string
  type: CommercialActivityType
  title: string
  description: string
  date: string
  assignedToId: string
  status: CommercialActivityStatus
  priority: CommercialActivityPriority
  completedAt?: string
}

export type CommercialPeriod = "today" | "month" | "previous-month" | "custom"

export type PipelineAnalysisPoint = {
  id: string
  period: string
  label: string
  pipelineValue: number
  weightedValue: number
}
