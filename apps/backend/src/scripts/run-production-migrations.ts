import 'reflect-metadata';

import {
  ProductionMigrationError,
  consoleSafeMigrationLogger,
  productionMigrationErrorCode,
  runProductionMigrationCommand,
  type ProductionMigrationMode,
} from './production-migration-runtime';

export function parseProductionMigrationMode(args: readonly string[]): ProductionMigrationMode {
  const mode = args[0] ?? 'run';
  if (mode !== 'run' && mode !== 'status') {
    throw new ProductionMigrationError('MIGRATION_MODE_INVALID');
  }
  return mode;
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const mode = parseProductionMigrationMode(args);
  await runProductionMigrationCommand({ mode });
}

if (require.main === module) {
  void main().catch((error) => {
    consoleSafeMigrationLogger({
      event: 'failed',
      code: productionMigrationErrorCode(error),
      exitCode: 1,
    });
    process.exitCode = 1;
  });
}
