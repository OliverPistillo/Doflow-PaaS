import { readFileSync } from 'fs';
import { join } from 'path';
import { TenantAutomationEngineService } from './tenant-automation-engine.service';
import { TenantDoflowPerformanceService } from './tenant-doflow-performance.service';

describe('Phase 4B automation and performance invariants', () => {
  it('evaluates only the controlled condition DSL', () => {
    const engine = new TenantAutomationEngineService({} as any, {} as any) as any;
    expect(engine.matchesConditions([{ field: 'record.status', operator: 'equals', value: 'won' }], { record: { status: 'won' } })).toBe(true);
    expect(engine.matchesConditions([{ field: 'record.amount', operator: 'greater_than', value: 10 }], { record: { amount: 12 } })).toBe(true);
    expect(engine.matchesConditions([{ field: '__proto__.polluted', operator: 'eval', value: 'true' }], {})).toBe(false);
    expect(engine.matchesConditions([{ field: 'record.status;DROP TABLE x', operator: 'equals', value: 'won' }], {})).toBe(false);
  });

  it('normalizes and validates point formulas on the server', () => {
    const request = { user: { id: 'a0000000-0000-4000-8000-000000000001', tenantId: 'doflow', role: 'owner' } };
    const service = new TenantDoflowPerformanceService({} as any, request) as any;
    const formula = service.policyFormula({ onTimeBase: 10, earlyPerDay: 2, earlyMaximum: 20, latePerDay: -2, lateMaximum: -20, qaFirstPass: 15, qaRejected: -10, reopened: -15, deliveredProject: 50, collectedPerHundredEuro: 1 });
    expect(formula).toMatchObject({ on_time: 10, early_per_day: 2, qa_first_pass: 15, collected_per_hundred_euro: 1 });
    expect(() => service.policyFormula({ onTimeBase: Number.NaN })).toThrow(/Formula on_time/);
  });

  it('keeps migration/schema additive and queue execution persistent', () => {
    const schema = readFileSync(join(__dirname, 'tenant-automation-performance-schema.ts'), 'utf8');
    const engine = readFileSync(join(__dirname, 'tenant-automation-engine.service.ts'), 'utf8');
    expect(schema).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    for (const table of ['automation_rule_versions', 'automation_execution_registry', 'automation_outbox', 'automation_dead_letters', 'point_policy_versions', 'point_ledger', 'ranking_config_versions', 'ranking_snapshots']) expect(schema).toContain(table);
    expect(engine).toContain('InjectQueue');
    expect(engine).toContain('Idempotency-Key');
    expect(engine).toContain('dead_letter');
    expect(engine).not.toMatch(/\beval\s*\(|new Function/);
  });
});
