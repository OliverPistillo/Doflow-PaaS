import { RedisScriptManager } from './redis-script.manager';

describe('RedisScriptManager', () => {
  it('ricarica e riesegue uno script quando Redis perde la cache SHA dopo un restart', async () => {
    const evalsha = jest
      .fn()
      .mockRejectedValueOnce(new Error('NOSCRIPT No matching script'))
      .mockResolvedValueOnce([1, 9, 'ok']);
    const script = jest.fn().mockResolvedValue('reloaded-sha');
    const manager = new RedisScriptManager({
      getClient: () => ({ evalsha, script }),
    } as never);
    const internals = manager as unknown as {
      scripts: Map<string, string>;
      scriptSources: Map<string, string>;
    };
    internals.scripts.set('traffic_guard', 'stale-sha');
    internals.scriptSources.set('traffic_guard', 'return {1, 9, "ok"}');

    await expect(
      manager.executeScript('traffic_guard', ['rate-limit'], [10, 1]),
    ).resolves.toEqual([1, 9, 'ok']);
    expect(script).toHaveBeenCalledWith(
      'LOAD',
      'return {1, 9, "ok"}',
    );
    expect(evalsha).toHaveBeenNthCalledWith(
      2,
      'reloaded-sha',
      1,
      'rate-limit',
      '10',
      '1',
    );
  });

  it('non nasconde errori Redis diversi da NOSCRIPT', async () => {
    const evalsha = jest.fn().mockRejectedValue(new Error('READONLY replica'));
    const manager = new RedisScriptManager({
      getClient: () => ({ evalsha }),
    } as never);
    const internals = manager as unknown as {
      scripts: Map<string, string>;
      scriptSources: Map<string, string>;
    };
    internals.scripts.set('traffic_guard', 'known-sha');
    internals.scriptSources.set('traffic_guard', 'return 1');

    await expect(
      manager.executeScript('traffic_guard', [], []),
    ).rejects.toThrow('READONLY replica');
  });
});
