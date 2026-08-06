import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';

jest.mock('./tenant-site-proposals-schema', () => ({ ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined) }));

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const runId = '650e8400-e29b-41d4-a716-446655440000';
const actorId = '750e8400-e29b-41d4-a716-446655440000';
const data = { preparationRunId: runId, tenantSchema: 'doflow', proposalId, actorUserId: null, actorEmail: null, force: false, generate: true, reason: 'recovery' };

function bullJob(state: string, attemptsMade = 0, attempts = 3) {
  return { id: runId, data, attemptsMade, opts: { attempts }, getState: jest.fn().mockResolvedValue(state), retry: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
}

describe('site proposal preparation queue', () => {
  const make = (options: {
    proposal?: any;
    active?: any;
    recoveryRun?: any;
    job?: any;
    paused?: boolean;
    progress?: any;
  } = {}) => {
    const proposal = Object.prototype.hasOwnProperty.call(options, 'proposal') ? options.proposal : { id: proposalId, preparation_status: 'idle', status: 'draft' };
    let paused = options.paused === true;
    const queue = {
      add: jest.fn().mockResolvedValue({ id: runId }),
      getJob: jest.fn().mockResolvedValue(options.job || null),
      waitUntilReady: jest.fn().mockResolvedValue({}),
      isPaused: jest.fn(async () => paused),
      resume: jest.fn(async () => { paused = false; }),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 0, delayed: 0, failed: 0 }),
    };
    const active = options.active;
    const recoveryRun = options.recoveryRun || (active ? {
      id: active.id || active.job_id, proposal_id: proposalId, job_id: active.job_id, status: active.status,
      attempts: 1, heartbeat_at: active.heartbeat_at || new Date().toISOString(), job_data: active.job_data || { ...data, preparationRunId: active.id || active.job_id },
    } : undefined);
    const runner = {
      isTransactionActive: false,
      connect: jest.fn(), startTransaction: jest.fn(async function (this: any) { this.isTransactionActive = true; }),
      commitTransaction: jest.fn(async function (this: any) { this.isTransactionActive = false; }), rollbackTransaction: jest.fn(async function (this: any) { this.isTransactionActive = false; }), release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('site_proposals WHERE id=$1::uuid FOR UPDATE')) return proposal ? [proposal] : [];
        if (sql.includes('site_proposal_preparation_runs WHERE proposal_id')) return active ? [active] : [];
        if (sql.includes('site_proposal_preparation_runs WHERE id=$1::uuid') && sql.includes('FOR UPDATE SKIP LOCKED')) return recoveryRun ? [recoveryRun] : [];
        if (sql.includes('SELECT preparation_status,current_version')) return [{ preparation_status: 'queued', current_version: 1 }];
        if (sql.includes('site_proposal_generations')) return [];
        return [];
      }),
    };
    const dataSource = { query: jest.fn().mockResolvedValue([]), createQueryRunner: jest.fn(() => runner) };
    const progress = options.progress;
    return { service: new TenantSiteProposalsPreparationQueueService(queue as any, dataSource as any, progress), queue, dataSource, runner, progress };
  };

  it('rejects foreign schemas and malformed proposal IDs', async () => { const { service } = make(); await expect(service.enqueue('public', proposalId, {}, {})).rejects.toBeInstanceOf(BadRequestException); await expect(service.enqueue('doflow', 'bad', {}, {})).rejects.toBeInstanceOf(BadRequestException); });
  it('rejects unknown options and unsafe theme identity', () => { const { service } = make(); expect(() => (service as any).options({ extra: true })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateSlug: '../x' })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateVersion: 'latest' })).toThrow(BadRequestException); });
  it('applies safe defaults and whitelists fields', () => { const { service } = make(); expect((service as any).options({})).toEqual({ force: false, generate: true, reason: 'automatic_preparation', targetTemplateSlug: undefined, targetTemplateVersion: undefined }); });
  it('rejects missing and archived proposals', async () => { await expect(make({ proposal: null }).service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); await expect(make({ proposal: { id: proposalId, status: 'archived' } }).service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); });

  it('resumes a globally paused queue during bootstrap and reports real counts', async () => {
    const { service, queue } = make({ paused: true });
    await expect(service.bootstrapQueue()).resolves.toMatchObject({ pausedBefore: true, pausedAfter: false });
    expect(queue.waitUntilReady).toHaveBeenCalled();
    expect(queue.resume).toHaveBeenCalledTimes(1);
    expect(queue.getJobCounts).toHaveBeenCalledWith('waiting', 'active', 'delayed', 'failed');
  });

  it('persists a UUID run before dispatch, configures three attempts and writes real 5% progress', async () => {
    const progress = { update: jest.fn().mockResolvedValue({}) };
    const { service, queue, runner } = make({ progress });
    const result = await service.enqueue('doflow', proposalId, { id: actorId, email: ' user@example.it ' }, { reason: 'manual', targetTemplateSlug: 'colsova', targetTemplateVersion: '2.4.1' });
    expect(result).toMatchObject({ queued: true, idempotent: false, status: 'queued', pendingDispatch: false });
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(runner.commitTransaction.mock.invocationCallOrder[0]).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
    expect(queue.add).toHaveBeenCalledWith('prepare-proposal', expect.objectContaining({ preparationRunId: result.jobId, tenantSchema: 'doflow', proposalId, actorUserId: actorId, actorEmail: 'user@example.it' }), expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }));
    expect(progress.update).toHaveBeenCalledWith('doflow', result.jobId, proposalId, { percent: 5, stage: 'queueing', message: 'Accodamento completato' });
  });

  it.each([[false, { id: actorId, email: null }], [true, { id: null, email: null }]])('uses unambiguous PostgreSQL types for nullable actor fields (force=%s)', async (force, actor) => {
    const { service, runner } = make();
    await service.enqueue('doflow', proposalId, actor as any, { force, reason: 'regression_prepare' });
    const insert = (runner.query.mock.calls as any[][]).find(([sql]) => String(sql).includes('INSERT INTO "doflow".site_proposal_preparation_runs'));
    expect(insert).toBeDefined();
    expect(String(insert![0])).toContain("$1::uuid,$2::uuid,$3::text,'pending'::text,$4::boolean,$5::text,$6::uuid,$7::text,$8::jsonb");
    expect(insert![1]).toHaveLength(8);
    expect(() => JSON.parse(String(insert![1][7]))).not.toThrow();
  });

  it('does not swallow initial progress errors and reconciles exactly once', async () => {
    const progress = { update: jest.fn().mockRejectedValueOnce(new Error('progress unavailable')).mockResolvedValueOnce({}) };
    const { service } = make({ progress });
    await expect(service.enqueue('doflow', proposalId, {}, {})).resolves.toMatchObject({ pendingDispatch: false });
    expect(progress.update).toHaveBeenCalledTimes(2);
  });

  it('persists at least 10% as soon as the worker marks the job active', async () => {
    const progress = { update: jest.fn().mockResolvedValue({}) };
    const { service } = make({ progress });
    await service.markRunning(data);
    expect(progress.update).toHaveBeenCalledWith('doflow', runId, proposalId, { percent: 10, stage: 'loading-data', message: 'Caricamento dati attività' });
  });

  it('keeps a recoverable pending run when BullMQ is unavailable', async () => {
    const { service, queue, dataSource } = make();
    queue.waitUntilReady.mockRejectedValue(new Error('queue unavailable'));
    await expect(service.enqueue('doflow', proposalId, {}, {})).resolves.toMatchObject({ queued: true, pendingDispatch: true });
    expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes("status='pending'"))).toBe(true);
  });

  it.each(['pending', 'dispatched'])('recreates a missing %s job with the same run id', async (status) => {
    const recoveryRun = { id: runId, proposal_id: proposalId, job_id: runId, status, attempts: 1, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data };
    const { service, queue } = make({ recoveryRun });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: true, queueState: 'waiting' });
    expect(queue.add).toHaveBeenCalledWith('prepare-proposal', data, expect.objectContaining({ jobId: runId }));
  });

  it('keeps one waiting job and resumes its paused queue without adding a duplicate', async () => {
    const job = bullJob('waiting');
    const { service, queue } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'dispatched', attempts: 1, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data }, job, paused: true });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: true, queueState: 'waiting' });
    expect(queue.resume).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not redispatch an active job', async () => {
    const { service, queue } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'dispatched', attempts: 1, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data }, job: bullJob('active') });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: false, queueState: 'active' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('retries a failed BullMQ job when attempts remain', async () => {
    const job = bullJob('failed', 1, 3);
    const { service, queue } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'dispatched', attempts: 1, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data }, job });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: true, queueState: 'waiting' });
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('marks a failed job terminal when BullMQ attempts are exhausted', async () => {
    const job = bullJob('failed', 3, 3);
    const progress = { update: jest.fn().mockResolvedValue({}) };
    const { service, runner } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'dispatched', attempts: 3, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data }, job, progress });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: true, queueState: 'failed' });
    expect(runner.query.mock.calls.some(([sql]) => String(sql).includes("SET status='failed'"))).toBe(true);
    expect(progress.update).toHaveBeenCalledWith('doflow', runId, proposalId, expect.objectContaining({ stage: 'failed', failed: true }));
  });

  it('leaves a recent running heartbeat untouched', async () => {
    const { service, queue, runner } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'running', attempts: 1, heartbeat_at: new Date().toISOString(), job_data: data }, job: bullJob('active') });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: false, queueState: 'active' });
    expect(queue.add).not.toHaveBeenCalled();
    expect(runner.query.mock.calls.some(([sql]) => String(sql).includes("SET status='pending'"))).toBe(false);
  });

  it('recovers a stale running run whose BullMQ job is missing', async () => {
    const { service, queue } = make({ recoveryRun: { id: runId, proposal_id: proposalId, job_id: runId, status: 'running', attempts: 1, heartbeat_at: '2026-01-01T00:00:00Z', job_data: data } });
    await expect(service.reconcileRun(runId)).resolves.toMatchObject({ recovered: true, queueState: 'waiting' });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('reconciles an active dispatched run from enqueue instead of returning blindly', async () => {
    const active = { id: runId, job_id: runId, status: 'dispatched', heartbeat_at: '2026-01-01T00:00:00Z', job_data: data };
    const { service, queue } = make({ proposal: { id: proposalId, preparation_status: 'queued', status: 'draft' }, active });
    await expect(service.enqueue('doflow', proposalId, {}, { force: true })).resolves.toMatchObject({ idempotent: true, recovered: true, jobId: runId });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('exposes a stalled missing job without exposing infrastructure errors', async () => {
    const { service } = make();
    (service as any).workerReady = true;
    await expect(service.getDiagnostics(runId, 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).resolves.toEqual(expect.objectContaining({ queueState: 'missing', workerReady: true, stalled: true, canRetryDispatch: true, stalledReason: 'Il job di accodamento non è presente.' }));
  });

  it('recovers an existing four-run batch generically without creating preparation runs', async () => {
    const ids = ['650e8400-e29b-41d4-a716-446655440001','650e8400-e29b-41d4-a716-446655440002','650e8400-e29b-41d4-a716-446655440003','650e8400-e29b-41d4-a716-446655440004'];
    const { service, dataSource, runner } = make();
    dataSource.query.mockImplementation(async (sql: string) => String(sql).includes('SELECT id FROM "doflow".site_proposal_preparation_runs') ? ids.map((id) => ({ id })) : []);
    const reconcile = jest.spyOn(service, 'reconcileRun').mockResolvedValue({ recovered: true, queueState: 'waiting' });
    await expect(service.recoverPreparationRuns()).resolves.toBe(4);
    expect(reconcile.mock.calls.map(([id]) => id)).toEqual(ids);
    expect(runner.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
  });

  it('keeps four proposal progress updates independent with unique run ids', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, async (_, index) => {
      const progress = { update: jest.fn().mockResolvedValue({}) };
      const id = `550e8400-e29b-41d4-a716-44665544000${index}`;
      const { service } = make({ proposal: { id, preparation_status: 'idle', status: 'draft' }, progress });
      const result = await service.enqueue('doflow', id, {}, { reason: 'csv_import' });
      return { result, progress };
    }));
    const ids = results.map(({ result }) => result.jobId);
    expect(new Set(ids).size).toBe(4);
    results.forEach(({ result, progress }, index) => expect(progress.update).toHaveBeenCalledWith('doflow', result.jobId, `550e8400-e29b-41d4-a716-44665544000${index}`, expect.objectContaining({ percent: 5 })));
  });
});
