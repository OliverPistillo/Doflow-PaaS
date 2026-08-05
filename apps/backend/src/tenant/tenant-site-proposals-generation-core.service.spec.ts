import { ConflictException } from '@nestjs/common';
import { TenantSiteProposalsGenerationCoreService } from './tenant-site-proposals-generation-core.service';

const proposalId = '550e8400-e29b-41d4-a716-446655440000';

describe('proposal generation core atomicity', () => {
  const make = (running = false) => {
    const runner: any = { isTransactionActive: false, connect: jest.fn(), startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }), commitTransaction: jest.fn(async () => { runner.isTransactionActive = false; }), rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }), release: jest.fn().mockResolvedValue(undefined), query: jest.fn(async (sql: string) => {
      if (sql.includes('site_proposals WHERE')) return [{ id: proposalId, current_version: 2, template_slug: 'colsova', template_version: '2.4.1', site_config: {} }];
      if (sql.includes("status='running' LIMIT")) return running ? [{ id: 'existing' }] : [];
      if (sql.includes('INSERT INTO') && sql.includes('site_proposal_generations')) return [{ id: '650e8400-e29b-41d4-a716-446655440000', status: 'running' }];
      return [];
    }) };
    const ds: any = { createQueryRunner: jest.fn(() => runner), query: jest.fn(async (sql: string) => { if (sql.includes("SET status='completed'")) return [{ id: 'generation', status: 'completed' }]; return []; }) };
    const templates = { renderHtml: jest.fn().mockResolvedValue({ html: '<html></html>', sha256: 'html', size: 13 }), buildRedirectFiles: jest.fn().mockResolvedValue([]) };
    const artifacts = { createZip: jest.fn().mockResolvedValue({ buffer: Buffer.from('zip'), sha256: 'zip', size: 3 }) };
    const storage = { uploadGeneratedBuffer: jest.fn() };
    return { core: new TenantSiteProposalsGenerationCoreService(ds, templates as any, artifacts as any, storage as any), runner, ds, storage };
  };

  it('serializes check-and-insert with an advisory transaction lock and row lock', async () => { const { core, runner } = make(); await expect(core.generate('doflow', {}, proposalId)).resolves.toMatchObject({ status: 'completed' }); const sql = runner.query.mock.calls.map(([value]: [string]) => value).join('\n'); expect(sql).toContain('pg_advisory_xact_lock'); expect(sql).toContain('FOR UPDATE'); expect(runner.commitTransaction).toHaveBeenCalled(); });
  it('rejects the second concurrent generation before uploads', async () => { const { core, storage } = make(true); await expect(core.generate('doflow', {}, proposalId)).rejects.toBeInstanceOf(ConflictException); expect(storage.uploadGeneratedBuffer).not.toHaveBeenCalled(); });
  it('maps the unique partial-index race to a conflict', async () => { const { core, runner } = make(); runner.query.mockImplementation(async (sql: string) => { if (sql.includes('site_proposals WHERE')) return [{ id: proposalId, current_version: 2, template_slug: 'colsova', template_version: '2.4.1' }]; if (sql.includes("status='running' LIMIT")) return []; if (sql.includes('INSERT INTO')) { const error: any = new Error('unique'); error.code = '23505'; throw error; } return []; }); await expect(core.generate('doflow', {}, proposalId)).rejects.toBeInstanceOf(ConflictException); });
});
