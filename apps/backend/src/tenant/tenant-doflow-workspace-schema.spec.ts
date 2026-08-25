import { DataSource } from 'typeorm';
import { ensureDoflowWorkspaceTables } from './tenant-doflow-workspace.service';

describe('ensureDoflowWorkspaceTables schema provisioning', () => {
  function dataSourceDouble() {
    return {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as DataSource;
  }

  it('runs the six schema statements once for concurrent and later callers', async () => {
    const dataSource = dataSourceDouble();

    const attempts = Array.from({ length: 10 }, () =>
      ensureDoflowWorkspaceTables(dataSource, 'doflow'),
    );
    await Promise.all(attempts);

    expect(dataSource.query).toHaveBeenCalledTimes(6);

    await ensureDoflowWorkspaceTables(dataSource, 'DOFLOW');
    expect(dataSource.query).toHaveBeenCalledTimes(6);
  });

  it('keeps provisioning isolated by DataSource instance', async () => {
    const first = dataSourceDouble();
    const second = dataSourceDouble();

    await Promise.all([
      ensureDoflowWorkspaceTables(first, 'doflow'),
      ensureDoflowWorkspaceTables(second, 'doflow'),
    ]);

    expect(first.query).toHaveBeenCalledTimes(6);
    expect(second.query).toHaveBeenCalledTimes(6);
  });

  it('rejects a non-Doflow schema before running SQL', async () => {
    const dataSource = dataSourceDouble();

    await expect(
      ensureDoflowWorkspaceTables(dataSource, 'secondary'),
    ).rejects.toThrow('riservate al tenant doflow');
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
