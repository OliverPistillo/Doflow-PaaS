export const PROJECT_POSITIVE_STAGES = [
  'not_started', 'onboarding', 'in_progress', 'qa_internal', 'internal_review',
  'ready_client', 'client_review', 'changes_requested', 'ready_publish',
  'published', 'delivered', 'support',
] as const;
export const PROJECT_LATERAL_STAGES = ['blocked', 'suspended', 'cancelled'] as const;
export type ProjectPositiveStage = (typeof PROJECT_POSITIVE_STAGES)[number];
export type ProjectLateralStage = (typeof PROJECT_LATERAL_STAGES)[number];
export type CanonicalProjectStage = ProjectPositiveStage | ProjectLateralStage;

export const PROJECT_STAGE_LABELS: Record<CanonicalProjectStage, string> = {
  not_started: 'Da avviare', onboarding: 'Onboarding', in_progress: 'In lavorazione',
  blocked: 'Bloccato', qa_internal: 'QA interno', internal_review: 'Revisione interna',
  ready_client: 'Pronto per il cliente', client_review: 'Revisione cliente',
  changes_requested: 'Modifiche richieste', ready_publish: 'Pronto alla pubblicazione',
  published: 'Pubblicato', delivered: 'Consegnato', support: 'Assistenza',
  suspended: 'Sospeso', cancelled: 'Annullato',
};

// Only unambiguous legacy values are normalized automatically. Old phase-like
// statuses are handled by the explicit mapper and reported as ambiguous.
export const PROJECT_STAGE_ALIASES: Readonly<Record<string, CanonicalProjectStage>> = {
  not_started: 'not_started', to_start: 'not_started', onboarding: 'onboarding',
  in_progress: 'in_progress', development: 'in_progress', blocked: 'blocked',
  qa_internal: 'qa_internal', qa: 'qa_internal', internal_review: 'internal_review',
  ready_client: 'ready_client', client_review: 'client_review',
  changes_requested: 'changes_requested', corrections: 'changes_requested',
  ready_publish: 'ready_publish', publishing: 'ready_publish', published: 'published',
  delivered: 'delivered', closed: 'delivered', support: 'support',
  maintenance: 'support', suspended: 'suspended', paused: 'suspended', cancelled: 'cancelled',
};

export const LEGACY_PROJECT_STATUSES = [
  'to_start', 'kickoff', 'materials_collection', 'materials', 'strategy', 'ux_ui',
  'copy_content', 'design', 'development', 'internal_review', 'client_review',
  'corrections', 'seo_performance', 'qa', 'publishing', 'training', 'delivered',
  'maintenance', 'closed', 'blocked', 'paused',
] as const;
export const PROJECT_ACTIVE_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => !['delivered', 'support', 'suspended', 'cancelled'].includes(stage))
  .map(([alias]) => alias);
export const PROJECT_DELIVERED_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => ['delivered', 'support'].includes(stage)).map(([alias]) => alias);
export const PROJECT_PAUSED_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => ['blocked', 'suspended'].includes(stage)).map(([alias]) => alias);

export type ProjectStageNormalization =
  | { mapped: true; stage: CanonicalProjectStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };
export function normalizeProjectStage(value: unknown): ProjectStageNormalization {
  const raw = String(value ?? '').trim().toLowerCase();
  const stage = PROJECT_STAGE_ALIASES[raw];
  return stage ? { mapped: true, stage, raw, isLegacy: raw !== stage } : { mapped: false, raw };
}
export function aliasesForProjectStage(value: unknown): readonly string[] | null {
  const normalized = normalizeProjectStage(value);
  if (!normalized.mapped) return null;
  return Object.entries(PROJECT_STAGE_ALIASES).filter(([, stage]) => stage === normalized.stage).map(([alias]) => alias);
}
export function projectStageLabel(value: unknown): string {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped ? PROJECT_STAGE_LABELS[normalized.stage] : 'Da verificare';
}
export function isOpenProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && !['delivered', 'support', 'suspended', 'cancelled'].includes(normalized.stage);
}
export function isTerminalProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && ['delivered', 'cancelled'].includes(normalized.stage);
}
export function isAtRiskProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && ['blocked', 'changes_requested', 'suspended'].includes(normalized.stage);
}
export function canonicalizeProjectRow<T extends { status?: unknown }>(row: T): T & { project_status_unmapped?: boolean } {
  const normalized = normalizeProjectStage(row.status);
  return normalized.mapped ? { ...row, status: normalized.stage } : { ...row, project_status_unmapped: true };
}
export function aggregateProjectStageValues(values: Record<string, number>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  for (const [raw, value] of Object.entries(values)) {
    const normalized = normalizeProjectStage(raw);
    const key = normalized.mapped ? normalized.stage : raw;
    aggregated[key] = (aggregated[key] || 0) + Number(value || 0);
  }
  return aggregated;
}
