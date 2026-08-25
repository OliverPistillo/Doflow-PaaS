import { provisionSchemaOnce } from './schema-provisioning-once';

describe('provisionSchemaOnce', () => {
  it('shares one in-flight promise and keeps a successful provision sticky', async () => {
    const target = {};
    let release: (() => void) | undefined;
    const provision = jest.fn(
      () => new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const first = provisionSchemaOnce(target, 'workspace:doflow', provision);
    const second = provisionSchemaOnce(target, 'workspace:doflow', provision);

    expect(second).toBe(first);
    expect(provision).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(provision).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toBeUndefined();

    const later = provisionSchemaOnce(target, 'workspace:doflow', provision);
    expect(later).toBe(first);
    await expect(later).resolves.toBeUndefined();
    expect(provision).toHaveBeenCalledTimes(1);
  });

  it('evicts a synchronous failure so the same key can be retried', async () => {
    const target = {};
    const failure = new Error('synthetic synchronous failure');
    const provision = jest
      .fn(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw failure;
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      provisionSchemaOnce(target, 'finance:doflow', provision),
    ).rejects.toBe(failure);
    await expect(
      provisionSchemaOnce(target, 'finance:doflow', provision),
    ).resolves.toBeUndefined();

    expect(provision).toHaveBeenCalledTimes(2);
  });

  it('evicts an asynchronous failure while deduplicating its callers', async () => {
    const target = {};
    const failure = new Error('synthetic asynchronous failure');
    const provision = jest
      .fn(() => Promise.resolve())
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);

    const first = provisionSchemaOnce(target, 'commerce:doflow', provision);
    const second = provisionSchemaOnce(target, 'commerce:doflow', provision);
    expect(second).toBe(first);

    await expect(first).rejects.toBe(failure);
    await expect(
      provisionSchemaOnce(target, 'commerce:doflow', provision),
    ).resolves.toBeUndefined();

    expect(provision).toHaveBeenCalledTimes(2);
  });

  it('isolates targets and provisioner/schema keys', async () => {
    const firstTarget = {};
    const secondTarget = {};
    const provision = jest.fn().mockResolvedValue(undefined);

    await Promise.all([
      provisionSchemaOnce(firstTarget, 'projects:doflow', provision),
      provisionSchemaOnce(firstTarget, 'projects:secondary', provision),
      provisionSchemaOnce(firstTarget, 'finance:doflow', provision),
      provisionSchemaOnce(secondTarget, 'projects:doflow', provision),
    ]);

    expect(provision).toHaveBeenCalledTimes(4);
  });
});
