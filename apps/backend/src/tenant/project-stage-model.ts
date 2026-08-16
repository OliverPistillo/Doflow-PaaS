export const PROJECT_POSITIVE_STAGES = [
  'to_start',
  'materials',
  'design',
  'development',
  'review',
  'publishing',
  'delivered',
] as const;

export const PROJECT_LATERAL_STAGES = ['paused'] as const;

export type ProjectPositiveStage = (typeof PROJECT_POSITIVE_STAGES)[number];
export type ProjectLateralStage = (typeof PROJECT_LATERAL_STAGES)[number];
export type CanonicalProjectStage = ProjectPositiveStage | ProjectLateralStage;

export const PROJECT_STAGE_LABELS: Record<CanonicalProjectStage, string> = {
  to_start: 'Da avviare',
  materials: 'Materiali',
  design: 'Design',
  development: 'Sviluppo',
  review: 'Revisione',
  publishing: 'Pubblicazione',
  delivered: 'Consegnato',
  paused: 'In pausa',
};

export const PROJECT_STAGE_ALIASES: Readonly<Record<string, CanonicalProjectStage>> = {
  to_start: 'to_start',
  kickoff: 'materials',
  materials_collection: 'materials',
  materials: 'materials',
  strategy: 'design',
  ux_ui: 'design',
  copy_content: 'design',
  design: 'design',
  development: 'development',
  internal_review: 'review',
  client_review: 'review',
  corrections: 'review',
  seo_performance: 'review',
  qa: 'review',
  review: 'review',
  publishing: 'publishing',
  training: 'delivered',
  delivered: 'delivered',
  maintenance: 'delivered',
  closed: 'delivered',
  blocked: 'paused',
  paused: 'paused',
};

export const LEGACY_PROJECT_STATUSES = [
  'to_start', 'kickoff', 'materials_collection', 'strategy', 'ux_ui', 'copy_content',
  'development', 'internal_review', 'client_review', 'corrections', 'seo_performance',
  'qa', 'publishing', 'training', 'delivered', 'maintenance', 'closed', 'blocked',
] as const;

export const PROJECT_ACTIVE_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => !['delivered', 'paused'].includes(stage))
  .map(([alias]) => alias);

export const PROJECT_DELIVERED_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => stage === 'delivered')
  .map(([alias]) => alias);

export const PROJECT_PAUSED_STAGE_ALIASES = Object.entries(PROJECT_STAGE_ALIASES)
  .filter(([, stage]) => stage === 'paused')
  .map(([alias]) => alias);

export type ProjectStageNormalization =
  | { mapped: true; stage: CanonicalProjectStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };

export function normalizeProjectStage(value: unknown): ProjectStageNormalization {
  const raw = String(value ?? '').trim().toLowerCase();
  const stage = PROJECT_STAGE_ALIASES[raw];
  if (!stage) return { mapped: false, raw };
  return { mapped: true, stage, raw, isLegacy: raw !== stage };
}

export function aliasesForProjectStage(value: unknown): readonly string[] | null {
  const normalized = normalizeProjectStage(value);
  if (!normalized.mapped) return null;
  return Object.entries(PROJECT_STAGE_ALIASES)
    .filter(([, stage]) => stage === normalized.stage)
    .map(([alias]) => alias);
}

export function projectStageLabel(value: unknown): string {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped ? PROJECT_STAGE_LABELS[normalized.stage] : 'Da verificare';
}

export function isOpenProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && !['delivered', 'paused'].includes(normalized.stage);
}

export function isTerminalProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && normalized.stage === 'delivered';
}

export function isAtRiskProjectStage(value: unknown): boolean {
  const normalized = normalizeProjectStage(value);
  return normalized.mapped && normalized.stage === 'paused';
}

export function canonicalizeProjectRow<T extends { status?: unknown }>(row: T): T & { project_status_unmapped?: boolean } {
  const normalized = normalizeProjectStage(row.status);
  return normalized.mapped
    ? { ...row, status: normalized.stage }
    : { ...row, project_status_unmapped: true };
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
