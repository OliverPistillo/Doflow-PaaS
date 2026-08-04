import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';

jest.mock('./tenant-site-proposals-schema', () => ({ ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined) }));

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const actorId = '650e8400-e29b-41d4-a716-446655440000';

describe('site proposal preparation queue', () => {
  const make = () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    const dataSource = { query: jest.fn() };
    return { service: new TenantSiteProposalsPreparationQueueService(queue as any, dataSource as any), queue, dataSource };
  };

  it('rejects foreign schemas and malformed proposal IDs', async () => { const { service } = make(); await expect(service.enqueue('public', proposalId, {}, {})).rejects.toBeInstanceOf(BadRequestException); await expect(service.enqueue('doflow', 'bad', {}, {})).rejects.toBeInstanceOf(BadRequestException); });
  it('rejects unknown options and unsafe theme identity', () => { const { service } = make(); expect(() => (service as any).options({ extra: true })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateSlug: '../x' })).toThrow(BadRequestException); expect(() => (service as any).options({ targetTemplateVersion: 'latest' })).toThrow(BadRequestException); });
  it('applies safe defaults and whitelists fields', () => { const { service } = make(); expect((service as any).options({})).toEqual({ force: false, generate: true, reason: 'automatic_preparation', targetTemplateSlug: undefined, targetTemplateVersion: undefined }); });
  it('is idempotent for an already queued proposal', async () => { const { service, queue, dataSource } = make(); dataSource.query.mockResolvedValueOnce([{ id: proposalId, preparation_status: 'queued', status: 'draft' }]); await expect(service.enqueue('doflow', proposalId, {}, {})).resolves.toMatchObject({ idempotent: true, status: 'queued' }); expect(queue.add).not.toHaveBeenCalled(); });
  it('is idempotent for a running proposal even with force', async () => { const { service, queue, dataSource } = make(); dataSource.query.mockResolvedValueOnce([{ id: proposalId, preparation_status: 'running', status: 'draft' }]); await expect(service.enqueue('doflow', proposalId, {}, { force: true })).resolves.toMatchObject({ idempotent: true, status: 'running' }); expect(queue.add).not.toHaveBeenCalled(); });
  it('rejects missing and archived proposals', async () => { const missing = make(); missing.dataSource.query.mockResolvedValueOnce([]); await expect(missing.service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); const archived = make(); archived.dataSource.query.mockResolvedValueOnce([{ id: proposalId, status: 'archived' }]); await expect(archived.service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(NotFoundException); });
  it('queues sanitized server-side job data and records activity', async () => { const { service, queue, dataSource } = make(); dataSource.query.mockResolvedValueOnce([{ id: proposalId, preparation_status: 'idle', status: 'draft' }]).mockResolvedValue([]); const result = await service.enqueue('doflow', proposalId, { id: actorId, email: ' user@example.it ' }, { reason: 'manual', targetTemplateSlug: 'colsova', targetTemplateVersion: '2.4.1' }); expect(result).toMatchObject({ queued: true, idempotent: false, status: 'queued' }); expect(queue.add).toHaveBeenCalledWith('prepare-proposal', expect.objectContaining({ tenantSchema: 'doflow', proposalId, actorUserId: actorId, actorEmail: 'user@example.it', force: false, generate: true }), expect.objectContaining({ attempts: 1 })); expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes("preparation_status='queued'"))).toBe(true); });
  it('marks failed when BullMQ rejects the enqueue', async () => { const { service, queue, dataSource } = make(); dataSource.query.mockResolvedValueOnce([{ id: proposalId, preparation_status: 'idle', status: 'draft' }]).mockResolvedValue([]); queue.add.mockRejectedValue(new Error('redis unavailable')); await expect(service.enqueue('doflow', proposalId, {}, {})).rejects.toBeInstanceOf(ConflictException); expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes("preparation_status='failed'"))).toBe(true); });
});
