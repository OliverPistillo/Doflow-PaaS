import { JsonObject } from './tenant-site-proposals.types';
import { ProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';
import { sha256 } from './tenant-site-proposals-validation';

export type ProposalPersonalizationDelta = {
  changedVisiblePaths: string[];
  unchangedVisiblePaths: string[];
  changedVisibleCount: number;
  personalizationFingerprint: string;
  sufficient: boolean;
  missingRequirements: string[][];
};

function valueAt(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function semantic(value: unknown): string {
  if (typeof value === 'string') return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return JSON.stringify(value.map(semantic));
  if (value && typeof value === 'object') {
    return JSON.stringify(Object.fromEntries(Object.entries(value as JsonObject).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, semantic(nested)])));
  }
  return JSON.stringify(value) ?? '';
}

export function evaluateProposalPersonalizationDelta(
  baseConfig: JsonObject,
  finalConfig: JsonObject,
  adapter: ProposalContentProfileAdapter,
): ProposalPersonalizationDelta {
  const changedVisiblePaths = adapter.requiredVisibleTextPaths.filter((path) => semantic(valueAt(baseConfig, path)) !== semantic(valueAt(finalConfig, path)));
  const changed = new Set(changedVisiblePaths);
  const unchangedVisiblePaths = adapter.requiredVisibleTextPaths.filter((path) => !changed.has(path));
  const missingRequirements = adapter.visibleChangeRequirements
    .filter((paths) => !paths.some((path) => changed.has(path)))
    .map((paths) => [...paths]);
  const values = Object.fromEntries(adapter.requiredVisibleTextPaths.map((path) => [path, semantic(valueAt(finalConfig, path))]));
  return {
    changedVisiblePaths,
    unchangedVisiblePaths,
    changedVisibleCount: changedVisiblePaths.length,
    personalizationFingerprint: sha256(JSON.stringify(values)),
    sufficient: changedVisiblePaths.length >= adapter.minimumVisibleChanges && missingRequirements.length === 0 && semantic(baseConfig) !== semantic(finalConfig),
    missingRequirements,
  };
}

export function assertProposalPersonalizationDelta(baseConfig: JsonObject, finalConfig: JsonObject, adapter: ProposalContentProfileAdapter) {
  const delta = evaluateProposalPersonalizationDelta(baseConfig, finalConfig, adapter);
  if (!delta.sufficient) throw new Error('visible_personalization_delta_insufficient');
  return delta;
}
