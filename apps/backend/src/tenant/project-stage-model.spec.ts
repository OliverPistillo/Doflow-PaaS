import {
  aggregateProjectStageValues,
  aliasesForProjectStage,
  isAtRiskProjectStage,
  isOpenProjectStage,
  isTerminalProjectStage,
  normalizeProjectStage,
  PROJECT_LATERAL_STAGES,
  PROJECT_POSITIVE_STAGES,
  PROJECT_STAGE_ALIASES,
  projectStageLabel,
} from './project-stage-model';

describe('project-stage-model', () => {
  const approvedMapping: Record<string, string> = {
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

  it('keeps the approved positive order and paused separate', () => {
    expect(PROJECT_POSITIVE_STAGES).toEqual([
      'to_start', 'materials', 'design', 'development', 'review', 'publishing', 'delivered',
    ]);
    expect(PROJECT_LATERAL_STAGES).toEqual(['paused']);
  });

  it.each(Object.entries(approvedMapping))('maps %s to %s', (raw, expected) => {
    expect(normalizeProjectStage(raw)).toMatchObject({ mapped: true, stage: expected });
  });

  it('does not silently change the approved mapping', () => {
    expect(PROJECT_STAGE_ALIASES).toEqual(approvedMapping);
  });

  it('keeps unknown values diagnostic and outside canonical stages', () => {
    expect(normalizeProjectStage('unexpected')).toEqual({ mapped: false, raw: 'unexpected' });
    expect(projectStageLabel('unexpected')).toBe('Da verificare');
    expect(isOpenProjectStage('unexpected')).toBe(false);
  });

  it('expands canonical filters to all aliases', () => {
    expect(aliasesForProjectStage('review')).toEqual([
      'internal_review', 'client_review', 'corrections', 'seo_performance', 'qa', 'review',
    ]);
  });

  it('keeps delivered terminal and paused at risk, not open', () => {
    expect(isTerminalProjectStage('maintenance')).toBe(true);
    expect(isOpenProjectStage('development')).toBe(true);
    expect(isOpenProjectStage('paused')).toBe(false);
    expect(isAtRiskProjectStage('blocked')).toBe(true);
    expect(isTerminalProjectStage('paused')).toBe(false);
  });

  it('aggregates legacy values under canonical keys without losing unknowns', () => {
    expect(aggregateProjectStageValues({ client_review: 2, qa: 1, review: 3, odd: 4 })).toEqual({
      review: 6,
      odd: 4,
    });
  });
});
