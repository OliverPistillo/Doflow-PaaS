import type { CollaborationRecordType } from "@/features/commercial/commercial-collaboration"

export const automationTriggers = ["follow_up_lead", "appointment", "activity_due", "unsigned_contract", "expiring_quote", "unpaid_installment", "renewal", "missing_materials", "qa", "approval", "delivery", "inactive_customer", "blocked_project"] as const
export const automationActions = ["create_activity", "create_notification", "add_system_comment", "update_due_date", "prepare_message", "prepare_email", "prepare_calendar_event"] as const
export type AutomationTrigger = (typeof automationTriggers)[number]
export type AutomationAction = (typeof automationActions)[number]
export type CommercialAutomationRule = { id: string; name: string; trigger: AutomationTrigger; conditions: string; recipientId: string; action: AutomationAction; message: string; enabled: boolean; optimisticVersion?: number; targetRecordType?: CollaborationRecordType; targetRecordId?: string; lastRunAt?: string; nextRunAt?: string; lastExecutionKey?: string; createdAt: string; updatedAt: string; archivedAt?: string }
export type AutomationRun = { id: string; ruleId: string; executionKey: string; status: "success" | "error" | "skipped"; startedAt: string; completedAt: string; output: string; error?: string; retryOfId?: string }
export type AutomationNotification = { id: string; ruleId: string; recipientId: string; title: string; body: string; createdAt: string }

export const integrationAdapters = ["Meta Lead Ads", "Google Ads", "WhatsApp", "Email", "Google Calendar", "Google Contacts", "Firma elettronica", "Fatturazione", "Storage documenti", "Pagamenti"].map((provider) => ({ provider, enabled: false as const, mode: "adapter-only" as const, reason: "Richiede backend, credenziali cifrate e webhook verificati." }))

export const automationLabels: Record<AutomationTrigger | AutomationAction, string> = {
  follow_up_lead: "Follow-up lead", appointment: "Appuntamento", activity_due: "Scadenza attività", unsigned_contract: "Contratto non firmato", expiring_quote: "Preventivo in scadenza", unpaid_installment: "Rata non pagata", renewal: "Rinnovo", missing_materials: "Materiali mancanti", qa: "QA", approval: "Approvazione", delivery: "Consegna", inactive_customer: "Cliente inattivo", blocked_project: "Progetto bloccato",
  create_activity: "Crea attività", create_notification: "Crea notifica", add_system_comment: "Commento di sistema", update_due_date: "Aggiorna scadenza", prepare_message: "Prepara messaggio", prepare_email: "Prepara email", prepare_calendar_event: "Prepara evento calendario",
}
