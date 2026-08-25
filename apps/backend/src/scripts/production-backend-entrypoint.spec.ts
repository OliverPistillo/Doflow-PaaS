import { startProductionBackend } from './production-backend-entrypoint';

describe('production backend entrypoint', () => {
  it('loads NestJS only after production migrations complete', async () => {
    const order: string[] = [];
    await startProductionBackend({
      runMigrations: async () => { order.push('migrations'); },
      loadBackend: async () => { order.push('backend'); },
    });
    expect(order).toEqual(['migrations', 'backend']);
  });

  it('does not import or start NestJS after a migration failure', async () => {
    const loadBackend = jest.fn(async () => undefined);
    await expect(startProductionBackend({
      runMigrations: async () => { throw new Error('synthetic migration fault'); },
      loadBackend,
    })).rejects.toThrow('synthetic migration fault');
    expect(loadBackend).not.toHaveBeenCalled();
  });

  it('awaits NestJS bootstrap and converts its failure to a privacy-safe code', async () => {
    await expect(startProductionBackend({
      runMigrations: async () => undefined,
      loadBackend: async () => { throw new Error('synthetic sensitive bootstrap detail'); },
    })).rejects.toMatchObject({ code: 'BACKEND_BOOTSTRAP_FAILED' });
  });
});
