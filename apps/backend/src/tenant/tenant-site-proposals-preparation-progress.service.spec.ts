import { BadRequestException } from '@nestjs/common';
import { TenantSiteProposalsPreparationProgressService } from './tenant-site-proposals-preparation-progress.service';

const runId = '650e8400-e29b-41d4-a716-446655440000';
const proposalId = '550e8400-e29b-41d4-a716-446655440000';

describe('site proposal persisted preparation progress', () => {
  const make = () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => sql.includes('site_proposal_preparation_runs') ? [{ progress_percent: params[0], progress_stage: params[1], progress_message: params[2], progress_updated_at: '2026-08-06T08:00:00.000Z', heartbeat_at: '2026-08-06T08:00:00.000Z', provider: params[4] }] : []);
    return { service: new TenantSiteProposalsPreparationProgressService({ query } as any), query };
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
    expect(query.mock.calls[0][0]).toContain('GREATEST(progress_percent,$1)');
    expect(query.mock.calls[0][1][0]).toBe(100);
  });

  it('keeps the last real percentage on failure while updating heartbeat and sanitized stage', async () => {
    const { service, query } = make();
    await service.update('doflow', runId, proposalId, { percent: 0, stage: 'failed', message: 'Errore controllato', failed: true });
    expect(query.mock.calls[0][0]).toContain('CASE WHEN $4 THEN progress_percent');
    expect(query.mock.calls[0][1]).toEqual([0, 'failed', 'Errore controllato', true, null, runId, proposalId]);
  });

  it('rejects cross-tenant and malformed run identities', async () => {
    const { service, query } = make();
    await expect(service.update('public', runId, proposalId, { percent: 5, stage: 'queueing', message: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('doflow', 'bad', proposalId, { percent: 5, stage: 'queueing', message: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
