import type { CommercialLead } from "@/features/commercial/types"

const headers = ["Name", "Given Name", "Family Name", "Organization 1 - Name", "Organization 1 - Title", "Phone 1 - Type", "Phone 1 - Value", "E-mail 1 - Type", "E-mail 1 - Value", "Address 1 - Formatted", "Labels", "Notes"]

export function normalizeItalianPhone(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const digits = trimmed.replace(/\D/g, "")
  if (trimmed.startsWith("+") && digits) return `+${digits}`
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith("3")) return `+39${digits}`
  return digits
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function deduplicateContactLeads(leads: CommercialLead[]) {
  const phones = new Set<string>()
  const emails = new Set<string>()
  return leads.filter((lead) => {
    const phone = normalizeItalianPhone(lead.phone)
    const email = lead.email.trim().toLowerCase()
    if (phone && phones.has(phone) || email && emails.has(email)) return false
    if (phone) phones.add(phone)
    if (email) emails.add(email)
    return true
  })
}

export function buildGoogleContactsCsv(leads: CommercialLead[], ownerName: (id: string) => string) {
  const unique = deduplicateContactLeads(leads)
  const rows = unique.map((lead) => [
    [lead.firstName, lead.lastName].filter(Boolean).join(" "),
    lead.firstName,
    lead.lastName,
    lead.company,
    "Lead commerciale",
    "Mobile",
    normalizeItalianPhone(lead.phone),
    "Work",
    lead.email.trim().toLowerCase(),
    lead.location ?? lead.originalRequest?.province ?? lead.formSubmission?.province ?? "",
    "DoFlow - Nuovo lead",
    `Fonte: ${lead.source}; Responsabile: ${ownerName(lead.assigneeId)}; Stato: ${lead.stage}; ID DoFlow: ${lead.id}; Scheda: /dashboard/commercial/leads/${lead.id}`,
  ])
  return { csv: "\uFEFF" + [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n"), leads: unique }
}
