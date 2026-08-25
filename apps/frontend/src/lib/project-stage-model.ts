export const PROJECT_POSITIVE_STAGES = [
  "not_started", "onboarding", "in_progress", "qa_internal", "internal_review",
  "ready_client", "client_review", "changes_requested", "ready_publish",
  "published", "delivered", "support",
] as const;
export const PROJECT_LATERAL_STAGES = ["blocked", "suspended", "cancelled"] as const;
export type ProjectPositiveStage = (typeof PROJECT_POSITIVE_STAGES)[number];
export type ProjectLateralStage = (typeof PROJECT_LATERAL_STAGES)[number];
export type CanonicalProjectStage = ProjectPositiveStage | ProjectLateralStage;
export const PROJECT_STAGE_LABELS: Record<CanonicalProjectStage, string> = {
  not_started: "Da avviare", onboarding: "Onboarding", in_progress: "In lavorazione",
  blocked: "Bloccato", qa_internal: "QA interno", internal_review: "Revisione interna",
  ready_client: "Pronto per il cliente", client_review: "Revisione cliente",
  changes_requested: "Modifiche richieste", ready_publish: "Pronto alla pubblicazione",
  published: "Pubblicato", delivered: "Consegnato", support: "Assistenza",
  suspended: "Sospeso", cancelled: "Annullato",
};
export const PROJECT_STAGE_ALIASES: Readonly<Record<string, CanonicalProjectStage>> = {
  not_started: "not_started", to_start: "not_started", onboarding: "onboarding",
  in_progress: "in_progress", development: "in_progress", blocked: "blocked",
  qa_internal: "qa_internal", qa: "qa_internal", internal_review: "internal_review",
  ready_client: "ready_client", client_review: "client_review",
  changes_requested: "changes_requested", corrections: "changes_requested",
  ready_publish: "ready_publish", publishing: "ready_publish", published: "published",
  delivered: "delivered", closed: "delivered", support: "support",
  maintenance: "support", suspended: "suspended", paused: "suspended", cancelled: "cancelled",
};
export const DOFLOW_PROJECT_STAGE_OPTIONS = [...PROJECT_POSITIVE_STAGES, ...PROJECT_LATERAL_STAGES]
  .map((value) => ({ value, label: PROJECT_STAGE_LABELS[value] }));
export const LEGACY_PROJECT_STAGE_OPTIONS = [
  { value: "to_start", label: "Da avviare" }, { value: "kickoff", label: "Kick-off" },
  { value: "materials_collection", label: "Raccolta materiali" }, { value: "strategy", label: "Strategia" },
  { value: "ux_ui", label: "UX/UI" }, { value: "copy_content", label: "Copy/contenuti" },
  { value: "development", label: "Sviluppo" }, { value: "internal_review", label: "Revisione interna" },
  { value: "client_review", label: "Revisione cliente" }, { value: "corrections", label: "Correzioni" },
  { value: "seo_performance", label: "SEO/Performance" }, { value: "qa", label: "QA" },
  { value: "publishing", label: "Pubblicazione" }, { value: "training", label: "Formazione" },
  { value: "delivered", label: "Consegnato" }, { value: "maintenance", label: "Manutenzione" },
  { value: "closed", label: "Chiuso" }, { value: "blocked", label: "Bloccato" },
] as const;
export type ProjectStageNormalization =
  | { mapped: true; stage: CanonicalProjectStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };
export function normalizeProjectStage(value: unknown): ProjectStageNormalization {
  const raw = String(value ?? "").trim().toLowerCase();
  const stage = PROJECT_STAGE_ALIASES[raw];
  return stage ? { mapped: true, stage, raw, isLegacy: raw !== stage } : { mapped: false, raw };
}
export function canonicalProjectStage(value: unknown): CanonicalProjectStage | null {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped ? normalized.stage : null;
}
export function normalizeProjectStageQuery(value: string | null | undefined, doflow: boolean): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "all" || raw === "__all__") return "all";
  if (!doflow) return LEGACY_PROJECT_STAGE_OPTIONS.some((option) => option.value === raw) ? raw : "all";
  return canonicalProjectStage(raw) ?? "all";
}
export function projectStageLabel(value: unknown, doflow: boolean): string {
  if (doflow) {
    const stage = canonicalProjectStage(value);
    return stage ? PROJECT_STAGE_LABELS[stage] : "Da verificare";
  }
  return LEGACY_PROJECT_STAGE_OPTIONS.find((option) => option.value === value)?.label || String(value || "-");
}
export function canonicalizeProjectItem<T extends { status?: unknown }>(item: T): T & { project_status_unmapped?: boolean } {
  const stage = canonicalProjectStage(item.status);
  return stage ? { ...item, status: stage } : { ...item, project_status_unmapped: true };
}
export function isActiveProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return !["delivered", "closed"].includes(String(value || ""));
  const stage = canonicalProjectStage(value);
  return Boolean(stage && !["delivered", "support", "suspended", "cancelled"].includes(stage));
}
export function isDeliveredProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return ["delivered", "closed"].includes(String(value || ""));
  return ["delivered", "support"].includes(canonicalProjectStage(value) || "");
}
export function isRiskProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return String(value || "") === "blocked";
  return ["blocked", "changes_requested", "suspended"].includes(canonicalProjectStage(value) || "");
}
export function aggregateProjectStageValues(values: Record<string, unknown>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  for (const [raw, value] of Object.entries(values || {})) {
    const key = canonicalProjectStage(raw) ?? raw;
    aggregated[key] = (aggregated[key] || 0) + Number(value || 0);
  }
  return aggregated;
}
