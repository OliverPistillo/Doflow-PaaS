import { buildAutomationPerformanceLegacyReport, parseAutomationPerformanceLegacyOptions } from './map-doflow-automation-performance-legacy';

describe('Doflow automation/performance legacy mapper', () => {
  it('is a Doflow-only dry-run unless apply is explicit', () => {
    expect(parseAutomationPerformanceLegacyOptions([])).toEqual({ tenant: 'doflow', apply: false });
    expect(parseAutomationPerformanceLegacyOptions(['--tenant=doflow', '--apply'])).toEqual({ tenant: 'doflow', apply: true });
    expect(() => parseAutomationPerformanceLegacyOptions(['--tenant=other'])).toThrow(/restricted/);
  });

  it('reports authoritative sources without inventing points or rankings', () => {
    const report = buildAutomationPerformanceLegacyReport({ rules: 3, runs: 9, goals: 2, versionedRules: 3, pointLedger: 0, snapshots: 0 });
    expect(report).toMatchObject({ tenant: 'doflow', sourceAutomationRules: 3, sourceAutomationRuns: 9, sourceGoals: 2, ambiguousPointEvents: 0 });
    expect(report.note).toMatch(/Nessun punto o snapshot/);
  });
});
