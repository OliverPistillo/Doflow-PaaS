export const PROJECT_POSITIVE_STAGES = [
  "to_start",
  "materials",
  "design",
  "development",
  "review",
  "publishing",
  "delivered",
] as const;

export const PROJECT_LATERAL_STAGES = ["paused"] as const;

export type ProjectPositiveStage = (typeof PROJECT_POSITIVE_STAGES)[number];
export type ProjectLateralStage = (typeof PROJECT_LATERAL_STAGES)[number];
export type CanonicalProjectStage = ProjectPositiveStage | ProjectLateralStage;

export const PROJECT_STAGE_LABELS: Record<CanonicalProjectStage, string> = {
  to_start: "Da avviare",
  materials: "Materiali",
  design: "Design",
  development: "Sviluppo",
  review: "Revisione",
  publishing: "Pubblicazione",
  delivered: "Consegnato",
  paused: "In pausa",
};

export const PROJECT_STAGE_ALIASES: Readonly<Record<string, CanonicalProjectStage>> = {
  to_start: "to_start",
  kickoff: "materials",
  materials_collection: "materials",
  materials: "materials",
  strategy: "design",
  ux_ui: "design",
  copy_content: "design",
  design: "design",
  development: "development",
  internal_review: "review",
  client_review: "review",
  corrections: "review",
  seo_performance: "review",
  qa: "review",
  review: "review",
  publishing: "publishing",
  training: "delivered",
  delivered: "delivered",
  maintenance: "delivered",
  closed: "delivered",
  blocked: "paused",
  paused: "paused",
};

export const DOFLOW_PROJECT_STAGE_OPTIONS = [
  ...PROJECT_POSITIVE_STAGES,
  ...PROJECT_LATERAL_STAGES,
].map((value) => ({ value, label: PROJECT_STAGE_LABELS[value] }));

export const LEGACY_PROJECT_STAGE_OPTIONS = [
  { value: "to_start", label: "Da avviare" },
  { value: "kickoff", label: "Kick-off" },
  { value: "materials_collection", label: "Raccolta materiali" },
  { value: "strategy", label: "Strategia" },
  { value: "ux_ui", label: "UX/UI" },
  { value: "copy_content", label: "Copy/contenuti" },
  { value: "development", label: "Sviluppo" },
  { value: "internal_review", label: "Revisione interna" },
  { value: "client_review", label: "Revisione cliente" },
  { value: "corrections", label: "Correzioni" },
  { value: "seo_performance", label: "SEO/Performance" },
  { value: "qa", label: "QA" },
  { value: "publishing", label: "Pubblicazione" },
  { value: "training", label: "Formazione" },
  { value: "delivered", label: "Consegnato" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "closed", label: "Chiuso" },
  { value: "blocked", label: "Bloccato" },
] as const;

export type ProjectStageNormalization =
  | { mapped: true; stage: CanonicalProjectStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };

export function normalizeProjectStage(value: unknown): ProjectStageNormalization {
  const raw = String(value ?? "").trim().toLowerCase();
  const stage = PROJECT_STAGE_ALIASES[raw];
  if (!stage) return { mapped: false, raw };
  return { mapped: true, stage, raw, isLegacy: raw !== stage };
}

export function canonicalProjectStage(value: unknown): CanonicalProjectStage | null {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped ? normalized.stage : null;
}

export function normalizeProjectStageQuery(value: string | null | undefined, doflow: boolean): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "all" || raw === "__all__") return "all";
  if (!doflow) return LEGACY_PROJECT_STAGE_OPTIONS.some((option) => option.value === raw) ? raw : "all";
  const normalized = normalizeProjectStage(raw);
  return normalized.mapped ? normalized.stage : "all";
}

export function projectStageLabel(value: unknown, doflow: boolean): string {
  if (doflow) {
    const normalized = normalizeProjectStage(value);
    return normalized.mapped ? PROJECT_STAGE_LABELS[normalized.stage] : "Da verificare";
  }
  return LEGACY_PROJECT_STAGE_OPTIONS.find((option) => option.value === value)?.label || String(value || "-");
}

export function canonicalizeProjectItem<T extends { status?: unknown }>(item: T): T & { project_status_unmapped?: boolean } {
  const normalized = normalizeProjectStage(item.status);
  return normalized.mapped
    ? { ...item, status: normalized.stage }
    : { ...item, project_status_unmapped: true };
}

export function isActiveProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return !["delivered", "closed"].includes(String(value || ""));
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && !["delivered", "paused"].includes(normalized.stage);
}

export function isDeliveredProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return ["delivered", "closed"].includes(String(value || ""));
  return canonicalProjectStage(value) === "delivered";
}

export function isRiskProjectStage(value: unknown, doflow: boolean): boolean {
  if (!doflow) return String(value || "") === "blocked";
  return canonicalProjectStage(value) === "paused";
}

export function aggregateProjectStageValues(values: Record<string, unknown>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  for (const [raw, value] of Object.entries(values || {})) {
    const normalized = normalizeProjectStage(raw);
    const key = normalized.mapped ? normalized.stage : raw;
    aggregated[key] = (aggregated[key] || 0) + Number(value || 0);
  }
  return aggregated;
}
