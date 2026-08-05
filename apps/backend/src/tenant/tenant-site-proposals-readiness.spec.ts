import { evaluateProposalReadiness } from './tenant-site-proposals-readiness';

const body = `${'Testo email completo e verificabile. '.repeat(10)}[LINK_DEMO]`;
const analysis = { summary: 'Una sintesi commerciale completa e sufficientemente dettagliata per la proposta.', strengths: ['Punto di forza'], improvementAreas: ['Area da migliorare'], opportunities: ['Opportunità'], whyDoflow: ['Motivazione'], evidence: ['Evidenza'], requiresManualReview: true };
const complete = { emailSubject: 'Oggetto completo', emailBody: body, commercialAnalysis: analysis, siteConfigValid: true, generationComplete: true, requireGeneration: true };

describe('proposal semantic readiness', () => {
  it('accepts only a complete proposal with a current completed generation', () => expect(evaluateProposalReadiness(complete)).toEqual({ complete: true, reasons: [] }));
  it.each([
    ['empty subject', { emailSubject: '' }, 'email_subject'],
    ['empty body', { emailBody: '' }, 'email_body'],
    ['missing demo link', { emailBody: body.replace('[LINK_DEMO]', '') }, 'email_link'],
    ['empty analysis', { commercialAnalysis: {} }, 'analysis_summary'],
    ['invalid site config', { siteConfigValid: false }, 'site_config'],
    ['stale generation', { generationComplete: false }, 'generation'],
    ['missing runtime adapter', { adapterReady: false }, 'adapter'],
    ['disabled theme', { themeActive: false }, 'theme'],
  ])('invalidates positive state for %s', (_name, override, reason) => { const result = evaluateProposalReadiness({ ...complete, ...override }); expect(result.complete).toBe(false); expect(result.reasons).toContain(reason); });
  it('does not require generation while content is only being edited', () => expect(evaluateProposalReadiness({ ...complete, generationComplete: false, requireGeneration: false }).complete).toBe(true));
});
