import { preparationWorkerConfiguration, TenantSiteProposalsPreparationWorker } from './tenant-site-proposals-preparation.worker';
import { SITE_PROPOSAL_PREPARATION_JOB } from './tenant-site-proposals.constants';

describe('site proposal preparation worker', () => {
  const previous = { ...process.env };
  afterEach(() => { process.env = { ...previous }; });
  it('uses concurrency 2 and limiter 4/60000 by default', () => { delete process.env.SITE_PROPOSALS_PREPARATION_CONCURRENCY; delete process.env.SITE_PROPOSALS_PREPARATION_RATE_MAX; delete process.env.SITE_PROPOSALS_PREPARATION_RATE_DURATION_MS; expect(preparationWorkerConfiguration()).toEqual({ concurrency: 2, limiter: { max: 4, duration: 60000 } }); });
  it('accepts bounded configuration', () => { process.env.SITE_PROPOSALS_PREPARATION_CONCURRENCY = '4'; process.env.SITE_PROPOSALS_PREPARATION_RATE_MAX = '12'; process.env.SITE_PROPOSALS_PREPARATION_RATE_DURATION_MS = '30000'; expect(preparationWorkerConfiguration()).toEqual({ concurrency: 4, limiter: { max: 12, duration: 30000 } }); });
  it('falls back for out of range configuration', () => { process.env.SITE_PROPOSALS_PREPARATION_CONCURRENCY = '5'; process.env.SITE_PROPOSALS_PREPARATION_RATE_MAX = '0'; process.env.SITE_PROPOSALS_PREPARATION_RATE_DURATION_MS = '999'; expect(preparationWorkerConfiguration()).toEqual({ concurrency: 2, limiter: { max: 4, duration: 60000 } }); });
  it('delegates server-side job data directly to the request-independent core', async () => { const core = { prepare: jest.fn().mockResolvedValue({ status: 'ready' }) }; const worker = new TenantSiteProposalsPreparationWorker(core as any); const data = { tenantSchema: 'doflow', proposalId: '550e8400-e29b-41d4-a716-446655440000' }; await expect(worker.process({ name: SITE_PROPOSAL_PREPARATION_JOB, data } as any)).resolves.toEqual({ status: 'ready' }); expect(core.prepare).toHaveBeenCalledWith(data); });
  it('rejects unrelated jobs', () => { const worker = new TenantSiteProposalsPreparationWorker({ prepare: jest.fn() } as any); expect(() => worker.process({ name: 'other', data: {} } as any)).toThrow(/Unsupported/); });
});
