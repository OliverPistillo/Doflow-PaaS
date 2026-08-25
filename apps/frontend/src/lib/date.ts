const ROME = "Europe/Rome"

export function parseSafeDate(value: string | Date) {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

export function isValidDate(value?: string | Date | null) {
  return Boolean(value) && !Number.isNaN(parseSafeDate(value as string | Date).getTime())
}

export function getRomeDateKey(value: string | Date) {
  const date = parseSafeDate(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en", { timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function addRomeDays(dateKey: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return ""
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return getRomeDateKey(date)
}

export function formatItalianDate(value?: string | Date | null): string {
  if (!value) return ""
  const date = parseSafeDate(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "2-digit", month: "short", year: "numeric" }).format(date)
}

export function formatItalianDateTime(value?: string | Date | null): string {
  if (!value) return ""
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatItalianDate(value)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
}

export function formatRelativeDeadline(value: string | Date) {
  const due = parseSafeDate(value)
  const now = new Date()
  const difference = Math.ceil((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000)
  if (difference < 0) return "Scaduta"
  if (difference === 0) return "Oggi"
  if (difference === 1) return "Domani"
  if (difference <= 7) return `Tra ${difference} giorni`
  return formatItalianDate(due)
}
