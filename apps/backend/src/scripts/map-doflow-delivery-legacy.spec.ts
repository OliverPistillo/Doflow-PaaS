import { buildLegacyMapReport, classifyLegacyStatus, parseLegacyMapOptions } from './map-doflow-delivery-legacy';

describe('Doflow Delivery legacy mapper', () => {
  it('requires the exact tenant and keeps apply explicit', () => {
    expect(parseLegacyMapOptions(['--target=doflow'])).toEqual({ target: 'doflow', apply: false, confirm: undefined });
    expect(() => parseLegacyMapOptions(['--target=other'])).toThrow('exactly doflow');
  });

  it('maps only unambiguous states and reports phase-like values', () => {
    expect(classifyLegacyStatus('to_start')).toMatchObject({ classification: 'mapped', mapped: 'not_started' });
    expect(classifyLegacyStatus('materials')).toMatchObject({ classification: 'ambiguous', mapped: null });
    expect(classifyLegacyStatus('unexpected')).toMatchObject({ classification: 'unknown', mapped: null });
  });

  it('preserves identifiers and never invents QA, timers or history', () => {
    const report = buildLegacyMapReport([
      { id: '11111111-1111-4111-8111-111111111111', status: 'to_start', company_id: 'company' },
      { id: '22222222-2222-4222-8222-222222222222', status: 'design' },
    ]);
    expect(report.applicable).toEqual([{ id: '11111111-1111-4111-8111-111111111111', from: 'to_start', to: 'not_started' }]);
    expect(report.ambiguousCount).toBe(1);
    expect(report.preservation).toContain('company_id');
    expect(report).toMatchObject({ inventedHistory: false, inventedQa: false, inventedTimers: false });
  });
});
