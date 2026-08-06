import { BadRequestException } from '@nestjs/common';
import { TenantSiteProposalsPreparationProgressService } from './tenant-site-proposals-preparation-progress.service';

const runId = '650e8400-e29b-41d4-a716-446655440000';
const proposalId = '550e8400-e29b-41d4-a716-446655440000';

describe('site proposal persisted preparation progress', () => {
  const make = (options: { updateProgress?: number | null; failProgress?: number | null; failProposalUpdate?: boolean } = {}) => {
    const timestamp = '2026-08-06T08:00:00.000Z';
    const query = jest.fn(async (sql: string, params: unknown[]) => sql.includes('site_proposal_preparation_runs') ? [{ progress_percent: options.updateProgress ?? params[0] ?? 0, progress_stage: params[1], progress_message: params[2], progress_updated_at: timestamp, heartbeat_at: timestamp, provider: params[4] }] : []);
    let runStatus = 'running';
    const runner: any = {
      isTransactionActive: false,
      connect: jest.fn(),
      startTransaction: jest.fn(async function (this: any) { this.isTransactionActive = true; }),
      commitTransaction: jest.fn(async function (this: any) { this.isTransactionActive = false; }),
      rollbackTransaction: jest.fn(async function (this: any) { runStatus = 'running'; this.isTransactionActive = false; }),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT id FROM') && sql.includes('site_proposal_preparation_runs')) return [{ id: runId }];
        if (sql.includes('SELECT id FROM') && sql.includes('site_proposals')) return [{ id: proposalId }];
        if (sql.includes('UPDATE') && sql.includes('site_proposal_preparation_runs')) {
          runStatus = 'failed';
          return [{ progress_percent: options.failProgress ?? 0, progress_stage: 'failed', progress_message: 'core failure', progress_updated_at: timestamp, heartbeat_at: timestamp }];
        }
        if (sql.includes('UPDATE') && sql.includes('site_proposals') && options.failProposalUpdate) throw new Error('proposal update failed');
        return [];
      }),
    };
    const dataSource = { query, createQueryRunner: jest.fn(() => runner) };
    return { service: new TenantSiteProposalsPreparationProgressService(dataSource as any), query, runner, runStatus: () => runStatus };
  };

  it('persists a run update and denormalizes the exact value onto only its proposal', async () => {
    const { service, query } = make();
    await expect(service.update('doflow', runId, proposalId, { percent: 48, stage: 'ai', message: 'Personalizzazione AI', provider: 'gemini' })).resolves.toMatchObject({ progress_percent: 48, progress_stage: 'ai' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('latest_preparation_job_id=$7');
    expect(query.mock.calls[1][1]).toEqual([48, 'ai', 'Personalizzazione AI', '2026-08-06T08:00:00.000Z', '2026-08-06T08:00:00.000Z', proposalId, runId]);
  });

  it('enforces monotonic progress in SQL and clamps external values to 0–100', async () => {
    const { service, query } = make();
    await service.update('doflow', runId, proposalId, { percent: 140, stage: 'ready', message: 'Pronta' });
    expect(query.mock.calls[0][0]).toContain('GREATEST(COALESCE(progress_percent,0::smallint),$1::smallint)');
    expect(query.mock.calls[0][1][0]).toBe(100);
  });

  it('starts normal monotonic progress from the new value when the legacy value is NULL', async () => {
    const { service, query } = make({ updateProgress: 25 });
    await expect(service.update('doflow', runId, proposalId, { percent: 25, stage: 'loading-data', message: 'Caricamento' })).resolves.toMatchObject({ progress_percent: 25 });
    expect(query.mock.calls[0][0]).toContain('COALESCE(progress_percent,0::smallint)');
    expect(query.mock.calls[1][0]).toContain('COALESCE($1::smallint,0::smallint)');
  });

  it('returns 0 for a failed legacy NULL percentage and never writes NULL to the proposal', async () => {
    const { service, query } = make();
    await service.update('doflow', runId, proposalId, { percent: 0, stage: 'failed', message: 'Errore controllato', failed: true });
    expect(query.mock.calls[0][0]).toContain('WHEN $4::boolean THEN COALESCE(progress_percent,0::smallint)');
    expect(query.mock.calls[0][0]).toContain('RETURNING COALESCE(progress_percent,0::smallint) AS progress_percent');
    expect(query.mock.calls[0][1]).toEqual([0, 'failed', 'Errore controllato', true, null, runId, proposalId]);
    expect(query.mock.calls[1][0]).toContain('progress_percent=COALESCE($1::smallint,0::smallint)');
  });

  it('atomically fails the run and its current proposal with one non-null percentage', async () => {
    const { service, runner } = make({ failProgress: 0 });
    await expect(service.failRun('doflow', runId, proposalId, 'core failure')).resolves.toMatchObject({ progress_percent: 0, progress_stage: 'failed' });
    const sql = runner.query.mock.calls.map(([value]: [string]) => value).join('\n');
    expect(sql).toContain("SET status='failed'");
    expect(sql).toContain('progress_percent=COALESCE(progress_percent,0::smallint)');
    expect(sql).toContain("preparation_status='failed'");
    expect(sql).toContain('latest_preparation_job_id=$1::text');
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back the run when the proposal failure update errors', async () => {
    const { service, runner, runStatus } = make({ failProposalUpdate: true });
    await expect(service.failRun('doflow', runId, proposalId, 'core failure')).rejects.toThrow('proposal update failed');
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runStatus()).toBe('running');
  });

  it('rejects cross-tenant and malformed run identities', async () => {
    const { service, query } = make();
    await expect(service.update('public', runId, proposalId, { percent: 5, stage: 'queueing', message: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('doflow', 'bad', proposalId, { percent: 5, stage: 'queueing', message: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
