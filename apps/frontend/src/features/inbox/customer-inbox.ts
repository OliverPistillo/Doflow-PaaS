export const inboxChannels = ["whatsapp", "email", "site", "portal", "support", "call", "sms"] as const
export type InboxChannel = (typeof inboxChannels)[number]
export const inboxStatuses = ["Da gestire", "In lavorazione", "In attesa cliente", "Risolta", "Archiviata"] as const
export type InboxStatus = (typeof inboxStatuses)[number]
export const inboxPriorities = ["Bassa", "Normale", "Alta", "Urgente"] as const
export type InboxPriority = (typeof inboxPriorities)[number]
export type InboxDirection = "incoming" | "outgoing" | "internal" | "system"
export type InboxMessageStatus = "scheduled" | "sent" | "delivered" | "read" | "failed" | "recorded" | "external_opened"
export type InboxRecordLink = { type: "lead" | "customer" | "project" | "support"; id: string; title: string; href: string }
export type InboxContactCandidate = InboxRecordLink & { email?: string; phone?: string }

export type InboxConversation = {
  id: string
  contactName: string
  company?: string
  email?: string
  phone?: string
  channel: InboxChannel
  status: InboxStatus
  priority: InboxPriority
  assignedToId?: string
  supervisorId?: string
  collaboratorIds: string[]
  dueAt?: string
  slaMinutes: number
  tags: string[]
  category?: string
  linkedRecords: InboxRecordLink[]
  candidateMatches: InboxContactCandidate[]
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  archivedAt?: string
}

export type InboxAttachment = { id: string; name: string; mimeType: string; size: number; status: "unavailable" }
export type InboxMessage = {
  id: string
  clientId: string
  conversationId: string
  direction: InboxDirection
  channel: InboxChannel
  authorId?: string
  sender: string
  recipient?: string
  text: string
  attachments: InboxAttachment[]
  status: InboxMessageStatus
  remoteId?: string
  replyToMessageId?: string
  scheduledAt?: string
  createdAt: string
}
export type InboxReceipt = { conversationId: string; userId: string; readAt: string }
export type InboxSnapshot = { conversations: InboxConversation[]; messages: InboxMessage[]; receipts: InboxReceipt[]; drafts: Record<string, string>; filters: InboxFilters; transport: "server-postgresql"; productionReady: true }
export type InboxFilters = { search: string; status: "all" | InboxStatus; priority: "all" | InboxPriority; channel: "all" | InboxChannel; scope: "all" | "mine"; unreadOnly: boolean }

export const emptyInboxFilters: InboxFilters = { search: "", status: "all", priority: "all", channel: "all", scope: "all", unreadOnly: false }
export const inboxChannelLabels: Record<InboxChannel, string> = { whatsapp: "WhatsApp", email: "Email", site: "Sito", portal: "Portale", support: "Supporto", call: "Chiamata", sms: "SMS" }
export const inboxChannelConnected: Record<InboxChannel, boolean> = { whatsapp: false, email: false, site: false, portal: false, support: false, call: false, sms: false }

export const inboxTemplates = [
  { id: "first-response", label: "Prima risposta", text: "Ciao {{nome}}, grazie per averci contattato. Come possiamo aiutarti?" },
  { id: "qualification", label: "Qualificazione", text: "Ciao {{nome}}, per preparare una proposta precisa avremmo bisogno di alcune informazioni sul progetto." },
  { id: "appointment", label: "Conferma appuntamento", text: "Ciao {{nome}}, confermiamo l'appuntamento per {{data}}." },
  { id: "follow-up", label: "Follow-up", text: "Ciao {{nome}}, ti ricontattiamo in merito alla nostra ultima conversazione." },
  { id: "quote", label: "Invio preventivo", text: "Ciao {{nome}}, il preventivo richiesto è pronto per la revisione." },
  { id: "contract", label: "Invio contratto", text: "Ciao {{nome}}, il contratto è pronto per la firma." },
  { id: "payment", label: "Promemoria pagamento", text: "Ciao {{nome}}, ti ricordiamo la prossima scadenza di pagamento." },
  { id: "materials", label: "Richiesta materiali", text: "Ciao {{nome}}, per procedere abbiamo bisogno dei materiali concordati." },
  { id: "revision", label: "Revisione pronta", text: "Ciao {{nome}}, la nuova revisione è pronta per il tuo riscontro." },
  { id: "delivery", label: "Consegna", text: "Ciao {{nome}}, il lavoro è pronto per la consegna." },
  { id: "renewal", label: "Rinnovo", text: "Ciao {{nome}}, si avvicina la scadenza del servizio annuale." },
  { id: "support-closed", label: "Supporto risolto", text: "Ciao {{nome}}, la richiesta di assistenza risulta risolta. Restiamo a disposizione." },
] as const

export function normalizeInboxEmail(value?: string) { return value?.trim().toLocaleLowerCase("it-IT") ?? "" }
export function normalizeInboxPhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0039")) return digits.slice(4)
  if (digits.startsWith("39") && digits.length > 10) return digits.slice(2)
  return digits
}

export function renderInboxTemplate(text: string, conversation: InboxConversation) {
  return text.replaceAll("{{nome}}", conversation.contactName.split(" ")[0] || "cliente").replaceAll("{{azienda}}", conversation.company ?? "").replaceAll("{{data}}", "[data]")
}
