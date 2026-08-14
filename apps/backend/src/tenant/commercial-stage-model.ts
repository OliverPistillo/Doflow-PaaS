export const DOFLOW_TENANT_SCHEMA = 'doflow';

export const COMMERCIAL_POSITIVE_STAGES = [
  'new',
  'contacted',
  'qualified',
  'appointment',
  'quote',
  'closed_won',
] as const;

export const COMMERCIAL_OUTCOME_STAGES = ['lost', 'paused'] as const;

export type CommercialPositiveStage = (typeof COMMERCIAL_POSITIVE_STAGES)[number];
export type CommercialOutcomeStage = (typeof COMMERCIAL_OUTCOME_STAGES)[number];
export type CanonicalCommercialStage = CommercialPositiveStage | CommercialOutcomeStage;

export const COMMERCIAL_STAGE_LABELS: Record<CanonicalCommercialStage, string> = {
  new: 'Nuovo',
  contacted: 'Contattato',
  qualified: 'Qualificato',
  appointment: 'Appuntamento',
  quote: 'Preventivo',
  closed_won: 'Chiuso',
  lost: 'Perso',
  paused: 'In pausa',
};

export const COMMERCIAL_STAGE_ALIASES: Readonly<Record<string, CanonicalCommercialStage>> = {
  new: 'new',
  new_lead: 'new',
  to_contact: 'new',
  contacted: 'contacted',
  briefing_sent: 'qualified',
  briefing_received: 'qualified',
  qualified: 'qualified',
  call_scheduled: 'appointment',
  appointment: 'appointment',
  quote_preparation: 'quote',
  quote_sent: 'quote',
  follow_up: 'quote',
  quote: 'quote',
  accepted: 'closed_won',
  won: 'closed_won',
  closed: 'closed_won',
  closed_won: 'closed_won',
  lost: 'lost',
  paused: 'paused',
};

export type CommercialStageNormalization =
  | { mapped: true; stage: CanonicalCommercialStage; raw: string; isLegacy: boolean }
  | { mapped: false; raw: string };

export function isDoflowTenant(schema: string | undefined | null): boolean {
  return String(schema || '').trim().toLowerCase() === DOFLOW_TENANT_SCHEMA;
}

export function isCanonicalCommercialStage(value: unknown): value is CanonicalCommercialStage {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (COMMERCIAL_POSITIVE_STAGES as readonly string[]).includes(normalized)
    || (COMMERCIAL_OUTCOME_STAGES as readonly string[]).includes(normalized);
}

export function normalizeCommercialStage(value: unknown): CommercialStageNormalization {
  const raw = String(value ?? '').trim().toLowerCase();
  const stage = COMMERCIAL_STAGE_ALIASES[raw];
  if (!stage) return { mapped: false, raw };
  return { mapped: true, stage, raw, isLegacy: raw !== stage };
}

export function aliasesForCommercialStage(value: unknown): readonly string[] | null {
  const normalized = normalizeCommercialStage(value);
  if (!normalized.mapped) return null;
  return Object.entries(COMMERCIAL_STAGE_ALIASES)
    .filter(([, stage]) => stage === normalized.stage)
    .map(([alias]) => alias);
}

export function commercialStageLabel(stage: CanonicalCommercialStage): string {
  return COMMERCIAL_STAGE_LABELS[stage];
}

export function aggregateCommercialStageValues(values: Record<string, number>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  for (const [raw, value] of Object.entries(values)) {
    const normalized = normalizeCommercialStage(raw);
    const key = normalized.mapped ? normalized.stage : raw;
    aggregated[key] = (aggregated[key] || 0) + Number(value || 0);
  }
  return aggregated;
}
