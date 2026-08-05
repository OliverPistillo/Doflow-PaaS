import { JsonObject } from './tenant-site-proposals.types';

export type ProposalReadinessInput = {
  emailSubject: unknown;
  emailBody: unknown;
  commercialAnalysis: unknown;
  siteConfigValid: boolean;
  generationComplete?: boolean;
  requireGeneration?: boolean;
};

export type ProposalReadiness = { complete: boolean; reasons: string[] };

function record(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function populatedArray(value: unknown) { return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' ? Boolean(item.trim()) : record(item) && Object.values(item).some((field) => typeof field === 'string' && Boolean(field.trim()))); }

export function evaluateProposalReadiness(input: ProposalReadinessInput): ProposalReadiness {
  const reasons: string[] = [];
  const subject = typeof input.emailSubject === 'string' ? input.emailSubject.trim() : '';
  const body = typeof input.emailBody === 'string' ? input.emailBody.trim() : '';
  const analysis = record(input.commercialAnalysis) ? input.commercialAnalysis : {};
  if (subject.length < 8) reasons.push('email_subject');
  if (body.length < 250) reasons.push('email_body');
  if (!body.includes('[LINK_DEMO]')) reasons.push('email_link');
  if (typeof analysis.summary !== 'string' || analysis.summary.trim().length < 40) reasons.push('analysis_summary');
  for (const key of ['strengths','improvementAreas','opportunities','whyDoflow','evidence']) if (!populatedArray(analysis[key])) reasons.push(`analysis_${key}`);
  if (typeof analysis.requiresManualReview !== 'boolean') reasons.push('analysis_review');
  if (!input.siteConfigValid) reasons.push('site_config');
  if (input.requireGeneration && !input.generationComplete) reasons.push('generation');
  return { complete: reasons.length === 0, reasons };
}
