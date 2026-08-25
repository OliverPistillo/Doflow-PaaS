import { parseProductionMigrationMode } from './run-production-migrations';

describe('production migration CLI', () => {
  it('uses run as the fail-closed container default', () => {
    expect(parseProductionMigrationMode([])).toBe('run');
    expect(parseProductionMigrationMode(['run'])).toBe('run');
  });

  it('supports a read-only status command', () => {
    expect(parseProductionMigrationMode(['status'])).toBe('status');
  });

  it('rejects unknown commands', () => {
    expect(() => parseProductionMigrationMode(['revert'])).toThrow('MIGRATION_MODE_INVALID');
  });
});
