import type { PipelineStage } from "@/features/commercial/types";

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
