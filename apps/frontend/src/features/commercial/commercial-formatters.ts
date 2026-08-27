const operationalLabels: Record<string, string> = {
  new: "Nuovo lead",
  qualified: "Qualificato",
  negotiation: "In trattativa",
  proposal: "Proposta inviata",
  proposal_sent: "Proposta inviata",
  follow_up: "Follow-up",
  followup: "Follow-up",
  won: "Vinto",
  lost: "Perso",
  not_eligible: "Non idoneo",
  unqualified: "Non idoneo",
  uninterested: "Non interessato",
  todo: "Da fare",
  to_do: "Da fare",
  not_started: "Da avviare",
  in_progress: "In corso",
  review: "In revisione",
  completed: "Completato",
  complete: "Completato",
  overdue: "Scaduto",
  open: "Aperto",
  closed: "Chiuso",
  cancelled: "Annullato",
  canceled: "Annullato",
  archived: "Archiviato",
  draft: "Bozza",
  active: "Attivo",
  inactive: "Inattivo",
  pending: "In attesa",
  approved: "Approvato",
  rejected: "Rifiutato",
  refunded: "Rimborsato",
  paid: "Pagato",
  partial: "Parzialmente pagato",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  urgent: "Urgente",
  critical: "Critica",
  email: "Email",
  call: "Chiamata",
  phone: "Chiamata",
  note: "Nota",
  whatsapp: "WhatsApp",
  referral: "Referral",
  direct: "Diretto",
  website: "Sito web",
  ecommerce: "E-commerce",
  landing: "Landing page",
  software: "Software",
  saas: "Gestionale SaaS",
  support: "Assistenza",
  administrator: "Amministratore",
  commercial: "Commerciale",
  web_developer: "Sviluppatore web",
  project_manager: "Project Manager",
}

const aliases: Record<string, string[]> = {
  new: ["nuovo", "nuovo lead"],
  negotiation: ["trattativa", "in trattativa"],
  proposal: ["proposta", "proposta inviata"],
  proposal_sent: ["proposta", "proposta inviata"],
  follow_up: ["follow up", "ricontatto"],
  won: ["vinto", "acquisito"],
  todo: ["da fare", "aperta"],
  to_do: ["da fare", "aperta"],
  in_progress: ["in corso", "avviato"],
  completed: ["completata", "completato", "conclusa"],
  overdue: ["scaduto", "scaduta", "in ritardo"],
}

function keyOf(value: string) {
  return value.trim().toLocaleLowerCase("it-IT").replace(/[\s-]+/g, "_")
}

export function normalizeOperationalSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it-IT").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

export function formatOperationalValue(value?: string) {
  if (!value) return ""
  return operationalLabels[keyOf(value)] ?? value
}

export function operationalSearchTerms(value?: string) {
  if (!value) return []
  const key = keyOf(value)
  return Array.from(new Set([value, formatOperationalValue(value), ...(aliases[key] ?? [])]))
}

export function matchesOperationalSearch(query: string, ...values: Array<string | undefined>) {
  const needle = normalizeOperationalSearch(query)
  if (!needle) return true
  return normalizeOperationalSearch(values.flatMap((value) => operationalSearchTerms(value)).join(" ")).includes(needle)
}
