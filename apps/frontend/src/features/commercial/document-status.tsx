import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const customerDocumentStatuses = ["Da ricevere", "Ricevuto", "Da firmare", "Firmato", "In revisione", "Rifiutato", "Scaduto", "Archiviato"] as const
export type CustomerDocumentStatus = (typeof customerDocumentStatuses)[number]

const toneClasses = {
  yellow: "border-amber-400/50 bg-amber-400/15 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200",
  blue: "border-sky-400/50 bg-sky-400/15 text-sky-800 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-200",
  orange: "border-orange-400/50 bg-orange-400/15 text-orange-800 dark:border-orange-400/40 dark:bg-orange-400/15 dark:text-orange-200",
  green: "border-emerald-400/50 bg-emerald-400/15 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200",
  purple: "border-violet-400/50 bg-violet-400/15 text-violet-800 dark:border-violet-400/40 dark:bg-violet-400/15 dark:text-violet-200",
  red: "border-red-400/50 bg-red-400/15 text-red-800 dark:border-red-400/40 dark:bg-red-400/15 dark:text-red-200",
  gray: "border-slate-400/40 bg-slate-400/10 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/10 dark:text-slate-300",
} as const

export function documentStatusClass(status: string) {
  const normalized = status.toLocaleLowerCase("it-IT")
  if (normalized.includes("da ricevere") || normalized.includes("da preparare") || normalized === "preparata") return toneClasses.yellow
  if (normalized.includes("ricevut") || normalized.includes("inviat")) return toneClasses.blue
  if (normalized.includes("da firmare") || normalized.includes("attesa di firma")) return toneClasses.orange
  if (normalized.includes("firmat") || normalized.includes("accettat")) return toneClasses.green
  if (normalized.includes("revisione") || normalized.includes("visualizzat")) return toneClasses.purple
  if (normalized.includes("rifiutat") || normalized.includes("scadut")) return toneClasses.red
  if (normalized.includes("archiviat") || normalized.includes("sostituit")) return toneClasses.gray
  return toneClasses.gray
}

export function DocumentStatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", documentStatusClass(status), className)}>{status}</Badge>
}

export function documentStatusFilterClass(status: string, selected: boolean) {
  return selected ? documentStatusClass(status) : ""
}
