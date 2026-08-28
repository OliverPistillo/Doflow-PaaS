import {
  PRODUCTION_MIGRATION_MAX,
  PRODUCTION_MIGRATIONS,
  validateCompiledMigrationFileNames,
} from './production-migration-manifest';

describe('production migration manifest', () => {
  const compiledFiles = PRODUCTION_MIGRATIONS.map((migration) => migration.compiledFile);

  it('pins the exact compiled 171, 175-187 chain', () => {
    expect(PRODUCTION_MIGRATIONS).toHaveLength(14);
    expect(PRODUCTION_MIGRATIONS.map((migration) => migration.timestamp)).toEqual([
      1714752000000,
      1750000000000,
      1760000000000,
      1770000000000,
      1780000000000,
      1790000000000,
      1800000000000,
      1810000000000,
      1820000000000,
      1830000000000,
      1840000000000,
      1850000000000,
      1860000000000,
      1870000000000,
    ]);
    expect(PRODUCTION_MIGRATION_MAX).toBe(1870000000000);
    expect(validateCompiledMigrationFileNames(compiledFiles)).toEqual([...compiledFiles].sort());
  });

  it('fails closed when a compiled migration is missing', () => {
    expect(() => validateCompiledMigrationFileNames(compiledFiles.slice(1)))
      .toThrow('MIGRATION_ARTIFACTS_INVALID');
  });

  it('fails closed when an unknown or future compiled migration is present', () => {
    expect(() => validateCompiledMigrationFileNames([
      ...compiledFiles,
      '1870000000000-UnknownFutureMigration.js',
    ])).toThrow('MIGRATION_ARTIFACTS_INVALID');
  });
});
