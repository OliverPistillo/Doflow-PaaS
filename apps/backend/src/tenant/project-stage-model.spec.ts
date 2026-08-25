import {
  aggregateProjectStageValues, aliasesForProjectStage, isAtRiskProjectStage,
  isOpenProjectStage, isTerminalProjectStage, normalizeProjectStage,
  PROJECT_LATERAL_STAGES, PROJECT_POSITIVE_STAGES, PROJECT_STAGE_ALIASES,
  projectStageLabel,
} from './project-stage-model';

describe('Delivery project-stage-model', () => {
  it('adopts the complete reference state machine', () => {
    expect([...PROJECT_POSITIVE_STAGES, ...PROJECT_LATERAL_STAGES]).toEqual(expect.arrayContaining([
      'not_started', 'onboarding', 'in_progress', 'blocked', 'qa_internal',
      'internal_review', 'ready_client', 'client_review', 'changes_requested',
      'ready_publish', 'published', 'delivered', 'support', 'suspended', 'cancelled',
    ]));
  });

  it('maps only conservative legacy aliases', () => {
    expect(normalizeProjectStage('to_start')).toMatchObject({ mapped: true, stage: 'not_started', isLegacy: true });
    expect(normalizeProjectStage('qa')).toMatchObject({ mapped: true, stage: 'qa_internal' });
    expect(normalizeProjectStage('maintenance')).toMatchObject({ mapped: true, stage: 'support' });
    expect(normalizeProjectStage('materials')).toEqual({ mapped: false, raw: 'materials' });
    expect(PROJECT_STAGE_ALIASES.design).toBeUndefined();
  });

  it('keeps unknown and ambiguous values diagnostic', () => {
    expect(projectStageLabel('design')).toBe('Da verificare');
    expect(isOpenProjectStage('design')).toBe(false);
  });

  it('expands filters across conservative aliases', () => {
    expect(aliasesForProjectStage('ready_publish')).toEqual(['ready_publish', 'publishing']);
  });

  it('classifies terminal, open and at-risk states', () => {
    expect(isTerminalProjectStage('delivered')).toBe(true);
    expect(isTerminalProjectStage('cancelled')).toBe(true);
    expect(isOpenProjectStage('in_progress')).toBe(true);
    expect(isOpenProjectStage('support')).toBe(false);
    expect(isAtRiskProjectStage('changes_requested')).toBe(true);
  });

  it('aggregates aliases without losing ambiguous values', () => {
    expect(aggregateProjectStageValues({ qa: 1, qa_internal: 2, materials: 3 })).toEqual({ qa_internal: 3, materials: 3 });
  });
});
