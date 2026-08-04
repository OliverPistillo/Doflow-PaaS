import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsPreparationCoreService } from './tenant-site-proposals-preparation-core.service';

jest.mock('./tenant-site-proposals-schema', () => ({ ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined) }));

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const validJob = { tenantSchema: 'doflow', proposalId, actorUserId: null, actorEmail: null, force: false, generate: true, reason: 'test', targetTemplateSlug: 'colsova', targetTemplateVersion: '2.4.1' };

describe('site proposal preparation core security and lock', () => {
  const make = () => {
    const runner = { connect: jest.fn().mockResolvedValue(undefined), query: jest.fn(), startTransaction: jest.fn().mockResolvedValue(undefined), commitTransaction: jest.fn().mockResolvedValue(undefined), rollbackTransaction: jest.fn().mockResolvedValue(undefined), release: jest.fn().mockResolvedValue(undefined), isTransactionActive: false };
    const dataSource = { createQueryRunner: jest.fn(() => runner), query: jest.fn().mockResolvedValue([]) };
    const empty = {} as any;
    return { core: new TenantSiteProposalsPreparationCoreService(dataSource as any, empty, empty, empty, empty, empty, empty, empty), dataSource, runner };
  };

  it('accepts only the doflow schema, UUID and whitelisted options', () => { const { core } = make(); expect(() => (core as any).job(validJob)).not.toThrow(); expect(() => (core as any).job({ ...validJob, tenantSchema: 'public' })).toThrow(BadRequestException); expect(() => (core as any).job({ ...validJob, proposalId: 'bad' })).toThrow(BadRequestException); expect(() => (core as any).job({ ...validJob, token: 'secret' })).toThrow(BadRequestException); });
  it('sanitizes actor identity without accepting credentials', () => { const { core } = make(); const value = (core as any).job({ ...validJob, actorUserId: 'not-a-uuid', actorEmail: ' user@example.it ' }); expect(value.actorUserId).toBeNull(); expect(value.actorEmail).toBe('user@example.it'); expect(value).not.toHaveProperty('token'); expect(value).not.toHaveProperty('cookie'); });
  it('rejects invalid target template options', () => { const { core } = make(); expect(() => (core as any).job({ ...validJob, targetTemplateSlug: '../colsova' })).toThrow(BadRequestException); expect(() => (core as any).job({ ...validJob, targetTemplateVersion: 'latest' })).toThrow(BadRequestException); });
  it('always releases an acquired advisory lock when the proposal is absent', async () => { const { core, runner } = make(); runner.query.mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]); await expect(core.prepare(validJob)).rejects.toBeInstanceOf(NotFoundException); expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_unlock'), ['doflow', proposalId]); expect(runner.release).toHaveBeenCalledTimes(1); });
  it('returns duplicate and still unlocks when advisory lock is unavailable', async () => { const { core, runner } = make(); runner.query.mockResolvedValueOnce([{ locked: false }]); await expect(core.prepare(validJob)).resolves.toMatchObject({ status: 'duplicate', proposalId }); expect(runner.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_unlock'))).toBe(false); expect(runner.release).toHaveBeenCalledTimes(1); });
});
