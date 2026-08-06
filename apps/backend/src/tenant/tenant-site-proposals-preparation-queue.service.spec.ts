import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';

jest.mock('./tenant-site-proposals-schema', () => ({ ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined) }));

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const actorId = '650e8400-e29b-41d4-a716-446655440000';

describe('site proposal preparation queue', () => {
  const make = (proposal: any = { id: proposalId, preparation_status: 'idle', status: 'draft' }, active?: any) => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }), getJob: jest.fn().mockResolvedValue(null) };
    const runner = {
      isTransactionActive: false,
      connect: jest.fn(), startTransaction: jest.fn(async function (this: any) { this.isTransactionActive = true; }),
      commitTransaction: jest.fn(async function (this: any) { this.isTransactionActive = false; }), rollbackTransaction: jest.fn(async function (this: any) { this.isTransactionActive = false; }), release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('site_proposals WHERE id=$1 FOR UPDATE')) return proposal ? [proposal] : [];
        if (sql.includes('site_proposal_preparation_runs WHERE proposal_id')) return active ? [active] : [];
        return [];
      }),
    };
    const dataSource = { query: jest.fn().mockResolvedValue([]), createQueryRunner: jest.fn(() => runner) };
    return { service: new TenantSiteProposalsPreparationQueueService(queue as any, dataSource as any), queue, dataSource, runner };
  };

  it('rejects foreign schemas and malformed proposal IDs', async () => { const { service } = make(); await expect(service.enqueue('public', proposalId, {}, {})).rejects.toBeInstanceOf(BadRequestException); await expect(service.enqueue('doflow', 'bad', {}, {})).rejects.toBeInstanceOf(BadRequestException); });
  it('rejects unknown options and unsafe theme identity', () => { const { service } = make(); expect(() => (service as any).options({ extra: true })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateSlug: '../x' })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateVersion: 'latest' })).toThrow(BadRequestException); });
  it('applies safe defaults and whitelists fields', () => { const { service } = make(); expect((service as any).options({})).toEqual({ force: false, generate: true, reason: 'automatic_preparation', targetTemplateSlug: undefined, targetTemplateVersion: undefined }); });
  it('is idempotent for a persisted active run, including force', async () => { const active = { job_id: actorId, status: 'running' }; const { service, queue } = make({ id: proposalId, preparation_status: 'running', status: 'draft' }, active); await expect(service.enqueue('doflow', proposalId, {}, { force: true })).resolves.toMatchObject({ idempotent: true, status: 'running', jobId: actorId }); expect(queue.add).not.toHaveBeenCalled(); });
  it('rejects missing and archived proposals', async () => { await expect(make(null).service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); await expect(make({ id: proposalId, status: 'archived' }).service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); });
  it('persists a UUID run before dispatch and configures three exponential attempts', async () => {
    const { service, queue, runner } = make();
    const result = await service.enqueue('doflow', proposalId, { id: actorId, email: ' user@example.it ' }, { reason: 'manual', targetTemplateSlug: 'colsova', targetTemplateVersion: '2.4.1' });
    expect(result).toMatchObject({ queued: true, idempotent: false, status: 'queued', pendingDispatch: false });
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(runner.commitTransaction.mock.invocationCallOrder[0]).toBeLessThan(queue.add.mock.invocationCallOrder[0]);
    expect(queue.add).toHaveBeenCalledWith('prepare-proposal', expect.objectContaining({ preparationRunId: result.jobId, tenantSchema: 'doflow', proposalId, actorUserId: actorId, actorEmail: 'user@example.it' }), expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }));
  });
  it.each([
    [false, { id: actorId, email: null }],
    [true, { id: null, email: null }],
  ])('uses unambiguous PostgreSQL types for UUID, text, boolean, JSONB and nullable actor fields (force=%s)', async (force, actor) => {
    const { service, runner } = make();
    await service.enqueue('doflow', proposalId, actor as any, { force, reason: 'regression_prepare', targetTemplateSlug: undefined, targetTemplateVersion: undefined });
    const insert = (runner.query.mock.calls as any[][]).find(([sql]) => String(sql).includes('INSERT INTO "doflow".site_proposal_preparation_runs'));
    expect(insert).toBeDefined();
    const sql = String(insert![0]);
    const params = insert![1] as unknown[];
    expect(sql).toContain("$1::uuid,$2::uuid,$3::text,'pending'::text,$4::boolean,$5::text,$6::uuid,$7::text,$8::jsonb");
    expect(sql).not.toContain('VALUES ($1,$2,$1');
    expect(params).toHaveLength(8);
    expect(params[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(params[1]).toBe(proposalId);
    expect(params[2]).toBe(params[0]);
    expect(params[3]).toBe(force);
    expect(params[4]).toBe('regression_prepare');
    expect(params[5]).toBe(force ? null : actorId);
    expect(params[6]).toBeNull();
    expect(() => JSON.parse(String(params[7]))).not.toThrow();
  });
  it('keeps a recoverable pending run when BullMQ is unavailable', async () => { const { service, queue, dataSource } = make(); queue.add.mockRejectedValue(new Error('redis unavailable')); await expect(service.enqueue('doflow', proposalId, {}, {})).resolves.toMatchObject({ queued: true, pendingDispatch: true }); expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes("status='pending'"))).toBe(true); });
  it('creates distinct UUID runs for terminal retries in the same instant', async () => { const first = make(); const second = make(); const a = await first.service.enqueue('doflow', proposalId, {}, { force: true }); const b = await second.service.enqueue('doflow', proposalId, {}, { force: true }); expect(a.jobId).not.toBe(b.jobId); });
  it('recovers a committed pending dispatch idempotently', async () => {
    const { service, queue, dataSource } = make();
    const data = { preparationRunId: actorId, tenantSchema: 'doflow', proposalId, actorUserId: null, actorEmail: null, force: false, generate: true, reason: 'recovery' };
    dataSource.query.mockResolvedValueOnce([{ job_data: data }]).mockResolvedValue([]);
    await expect(service.recoverPendingDispatches()).resolves.toBe(1);
    expect(queue.add).toHaveBeenCalledWith('prepare-proposal', data, expect.objectContaining({ jobId: actorId }));
  });
});
