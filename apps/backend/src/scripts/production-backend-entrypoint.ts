import 'reflect-metadata';

import {
  ProductionMigrationError,
  consoleSafeMigrationLogger,
  productionMigrationErrorCode,
  runProductionMigrationCommand,
} from './production-migration-runtime';

export type ProductionBackendEntrypointDependencies = Readonly<{
  runMigrations?: () => Promise<unknown>;
  loadBackend?: () => Promise<unknown>;
}>;

export async function startProductionBackend(
  dependencies: ProductionBackendEntrypointDependencies = {},
): Promise<void> {
  const runMigrations = dependencies.runMigrations
    ?? (() => runProductionMigrationCommand({ mode: 'run' }));
  const loadBackend = dependencies.loadBackend ?? (async () => {
    const backend = await import('../main');
    await backend.bootstrap();
  });

  await runMigrations();
  try {
    await loadBackend();
  } catch {
    throw new ProductionMigrationError('BACKEND_BOOTSTRAP_FAILED');
  }
}

if (require.main === module) {
  void startProductionBackend().catch((error) => {
    consoleSafeMigrationLogger({
      event: 'backend_start_blocked',
      code: productionMigrationErrorCode(error),
      exitCode: 1,
    });
    process.exitCode = 1;
  });
}
