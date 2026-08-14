export const COMMERCIAL_POSITIVE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "appointment",
  "quote",
  "closed_won",
] as const;

export const COMMERCIAL_OUTCOME_STAGES = ["lost", "paused"] as const;

export type CommercialPositiveStage = (typeof COMMERCIAL_POSITIVE_STAGES)[number];
export type CommercialOutcomeStage = (typeof COMMERCIAL_OUTCOME_STAGES)[number];
export type CanonicalCommercialStage = CommercialPositiveStage | CommercialOutcomeStage;

export const COMMERCIAL_STAGE_LABELS: Record<CanonicalCommercialStage, string> = {
  new: "Nuovo",
  contacted: "Contattato",
  qualified: "Qualificato",
  appointment: "Appuntamento",
  quote: "Preventivo",
  closed_won: "Chiuso",
  lost: "Perso",
  paused: "In pausa",
};

export const COMMERCIAL_STAGE_ALIASES: Readonly<Record<string, CanonicalCommercialStage>> = {
  new: "new",
  new_lead: "new",
  to_contact: "new",
  contacted: "contacted",
  briefing_sent: "qualified",
  briefing_received: "qualified",
  qualified: "qualified",
  call_scheduled: "appointment",
  appointment: "appointment",
  quote_preparation: "quote",
  quote_sent: "quote",
  follow_up: "quote",
  quote: "quote",
  accepted: "closed_won",
  won: "closed_won",
  closed: "closed_won",
  closed_won: "closed_won",
  lost: "lost",
  paused: "paused",
};

export const DOFLOW_PIPELINE_GROUPS = [
  { id: "new", label: "Nuovo", targetStage: "new", color: "#6558e8" },
  { id: "contacted", label: "Contattato", targetStage: "contacted", color: "#5d8ff5" },
  { id: "qualified", label: "Qualificato", targetStage: "qualified", color: "#8d78e8" },
  { id: "appointment", label: "Appuntamento", targetStage: "appointment", color: "#de9a45" },
  { id: "quote", label: "Preventivo", targetStage: "quote", color: "#8fc98d" },
  { id: "closed_won", label: "Chiuso", targetStage: "closed_won", color: "#3fbd73" },
] as const;

export const LEGACY_PIPELINE_GROUPS = [
  { id: "new", label: "Nuovi", targetStage: "new_lead", stages: ["new_lead", "to_contact"], color: "#6558e8" },
  { id: "contacted", label: "Contattati", targetStage: "contacted", stages: ["contacted", "call_scheduled", "briefing_sent", "briefing_received"], color: "#5d8ff5" },
  { id: "quote", label: "Preventivo", targetStage: "quote_sent", stages: ["quote_preparation", "quote_sent", "follow_up"], color: "#8fc98d" },
  { id: "won", label: "Vinti", targetStage: "accepted", stages: ["accepted"], color: "#3fbd73" },
] as const;

export const DOFLOW_COMMERCIAL_STAGE_OPTIONS = [
  ...COMMERCIAL_POSITIVE_STAGES,
  ...COMMERCIAL_OUTCOME_STAGES,
].map((value) => ({ value, label: COMMERCIAL_STAGE_LABELS[value] }));

export const LEGACY_COMMERCIAL_STAGE_OPTIONS = [
  { value: "new_lead", label: "Nuovo lead" },
  { value: "to_contact", label: "Da contattare" },
  { value: "contacted", label: "Contattato" },
  { value: "call_scheduled", label: "Call fissata" },
  { value: "briefing_sent", label: "Brief inviato" },
  { value: "briefing_received", label: "Brief ricevuto" },
  { value: "quote_preparation", label: "Preventivo in preparazione" },
  { value: "quote_sent", label: "Preventivo inviato" },
  { value: "follow_up", label: "Follow-up" },
  { value: "accepted", label: "Vinta" },
  { value: "lost", label: "Persa" },
  { value: "paused", label: "In pausa" },
] as const;

export type CommercialStageNormalization =
  | { mapped: true; stage: CanonicalCommercialStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };

export function normalizeCommercialStage(value: unknown): CommercialStageNormalization {
  const raw = String(value ?? "").trim().toLowerCase();
  const stage = COMMERCIAL_STAGE_ALIASES[raw];
  if (!stage) return { mapped: false, raw };
  return { mapped: true, stage, raw, isLegacy: raw !== stage };
}

export function canonicalCommercialStage(value: unknown): CanonicalCommercialStage | null {
  const normalized = normalizeCommercialStage(value);
  return normalized.mapped ? normalized.stage : null;
}

export function normalizeCommercialStageQuery(value: string | null | undefined, doflow: boolean): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "all") return "all";
  if (doflow) {
    const normalized = normalizeCommercialStage(raw);
    return normalized.mapped ? normalized.stage : "all";
  }
  return LEGACY_PIPELINE_GROUPS.some((group) => group.id === raw) ? raw : "all";
}

export function commercialStageLabel(value: unknown, doflow: boolean): string {
  if (doflow) {
    const normalized = normalizeCommercialStage(value);
    return normalized.mapped ? COMMERCIAL_STAGE_LABELS[normalized.stage] : "Da verificare";
  }
  return LEGACY_COMMERCIAL_STAGE_OPTIONS.find((option) => option.value === value)?.label || String(value || "-");
}

export function canonicalizeCommercialStageItem<T extends { stage: string }>(item: T): T & { commercial_stage_unmapped?: boolean } {
  const normalized = normalizeCommercialStage(item.stage);
  return normalized.mapped
    ? { ...item, stage: normalized.stage }
    : { ...item, commercial_stage_unmapped: true };
}

export function isOpenCommercialStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return !["accepted", "lost", "paused"].includes(String(value || ""));
  const normalized = normalizeCommercialStage(value);
  return normalized.mapped
    && (COMMERCIAL_POSITIVE_STAGES as readonly string[]).includes(normalized.stage)
    && normalized.stage !== "closed_won";
}

export function commercialConversion(items: Array<{ stage: string }>, doflow: boolean): number {
  const won = items.filter((item) => doflow
    ? canonicalCommercialStage(item.stage) === "closed_won"
    : item.stage === "accepted").length;
  const lost = items.filter((item) => {
    return doflow ? canonicalCommercialStage(item.stage) === "lost" : item.stage === "lost";
  }).length;
  return won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
}
