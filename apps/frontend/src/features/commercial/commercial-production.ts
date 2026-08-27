import type { CommercialProject, CommercialProjectPhase, CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import { Archive, Ban, CheckCircle2, CircleDot, Clock3, Headphones, PauseCircle, PlayCircle, Rocket, SearchCheck, ShieldAlert, Sparkles, UploadCloud, type LucideIcon } from "lucide-react"

export const productionProjectStatuses = ["not_started", "onboarding", "in_progress", "blocked", "qa_internal", "internal_review", "ready_client", "client_review", "changes_requested", "ready_publish", "published", "delivered", "support", "suspended", "cancelled"] as const
export type ProductionProjectStatus = (typeof productionProjectStatuses)[number]

export const productionProjectStatusLabels: Record<ProductionProjectStatus, string> = {
  not_started: "Da avviare", onboarding: "Onboarding", in_progress: "In lavorazione", blocked: "Bloccato", qa_internal: "QA interno", internal_review: "Revisione interna", ready_client: "Pronto per il cliente", client_review: "Revisione cliente", changes_requested: "Modifiche richieste", ready_publish: "Pronto alla pubblicazione", published: "Pubblicato", delivered: "Consegnato", support: "Assistenza", suspended: "Sospeso", cancelled: "Annullato",
}

export const projectStatuses = [...productionProjectStatuses, "waiting_client", "review", "completed", "archived"] as const satisfies readonly CommercialProject["status"][]

export type ProjectStatusVisual = {
  label: string
  icon: LucideIcon
  badgeClass: string
  progressClass: string
  columnClass: string
}

export const projectStatusVisuals: Record<CommercialProject["status"], ProjectStatusVisual> = {
  not_started: { label: "Da avviare", icon: CircleDot, badgeClass: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300", progressClass: "bg-slate-500", columnClass: "border-slate-400/35 bg-slate-500/5" },
  onboarding: { label: "Onboarding", icon: Rocket, badgeClass: "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300", progressClass: "bg-sky-500", columnClass: "border-sky-500/30 bg-sky-500/5" },
  in_progress: { label: "In lavorazione", icon: PlayCircle, badgeClass: "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300", progressClass: "bg-blue-500", columnClass: "border-blue-500/30 bg-blue-500/5" },
  blocked: { label: "Bloccato", icon: ShieldAlert, badgeClass: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300", progressClass: "bg-orange-500", columnClass: "border-orange-500/30 bg-orange-500/5" },
  qa_internal: { label: "QA interno", icon: SearchCheck, badgeClass: "border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", progressClass: "bg-cyan-500", columnClass: "border-cyan-500/30 bg-cyan-500/5" },
  internal_review: { label: "Revisione interna", icon: SearchCheck, badgeClass: "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300", progressClass: "bg-violet-500", columnClass: "border-violet-500/30 bg-violet-500/5" },
  ready_client: { label: "Pronto per il cliente", icon: Sparkles, badgeClass: "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", progressClass: "bg-indigo-500", columnClass: "border-indigo-500/30 bg-indigo-500/5" },
  client_review: { label: "Revisione cliente", icon: SearchCheck, badgeClass: "border-purple-500/35 bg-purple-500/10 text-purple-700 dark:text-purple-300", progressClass: "bg-purple-500", columnClass: "border-purple-500/30 bg-purple-500/5" },
  changes_requested: { label: "Modifiche richieste", icon: ShieldAlert, badgeClass: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300", progressClass: "bg-rose-500", columnClass: "border-rose-500/30 bg-rose-500/5" },
  ready_publish: { label: "Pronto alla pubblicazione", icon: UploadCloud, badgeClass: "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", progressClass: "bg-indigo-500", columnClass: "border-indigo-500/30 bg-indigo-500/5" },
  published: { label: "Pubblicato", icon: UploadCloud, badgeClass: "border-teal-500/35 bg-teal-500/10 text-teal-700 dark:text-teal-300", progressClass: "bg-teal-500", columnClass: "border-teal-500/30 bg-teal-500/5" },
  delivered: { label: "Consegnato", icon: CheckCircle2, badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", progressClass: "bg-emerald-500", columnClass: "border-emerald-500/30 bg-emerald-500/5" },
  support: { label: "Assistenza", icon: Headphones, badgeClass: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300", progressClass: "bg-amber-500", columnClass: "border-amber-500/30 bg-amber-500/5" },
  suspended: { label: "Sospeso", icon: PauseCircle, badgeClass: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300", progressClass: "bg-orange-500", columnClass: "border-orange-500/30 bg-orange-500/5" },
  cancelled: { label: "Annullato", icon: Ban, badgeClass: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300", progressClass: "bg-slate-500", columnClass: "border-slate-400/35 bg-slate-500/5" },
  waiting_client: { label: "In attesa cliente", icon: Clock3, badgeClass: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300", progressClass: "bg-orange-500", columnClass: "border-orange-500/30 bg-orange-500/5" },
  review: { label: "In revisione", icon: SearchCheck, badgeClass: "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300", progressClass: "bg-violet-500", columnClass: "border-violet-500/30 bg-violet-500/5" },
  completed: { label: "Completato", icon: CheckCircle2, badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", progressClass: "bg-emerald-500", columnClass: "border-emerald-500/30 bg-emerald-500/5" },
  archived: { label: "Archiviato", icon: Archive, badgeClass: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300", progressClass: "bg-slate-500", columnClass: "border-slate-400/35 bg-slate-500/5" },
}

export function getProjectStatusVisual(status: CommercialProject["status"]): ProjectStatusVisual { return projectStatusVisuals[status] }
export function getProjectDisplayProgress(project: CommercialProject, calculated: number) { return project.status === "delivered" || project.status === "completed" ? 100 : calculated }

export type ProjectTemplateDefinition = { name: string; phases: Array<{ name: string; estimatedMinutes: number; weight: number; role: "developer" | "project_manager"; visibility: "internal" | "client"; milestone?: boolean; checklist?: string[] }> }

const qa = ["Desktop verificato", "Tablet verificato", "Mobile verificato", "Form funzionanti", "Link controllati", "Nessun errore console", "SEO base", "Cookie/privacy", "Performance", "Immagini", "Testi", "Backup"]

export const projectTemplates: Record<string, ProjectTemplateDefinition> = {
  website: { name: "Sito vetrina", phases: ["Setup", "Raccolta materiali", "Struttura", "Homepage", "Pagine interne", "Responsive", "Form", "Integrazioni", "QA", "Revisione", "Pubblicazione", "Consegna"].map((name, index) => ({ name, estimatedMinutes: [90, 120, 180, 360, 480, 240, 120, 180, 240, 180, 120, 60][index], weight: [3, 5, 7, 14, 18, 10, 5, 7, 10, 8, 4, 2][index], role: name === "Raccolta materiali" || name === "Revisione" || name === "Consegna" ? "project_manager" : "developer", visibility: ["Raccolta materiali", "Revisione", "Pubblicazione", "Consegna"].includes(name) ? "client" : "internal", milestone: ["QA", "Pubblicazione", "Consegna"].includes(name), checklist: name === "QA" ? qa : undefined })) },
  landing: { name: "Landing page", phases: ["Brief", "Struttura", "Copy", "Design", "Sviluppo", "Responsive", "Form/Tracking", "QA", "Revisione", "Pubblicazione", "Consegna"].map((name, index) => ({ name, estimatedMinutes: [90, 120, 180, 240, 300, 120, 150, 180, 120, 60, 45][index], weight: [5, 7, 10, 14, 22, 9, 10, 11, 6, 4, 2][index], role: ["Brief", "Revisione", "Consegna"].includes(name) ? "project_manager" : "developer", visibility: ["Brief", "Revisione", "Pubblicazione", "Consegna"].includes(name) ? "client" : "internal", milestone: ["QA", "Pubblicazione", "Consegna"].includes(name), checklist: name === "QA" ? qa : undefined })) },
  ecommerce: { name: "E-commerce", phases: ["Setup", "Catalogo", "Pagamenti", "Spedizioni", "Pagine", "Checkout", "Email", "Responsive", "Test ordine", "QA", "Revisione", "Pubblicazione", "Consegna"].map((name, index) => ({ name, estimatedMinutes: [120, 600, 240, 180, 480, 360, 180, 300, 240, 300, 240, 120, 60][index], weight: [3, 17, 7, 5, 14, 11, 5, 9, 7, 9, 7, 4, 2][index], role: ["Revisione", "Consegna"].includes(name) ? "project_manager" : "developer", visibility: ["Catalogo", "Revisione", "Pubblicazione", "Consegna"].includes(name) ? "client" : "internal", milestone: ["Test ordine", "QA", "Pubblicazione", "Consegna"].includes(name), checklist: name === "QA" ? qa : undefined })) },
  software: genericTemplate("Software"), saas: genericTemplate("Gestionale SaaS"), marketing: genericTemplate("Marketing"), maintenance: genericTemplate("Assistenza"), other: genericTemplate("Altro"),
}

function genericTemplate(name: string): ProjectTemplateDefinition { return { name, phases: ["Analisi", "Pianificazione", "Produzione", "QA", "Revisione", "Consegna"].map((phase, index) => ({ name: phase, estimatedMinutes: [180, 120, 600, 240, 180, 60][index], weight: [12, 8, 45, 18, 12, 5][index], role: ["Analisi", "Pianificazione", "Revisione", "Consegna"].includes(phase) ? "project_manager" : "developer", visibility: ["Analisi", "Revisione", "Consegna"].includes(phase) ? "client" : "internal", milestone: ["QA", "Consegna"].includes(phase), checklist: phase === "QA" ? qa : undefined })) } }

export function activityWeight(activity: CustomerActivity) { return activity.weight ?? Math.max(1, activity.estimatedMinutes ?? 30) }
export function weightedProgress(activities: CustomerActivity[], visibility?: "internal" | "client") { const eligible = activities.filter((activity) => !activity.archivedAt && activity.status !== "Annullata" && (!visibility || activity.visibility === visibility)); const total = eligible.reduce((sum, activity) => sum + activityWeight(activity), 0); const complete = eligible.filter((activity) => activity.status === "Completata").reduce((sum, activity) => sum + activityWeight(activity), 0); return total ? Math.round(complete / total * 100) : 0 }
export function projectProgress(project: CommercialProject, activities: CustomerActivity[]) { const linked = activities.filter((activity) => activity.projectId === project.id); return { internal: weightedProgress(linked), client: weightedProgress(linked.filter((activity) => activity.clientVisibleAt), "client"), estimatedMinutes: linked.filter((activity) => activity.status !== "Annullata" && !activity.archivedAt).reduce((sum, activity) => sum + (activity.estimatedMinutes ?? 0), 0) } }
export function phaseProgressWeighted(phase: CommercialProjectPhase, activities: CustomerActivity[]) { return weightedProgress(activities.filter((activity) => activity.phaseId === phase.id)) }
