import type { CommercialLead } from "@/features/commercial/types"
import type { CommercialCustomer } from "@/features/commercial/components/commercial-leads-provider"

export type DuplicateRecordType = "lead" | "client" | "contact"
export type DuplicateLevel = "certain" | "probable"
export type DuplicateCandidate = { id: string; type: DuplicateRecordType; name: string; company?: string; email?: string; phone?: string; vatNumber?: string; taxCode?: string; createdAt?: string; updatedAt?: string; source?: string; owner?: string; status?: string; customerId?: string; canonicalLeadId?: string; version?: number }
export type DuplicateGroup = { id: string; level: DuplicateLevel; candidates: [DuplicateCandidate, DuplicateCandidate]; reasons: string[]; matchingFields: string[]; score: number }

const generic = new Set(["n/a", "na", "nessuno", "none", "test", "-", "."])
const useful = (value?: string) => { const normalized = value?.trim() ?? ""; return normalized.length > 1 && !generic.has(normalized.toLowerCase()) }
export const normalizeEmail = (value?: string) => (value ?? "").replace(/\s+/g, "").trim().toLowerCase()
/** Chiave di confronto: per i cellulari italiani conserva sempre le 10 cifre nazionali 3xxxxxxxxx. */
export function normalizeItalianPhone(value?: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("0039")) {
    const national = digits.slice(4)
    if (/^3\d{9}$/.test(national)) return national
  }
  if (digits.startsWith("39")) {
    const national = digits.slice(2)
    if (/^3\d{9}$/.test(national)) return national
  }
  if (/^3\d{9}$/.test(digits)) return digits
  return digits.length >= 8 ? digits : ""
}
/** @deprecated Usa normalizeItalianPhone. Mantenuto per compatibilità interna. */
export const normalizePhone = normalizeItalianPhone
export const normalizeTaxId = (value?: string) => (value ?? "").replace(/\s+/g, "").toUpperCase()
export const normalizeName = (value?: string) => (value ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const validPhone = (value: string) => value.length >= 8 && !/^0+$/.test(value)
const similar = (left: string, right: string) => { if (!left || !right) return false; if (left === right) return true; const a = new Set(left.split(" ")); const b = new Set(right.split(" ")); const common = [...a].filter((token) => b.has(token)).length; return common > 0 && common / Math.max(a.size, b.size) >= .6 }

export function getDuplicateCandidates(leads: CommercialLead[], customers: CommercialCustomer[]): DuplicateCandidate[] {
  const leadCandidates = leads.filter((lead) => !lead.archivedAt).map((lead) => ({ id: lead.id, canonicalLeadId: lead.id, type: "lead" as const, name: `${lead.firstName} ${lead.lastName}`.trim(), company: lead.company, email: lead.email, phone: lead.phone, vatNumber: lead.vatNumber, taxCode: lead.taxCode, createdAt: lead.createdAt, source: lead.source, owner: lead.owner, status: lead.stage }))
  const clientCandidates = customers.filter((customer) => !customer.archivedAt).map((customer) => ({ id: customer.id, canonicalLeadId: customer.sourceLeadId, type: "client" as const, name: `${customer.profile.firstName} ${customer.profile.lastName}`.trim(), company: customer.profile.company, email: customer.profile.email, phone: customer.profile.phone, vatNumber: customer.profile.vatNumber, taxCode: customer.profile.taxCode, createdAt: customer.createdAt, updatedAt: customer.profile.convertedAt, source: customer.profile.source, owner: customer.profile.owner, status: customer.status }))
  const contacts = customers.filter((customer) => !customer.archivedAt).flatMap((customer) => (customer.contacts ?? []).filter((contact) => !contact.archivedAt).map((contact) => ({ id: contact.id, canonicalLeadId: customer.sourceLeadId, type: "contact" as const, name: contact.name, company: customer.profile.company, email: contact.email, phone: contact.phone, vatNumber: contact.vatNumber, taxCode: contact.taxCode, createdAt: contact.createdAt, updatedAt: contact.updatedAt, source: "Cliente", owner: customer.profile.owner, status: contact.role, customerId: customer.id })))
  return [...leadCandidates, ...clientCandidates, ...contacts]
}

export function analyzeDuplicates(candidates: DuplicateCandidate[], ignoredPairIds: string[] = []): DuplicateGroup[] {
  const ignored = new Set(ignoredPairIds); const output: DuplicateGroup[] = []
  for (let index = 0; index < candidates.length; index++) for (let next = index + 1; next < candidates.length; next++) {
    const left = candidates[index], right = candidates[next]; if (left.canonicalLeadId && left.canonicalLeadId === right.canonicalLeadId) continue
    const pair = [left.id, right.id].sort().join("::"); if (ignored.has(pair)) continue
    const exact: Array<[string, string]> = []
    const emailLeft = normalizeEmail(left.email), emailRight = normalizeEmail(right.email); if (validEmail(emailLeft) && emailLeft === emailRight) exact.push(["Email", emailLeft])
    const phoneLeft = normalizeItalianPhone(left.phone), phoneRight = normalizeItalianPhone(right.phone); if (validPhone(phoneLeft) && phoneLeft === phoneRight) exact.push(["Telefono", phoneLeft])
    const vatLeft = normalizeTaxId(left.vatNumber), vatRight = normalizeTaxId(right.vatNumber); if (useful(vatLeft) && vatLeft === vatRight) exact.push(["Partita IVA", vatLeft])
    const taxLeft = normalizeTaxId(left.taxCode), taxRight = normalizeTaxId(right.taxCode); if (useful(taxLeft) && taxLeft === taxRight) exact.push(["Codice fiscale", taxLeft])
    const sameCompany = useful(left.company) && normalizeName(left.company) === normalizeName(right.company); const samePerson = useful(left.name) && normalizeName(left.name) === normalizeName(right.name); const nearName = similar(normalizeName(left.name || left.company), normalizeName(right.name || right.company))
    if (!exact.length && !sameCompany && !samePerson && !nearName) continue
    const level: DuplicateLevel = exact.length ? "certain" : "probable"; const matchingFields = [...exact.map(([field]) => field), ...(sameCompany ? ["Azienda"] : []), ...(samePerson ? ["Nome e cognome"] : [])]; const reasons = exact.length ? exact.map(([field]) => `Stesso ${field.toLowerCase()}`) : [sameCompany ? "Stesso nome azienda" : samePerson ? "Stesso nome e cognome" : "Nome simile con dati di contatto mancanti"]
    output.push({ id: `duplicate-${pair}`, level, candidates: [left, right], reasons, matchingFields, score: exact.length ? Math.min(100, 85 + exact.length * 5) : sameCompany || samePerson ? 75 : 60 })
  }
  return output.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export const ignoredDuplicatePairId = (leftId: string, rightId: string) => [leftId, rightId].sort().join("::")
