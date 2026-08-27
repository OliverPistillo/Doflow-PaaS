import { format } from "date-fns"
import { it } from "date-fns/locale"

import { getAuditFieldLabel, normalizeAuditEvent, type CommercialAuditActionType, type CommercialAuditChange, type CommercialAuditEvent } from "@/features/commercial/commercial-collaboration"

export type AuditPresentationLookup = {
  users: Array<{ id: string; name: string }>
  records: Array<{ id: string; label: string }>
}

const dateFields = new Set(["nextActionAt", "dueAt", "dueDate", "originalDueAt", "completedAt", "deliveryDate", "startAt", "endAt", "date", "renewalAt", "nextRenewalAt", "signedAt", "archivedAt", "createdAt", "updatedAt"])
const moneyFields = new Set(["value", "amount", "total", "paidAmount", "balance", "deposit", "discount", "price", "residual", "toInvoice"])
const userFields = new Set(["assignedToId", "assigneeId", "ownerId", "supervisorId", "createdBy", "approvedBy", "operatorId", "salespersonId", "collaboratorIds", "memberIds"])
const stateLabels: Record<string, string> = { new: "Nuovo lead", qualified: "Qualificato", negotiation: "In trattativa", proposal: "Proposta inviata", "follow-up": "Follow-up", won: "Vinto", lost: "Perso", unqualified: "Non idoneo", uninterested: "Non interessato" }

function findLabel(value: string, lookup: AuditPresentationLookup) {
  return lookup.users.find((user) => user.id === value)?.name ?? lookup.records.find((record) => record.id === value)?.label
}

export function formatAuditDisplayValue(field: string, value: unknown, lookup: AuditPresentationLookup): string {
  if (value === undefined || value === null || value === "") return "Non impostato"
  if (typeof value === "boolean") return value ? "Sì" : "No"
  if (Array.isArray(value)) return value.length ? value.map((item) => formatAuditDisplayValue(field, item, lookup)).join(", ") : "Nessuno"
  if (typeof value === "number") {
    if (field === "probability") return `${value}%`
    if (moneyFields.has(field)) return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
    return new Intl.NumberFormat("it-IT").format(value)
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    return String(object.name ?? object.title ?? object.label ?? object.status ?? "Dettagli aggiornati")
  }
  const raw = String(value)
  if (raw === "—" || raw === "undefined" || raw === "null") return "Non impostato"
  if (userFields.has(field)) return findLabel(raw, lookup) ?? "Collaboratore non più disponibile"
  if (field === "stage" || field === "status") return stateLabels[raw] ?? raw
  if (field === "approvalId") return findLabel(raw, lookup) ?? "Approvazione collegata"
  if (/Id$/.test(field)) return findLabel(raw, lookup) ?? "Record collegato"
  if (dateFields.has(field) || /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw)) {
    const parsed = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
    if (!Number.isNaN(parsed.getTime())) return format(parsed, raw.length === 10 ? "d MMMM yyyy" : "d MMMM yyyy, HH:mm", { locale: it })
  }
  return findLabel(raw, lookup) ?? raw
}

export function auditActionLabel(type: CommercialAuditActionType) {
  return ({ field_change: "Modifica", status_change: "Cambio stato", assignment: "Assegnazione", archive: "Archiviazione", restore: "Ripristino", approval: "Approvazione", rejection: "Revisione rifiutata", comment: "Commento", attachment: "Allegato", payment: "Pagamento", refund: "Rimborso", merge: "Fusione duplicati", create: "Creazione", soft_delete: "Eliminazione logica", points: "Punti", system: "Sistema" })[type]
}

export function presentAuditEvent(rawEvent: CommercialAuditEvent, lookup: AuditPresentationLookup) {
  const event = normalizeAuditEvent(rawEvent); const changes = (event.changes ?? []).filter((change) => formatAuditDisplayValue(change.field, change.oldValue, lookup) !== formatAuditDisplayValue(change.field, change.newValue, lookup)); const actor = lookup.users.find((user) => user.id === (event.actorId ?? event.authorId))?.name ?? event.authorName ?? "Sistema"
  const type = event.actionType ?? "field_change"
  let sentence = event.action
  if (type === "archive") sentence = `${actor} ha archiviato il record.`
  else if (type === "restore") sentence = `${actor} ha ripristinato il record dall’Archivio.`
  else if (type === "approval") sentence = `${actor} ha approvato il lavoro.`
  else if (type === "rejection") sentence = `${actor} ha richiesto una revisione${event.reason ? `: ${event.reason}` : "."}`
  else if (type === "merge") sentence = `${actor} ha completato la fusione dei duplicati.`
  else if (changes.length > 1) sentence = `${actor} ha modificato ${changes.length} campi.`
  else if (changes[0]) {
    const change = changes[0]; const field = getAuditFieldLabel(change.field).toLowerCase(); const oldValue = formatAuditDisplayValue(change.field, change.oldValue, lookup); const newValue = formatAuditDisplayValue(change.field, change.newValue, lookup)
    if (type === "assignment") sentence = `${actor} ha cambiato ${field} da ${oldValue} a ${newValue}.`
    else if (type === "status_change") sentence = `${actor} ha cambiato ${field} da ${oldValue} a ${newValue}.`
    else sentence = `${actor} ha aggiornato ${field} da ${oldValue} a ${newValue}${/[.!?]$/.test(newValue) ? "" : "."}`
  } else if (!sentence.toLowerCase().includes(actor.toLowerCase())) sentence = `${actor}: ${sentence}.`
  return { event, actor, type, sentence, changes }
}

export function presentAuditChange(change: CommercialAuditChange, lookup: AuditPresentationLookup) {
  return { label: getAuditFieldLabel(change.field), before: formatAuditDisplayValue(change.field, change.oldValue, lookup), after: formatAuditDisplayValue(change.field, change.newValue, lookup), long: String(change.oldValue ?? "").length + String(change.newValue ?? "").length > 180 }
}
