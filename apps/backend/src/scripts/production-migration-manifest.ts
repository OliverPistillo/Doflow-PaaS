import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export type ProductionMigrationDefinition = Readonly<{
  timestamp: number;
  name: string;
  compiledFile: string;
}>;

export const PRODUCTION_MIGRATIONS = [
  {
    timestamp: 1714752000000,
    name: 'InitialPublicSchema1714752000000',
    compiledFile: '1714752000000-InitialPublicSchema.js',
  },
  {
    timestamp: 1750000000000,
    name: 'CreateTenantRegistry1750000000000',
    compiledFile: '1750000000000-CreateTenantRegistry.js',
  },
  {
    timestamp: 1760000000000,
    name: 'AddGoogleOAuthUsers1760000000000',
    compiledFile: '1760000000000-AddGoogleOAuthUsers.js',
  },
  {
    timestamp: 1770000000000,
    name: 'CreatePlatformAccessCatalog1770000000000',
    compiledFile: '1770000000000-CreatePlatformAccessCatalog.js',
  },
  {
    timestamp: 1780000000000,
    name: 'CreateBackupSchedules1780000000000',
    compiledFile: '1780000000000-CreateBackupSchedules.js',
  },
  {
    timestamp: 1790000000000,
    name: 'CreateCommercialCoreAuthority1790000000000',
    compiledFile: '1790000000000-CreateCommercialCoreAuthority.js',
  },
  {
    timestamp: 1800000000000,
    name: 'CreateDeliveryCoreAuthority1800000000000',
    compiledFile: '1800000000000-CreateDeliveryCoreAuthority.js',
  },
  {
    timestamp: 1810000000000,
    name: 'CreateCommerceCashCoreAuthority1810000000000',
    compiledFile: '1810000000000-CreateCommerceCashCoreAuthority.js',
  },
  {
    timestamp: 1820000000000,
    name: 'CreateDocumentRevenueCoreAuthority1820000000000',
    compiledFile: '1820000000000-CreateDocumentRevenueCoreAuthority.js',
  },
  {
    timestamp: 1830000000000,
    name: 'CreateCollaborationNotificationsRealtimeAuthority1830000000000',
    compiledFile: '1830000000000-CreateCollaborationNotificationsRealtimeAuthority.js',
  },
  {
    timestamp: 1840000000000,
    name: 'CreateAutomationPerformanceAuthority1840000000000',
    compiledFile: '1840000000000-CreateAutomationPerformanceAuthority.js',
  },
] as const satisfies readonly ProductionMigrationDefinition[];

export const PRODUCTION_MIGRATION_MAX =
  PRODUCTION_MIGRATIONS[PRODUCTION_MIGRATIONS.length - 1].timestamp;

export const PRODUCTION_MIGRATION_LOCK = Object.freeze({
  namespace: 'doflow-production-migrations-v1',
  key1: -1594877102,
  key2: -962476012,
});

const COMPILED_MIGRATION_PATTERN = /^\d{13}-.+\.js$/;

export function validateCompiledMigrationFileNames(
  fileNames: readonly string[],
): string[] {
  const actual = [...new Set(fileNames.filter((name) => COMPILED_MIGRATION_PATTERN.test(name)))].sort();
  const expected: string[] = PRODUCTION_MIGRATIONS
    .map((migration) => migration.compiledFile as string)
    .sort();
  const missing = expected.filter((name) => !actual.includes(name));
  const unknown = actual.filter((name) => !expected.includes(name));

  if (missing.length > 0 || unknown.length > 0) {
    const parts = [
      missing.length > 0 ? `missing=${missing.join(',')}` : '',
      unknown.length > 0 ? `unknown=${unknown.join(',')}` : '',
    ].filter(Boolean);
    throw new Error(`MIGRATION_ARTIFACTS_INVALID:${parts.join(';')}`);
  }

  return expected;
}

export function resolveCompiledProductionMigrations(directory: string): string[] {
  let fileNames: string[];
  try {
    fileNames = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    throw new Error('MIGRATION_ARTIFACTS_DIRECTORY_UNAVAILABLE');
  }

  return validateCompiledMigrationFileNames(fileNames).map((name) => resolve(directory, name));
}
