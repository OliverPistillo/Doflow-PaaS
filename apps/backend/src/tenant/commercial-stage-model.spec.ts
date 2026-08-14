import {
  aggregateCommercialStageValues,
  aliasesForCommercialStage,
  COMMERCIAL_OUTCOME_STAGES,
  COMMERCIAL_POSITIVE_STAGES,
  COMMERCIAL_STAGE_ALIASES,
  commercialStageLabel,
  isCanonicalCommercialStage,
  normalizeCommercialStage,
} from './commercial-stage-model';

describe('commercial stage model', () => {
  it.each(Object.entries(COMMERCIAL_STAGE_ALIASES))('normalizza %s in %s', (legacy, canonical) => {
    expect(normalizeCommercialStage(legacy)).toEqual(expect.objectContaining({ mapped: true, stage: canonical }));
  });

  it('mantiene ordine e separazione tra percorso positivo ed esiti', () => {
    expect(COMMERCIAL_POSITIVE_STAGES).toEqual(['new', 'contacted', 'qualified', 'appointment', 'quote', 'closed_won']);
    expect(COMMERCIAL_OUTCOME_STAGES).toEqual(['lost', 'paused']);
  });

  it('non trasforma uno sconosciuto in new e non lo elimina dalle aggregazioni', () => {
    expect(normalizeCommercialStage('needs_review')).toEqual({ mapped: false, raw: 'needs_review' });
    expect(aggregateCommercialStageValues({ new_lead: 2, to_contact: 3, needs_review: 1 })).toEqual({
      new: 5,
      needs_review: 1,
    });
  });

  it('espande i filtri canonici e non espande valori sconosciuti', () => {
    expect(aliasesForCommercialStage('quote')).toEqual(['quote_preparation', 'quote_sent', 'follow_up', 'quote']);
    expect(aliasesForCommercialStage('quote_sent')).toEqual(['quote_preparation', 'quote_sent', 'follow_up', 'quote']);
    expect(aliasesForCommercialStage('unknown')).toBeNull();
  });

  it('espone Chiuso e mai il valore tecnico come label', () => {
    expect(commercialStageLabel('closed_won')).toBe('Chiuso');
    expect(isCanonicalCommercialStage('closed_won')).toBe(true);
    expect(isCanonicalCommercialStage('closed')).toBe(false);
  });
});
