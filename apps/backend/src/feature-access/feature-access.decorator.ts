import { SetMetadata } from '@nestjs/common';

export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface FeatureAccessRequirement {
  moduleKey?: string;
  minPlan?: PlanTier;
  /**
   * Default: true quando moduleKey è presente.
   * Se false, controlla solo che il piano includa il tier richiesto.
   */
  requireActiveSubscription?: boolean;
}

export const FEATURE_ACCESS_META_KEY = 'doflow:feature-access';

/**
 * Richiede che il tenant corrente abbia il modulo attivo/trial e un piano sufficiente.
 * Il tier minimo viene letto da public.platform_modules.minTier, salvo override minPlan.
 */
export const RequireFeature = (
  moduleKey: string,
  options: Omit<FeatureAccessRequirement, 'moduleKey'> = {},
) => SetMetadata(FEATURE_ACCESS_META_KEY, {
  ...options,
  moduleKey,
  requireActiveSubscription: options.requireActiveSubscription ?? true,
} satisfies FeatureAccessRequirement);

/** Richiede solo un piano minimo, senza vincolare uno specifico modulo. */
export const RequirePlan = (minPlan: PlanTier) =>
  SetMetadata(FEATURE_ACCESS_META_KEY, {
    minPlan,
    requireActiveSubscription: false,
  } satisfies FeatureAccessRequirement);
