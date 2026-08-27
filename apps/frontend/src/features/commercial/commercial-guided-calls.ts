import type { CommercialLead, PipelineStage } from "@/features/commercial/types";

export const guidedServiceOptions = [
  { id: "service-showcase-site", label: "Sito vetrina" },
  { id: "service-ecommerce", label: "E-commerce" },
  { id: "service-landing-page", label: "Landing page" },
  { id: "other", label: "Altro" },
  { id: "undefined", label: "Da definire" },
] as const

export type GuidedServiceId = (typeof guidedServiceOptions)[number]["id"]
export type GuidedServiceDetectionSource = "requested-services" | "primary-service" | "original-request" | "form-submission" | "compatible-category" | "none"
const guidedServiceAliases: Array<{ id: Exclude<GuidedServiceId, "undefined">; aliases: string[] }> = [
  { id: "service-showcase-site", aliases: ["sito vetrina", "sito web", "vetrina", "sito"] },
  { id: "service-ecommerce", aliases: ["e-commerce", "ecommerce", "negozio online", "shop"] },
  { id: "service-landing-page", aliases: ["landing page", "pagina di vendita", "landing"] },
  { id: "other", aliases: ["altro"] },
]
const normalizeServiceText = (value: string) => value.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
export function guidedServiceLabel(id: GuidedServiceId) { return guidedServiceOptions.find((option) => option.id === id)?.label ?? "Da definire" }
export function recognizeGuidedService(value?: string): Exclude<GuidedServiceId, "undefined"> | null { const normalized = normalizeServiceText(value ?? ""); if (!normalized) return null; return guidedServiceAliases.find((entry) => entry.aliases.some((alias) => normalized === normalizeServiceText(alias)))?.id ?? null }
function recognizeGuidedServices(value: string) { const parts = value.split(/[+,;/]/).map((part) => part.trim()).filter(Boolean); if (parts.length < 2) return [recognizeGuidedService(value)].filter((id): id is Exclude<GuidedServiceId, "undefined"> => Boolean(id)); return Array.from(new Set(parts.map(recognizeGuidedService).filter((id): id is Exclude<GuidedServiceId, "undefined"> => Boolean(id)))) }
export function detectGuidedCallServices(lead: CommercialLead): { serviceIds: GuidedServiceId[]; source: GuidedServiceDetectionSource; ambiguous: boolean; label: string } { const sources: Array<{ source: GuidedServiceDetectionSource; values: string[] }> = [{ source: "requested-services", values: (lead.services ?? []).filter(Boolean) }, { source: "primary-service", values: lead.service ? [lead.service] : [] }, { source: "original-request", values: lead.originalRequest?.projectType ? [lead.originalRequest.projectType] : [] }, { source: "form-submission", values: lead.formSubmission?.projectType ? [lead.formSubmission.projectType] : [] }]; for (const candidate of sources) { if (!candidate.values.length) continue; const recognized = Array.from(new Set(candidate.values.flatMap(recognizeGuidedServices))); if (recognized.length) return { serviceIds: recognized, source: candidate.source, ambiguous: recognized.length < candidate.values.length, label: recognized.map(guidedServiceLabel).join(" + ") }; return { serviceIds: [], source: candidate.source, ambiguous: true, label: "Servizio da confermare" } } return { serviceIds: [], source: "none", ambiguous: false, label: "Servizio da definire" } }

export const guidedCallPhases = [
  {
    id: "goal",
    title: "Obiettivo",
    script: "Se questo progetto funzionasse bene, quale risultato concreto dovrebbe portarvi?",
    hint: "Ascolta il risultato prima di anticipare la soluzione.",
    options: ["Più contatti", "Vendere online", "Rafforzare il brand", "Automatizzare", "Altro"],
  },
  {
    id: "project",
    title: "Progetto",
    script: "Confermiamo il servizio richiesto e ciò che deve essere realizzato?",
    hint: "Se ci sono più servizi, identifica quello principale.",
    options: ["Sito web", "E-commerce", "Landing page", "Campagne", "Automazioni", "Da definire"],
  },
  {
    id: "currentSituation",
    title: "Situazione attuale",
    script: "Oggi esiste già qualcosa oppure partiamo da zero?",
    hint: "Raccogli il punto di partenza senza trasformare la chiamata in un audit tecnico.",
    options: ["Partiamo da zero", "Esiste da rifare", "Esiste ma non funziona", "Materiali disponibili", "Da verificare"],
  },
  {
    id: "budgetTiming",
    title: "Budget e tempi",
    script: "Quale fascia di investimento e quale urgenza considerate realistiche?",
    hint: "Registra vincoli concreti; non negoziare durante la raccolta.",
    options: ["< 1.000 €", "1.000–2.500 €", "2.500–5.000 €", "5.000–10.000 €", "> 10.000 €", "Da definire"],
  },
  {
    id: "nextStep",
    title: "Prossimo passo",
    script: "Qual è il passaggio più utile da fissare adesso, con una responsabilità chiara?",
    hint: "Chiudi con un’azione e una data verificabili.",
    options: ["Inviare proposta", "Fissare incontro tecnico", "Richiedere materiali", "Fare follow-up", "Cliente deve decidere", "Non idoneo"],
  },
] as const;

export const guidedCallOutcomes = [
  "Lead da approfondire",
  "Qualificato",
  "Appuntamento tecnico",
  "Proposta da preparare",
  "Nessuna risposta",
  "Ricontattare",
  "Non idoneo",
  "Non interessato",
] as const;

export type GuidedCallOutcome = (typeof guidedCallOutcomes)[number];
export type GuidedCallMode = "first_contact" | "scheduled_appointment" | "follow_up"
export type GuidedCallMessageStatus = "Bozza" | "Da inviare" | "Inviato" | "Consegnato" | "Letto" | "Risposto" | "Fallito"
export type GuidedCallParticipantRole = "commerciale principale" | "consulente web" | "consulente tecnico" | "osservatore" | "passaggio di consegne"
export type GuidedCallMessage = { id: string; channel: "WhatsApp" | "Email"; template: "initial-working-hours" | "initial-out-of-hours" | "initial-email" | "no-answer" | "outcome"; subject?: string; body: string; recipient: string; operatorId: string; status: GuidedCallMessageStatus; createdAt: string; updatedAt: string; sentAt?: string }
export type GuidedCall = { id: string; leadId: string; status: "draft" | "completed"; currentPhase: number; operatorId: string; primarySellerId: string; mode?: GuidedCallMode; linkedAppointmentId?: string; previousCallId?: string; initialServiceIds?: GuidedServiceId[]; selectedServiceIds?: GuidedServiceId[]; primaryServiceId?: GuidedServiceId; serviceDetectionSource?: GuidedServiceDetectionSource; serviceSelectionUpdatedAt?: string; serviceSelectionUpdatedBy?: string; serviceSelectionReason?: string; participants: Array<{ userId: string; role: GuidedCallParticipantRole }>; startedAt: string; updatedAt: string; completedAt?: string; durationSeconds?: number; answers: Record<string, string | boolean | string[]>; messages: GuidedCallMessage[]; outcome?: GuidedCallOutcome; summary?: string; recommendedService?: string; suggestedProbability?: number; suggestedStage?: PipelineStage; confirmedProbability?: number; confirmedStage?: PipelineStage; nextAction?: string; nextActionAt?: string; nextAssigneeId?: string; technicalParticipantId?: string; materialChecklist?: string[]; followUpActivityId?: string; appointmentId?: string; timelineEventId?: string; historyEventId?: string }
export type GuidedCallCompletion = { outcome: GuidedCallOutcome; summary: string; recommendedService?: string; confirmedProbability: number; confirmedStage: PipelineStage; nextAction: string; nextActionAt: string; nextAssigneeId: string; technicalParticipantId?: string; createAppointment?: boolean; materialChecklist?: string[]; selectedServiceIds?: GuidedServiceId[]; primaryServiceId?: GuidedServiceId; serviceSelectionReason?: string }

export type GuidedCallDraft = {
  status: "draft" | "completed";
  phase: number;
  answers: Record<string, string>;
  outcome: GuidedCallOutcome;
  summary: string;
  nextAction: string;
  nextActionAt: string;
  probability: number;
  stage: PipelineStage;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export function defaultGuidedCallDraft(input: {
  service?: string;
  nextAction?: string;
  nextActionAt?: string;
  probability: number;
  stage: PipelineStage;
}): GuidedCallDraft {
  const fallbackNextActionAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const now = new Date().toISOString();
  return {
    status: "draft",
    phase: 0,
    answers: input.service ? { project: input.service } : {},
    outcome: "Lead da approfondire",
    summary: "",
    nextAction: input.nextAction || "Follow-up commerciale",
    nextActionAt: input.nextActionAt || fallbackNextActionAt,
    probability: input.probability,
    stage: input.stage,
    startedAt: now,
    updatedAt: now,
  };
}

export function parseGuidedCallDraft(value: unknown, fallback: GuidedCallDraft): GuidedCallDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const row = value as Record<string, unknown>;
  const outcome = guidedCallOutcomes.includes(row.outcome as GuidedCallOutcome)
    ? row.outcome as GuidedCallOutcome
    : fallback.outcome;
  return {
    ...fallback,
    status: row.status === "completed" ? "completed" : "draft",
    phase: Math.max(0, Math.min(guidedCallPhases.length - 1, Number(row.phase || 0))),
    answers: row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
      ? Object.fromEntries(Object.entries(row.answers as Record<string, unknown>).map(([key, answer]) => [key, String(answer || "")]))
      : fallback.answers,
    outcome,
    summary: String(row.summary || ""),
    nextAction: String(row.nextAction || fallback.nextAction),
    nextActionAt: String(row.nextActionAt || fallback.nextActionAt),
    probability: Math.max(0, Math.min(100, Number(row.probability ?? fallback.probability))),
    stage: String(row.stage || fallback.stage) as PipelineStage,
    startedAt: String(row.startedAt || fallback.startedAt),
    updatedAt: String(row.updatedAt || fallback.updatedAt),
    completedAt: row.completedAt ? String(row.completedAt) : undefined,
  };
}

export function guidedCallMetadata(draft: GuidedCallDraft) {
  return {
    source: "guided_call",
    schema_version: 1,
    guided_call: draft,
  };
}
