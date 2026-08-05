import { FileStorageService, ThemePackageUploadError } from '../file-storage.service';
import { TenantSiteProposalsThemeService } from './tenant-site-proposals-theme.service';
import { TenantSiteProposalsThemeStorageCleanupService } from './tenant-site-proposals-theme-storage-cleanup.service';

jest.mock('./tenant-site-proposals-schema', () => ({ ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined) }));

const cleanupId = '550e8400-e29b-41d4-a716-446655440000';

describe('proposal theme storage hardening', () => {
  it('stores every modular source entry and the compiled preview under a server-side prefix', async () => {
    const storage = new FileStorageService() as any;
    storage.s3 = { send: jest.fn().mockResolvedValue({}) };
    const result = await storage.uploadThemePackage('custom','1.2.0',{
      zip:Buffer.from('zip'),template:Buffer.from('html'),manifest:Buffer.from('{}'),compiled:Buffer.from('compiled'),
      packageFiles:{'theme.json':Buffer.from('{}'),'template.html':Buffer.from('html'),'styles/theme.css':Buffer.from('css'),'scripts/theme.js':Buffer.from('js'),'assets/images/a.webp':Buffer.from('asset')},
    });
    const keys=storage.s3.send.mock.calls.map(([command]:any[])=>command.input.Key);
    expect(keys).toEqual([
      'doflow/site-proposal-themes/custom/1.2.0/source.zip',
      'doflow/site-proposal-themes/custom/1.2.0/assets/images/a.webp',
      'doflow/site-proposal-themes/custom/1.2.0/scripts/theme.js',
      'doflow/site-proposal-themes/custom/1.2.0/styles/theme.css',
      'doflow/site-proposal-themes/custom/1.2.0/template.html',
      'doflow/site-proposal-themes/custom/1.2.0/theme.json',
      'doflow/site-proposal-themes/custom/1.2.0/compiled.html',
    ]);
    expect(result).toMatchObject({prefix:'doflow/site-proposal-themes/custom/1.2.0/',compiledKey:'doflow/site-proposal-themes/custom/1.2.0/compiled.html'});
  });

  it('removes every successfully uploaded object after a later upload fails', async () => {
    const storage = new FileStorageService() as any;
    let puts = 0;
    storage.s3 = { send: jest.fn(async (command: any) => { if (command.constructor.name === 'PutObjectCommand' && ++puts === 2) throw new Error('second failed'); return {}; }) };
    await expect(storage.uploadThemePackage('custom', '1.0.0', { zip: Buffer.from('zip'), template: Buffer.from('html'), manifest: Buffer.from('{}') })).rejects.toMatchObject({ cleanupRequired: false });
    expect(storage.s3.send.mock.calls.filter(([command]: any[]) => command.constructor.name === 'DeleteObjectsCommand')).toHaveLength(1);
  });

  it('reports a persistent cleanup requirement without hiding the upload failure', async () => {
    const storage = new FileStorageService() as any;
    let puts = 0;
    storage.s3 = { send: jest.fn(async (command: any) => { if (command.constructor.name === 'PutObjectCommand' && ++puts === 2) throw new Error('primary upload failure'); if (command.constructor.name === 'DeleteObjectsCommand') throw new Error('cleanup failure'); return {}; }) };
    try { await storage.uploadThemePackage('custom', '1.0.0', { zip: Buffer.from('zip'), template: Buffer.from('html'), manifest: Buffer.from('{}') }); fail('expected failure'); }
    catch (error) { expect(error).toBeInstanceOf(ThemePackageUploadError); expect(error).toMatchObject({ cleanupRequired: true, storagePrefix: 'doflow/site-proposal-themes/custom/1.0.0/' }); expect((error as ThemePackageUploadError).originalError).toEqual(expect.objectContaining({ message: 'primary upload failure' })); }
  });

  it('keeps failed cleanup rows recoverable and sanitizes the stored error', async () => {
    const queries: Array<[string, unknown[] | undefined]> = [];
    const ds = { query: jest.fn(async (sql: string, parameters?: unknown[]) => { queries.push([sql, parameters]); if (sql.includes("status='running'")) return [{ storage_prefix: 'doflow/site-proposal-themes/custom/1.0.0/' }]; return []; }) };
    const storage = { deleteThemeStoragePrefix: jest.fn().mockRejectedValue(new Error('temporary S3 token detail')) };
    const service = new TenantSiteProposalsThemeStorageCleanupService(ds as any, storage as any);
    await expect(service.process(cleanupId)).resolves.toBe('failed');
    expect(queries.some(([sql]) => sql.includes("status='failed'"))).toBe(true);
    expect(JSON.stringify(queries)).not.toContain('temporary S3 token detail');
  });

  it('commits theme deletion before starting storage cleanup', async () => {
    const order: string[] = [];
    const runner: any = { isTransactionActive: false, connect: jest.fn(), startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }), commitTransaction: jest.fn(async () => { order.push('commit'); runner.isTransactionActive = false; }), rollbackTransaction: jest.fn(), release: jest.fn().mockResolvedValue(undefined), query: jest.fn(async (sql: string) => { if (sql.includes('SELECT v.*')) return [{ id: 'version', theme_id: 'theme', slug: 'custom', source_kind: 'uploaded', is_builtin: false, status: 'disabled', default_version: null }]; if (sql.includes('SELECT 1 FROM')) return []; order.push('db'); return []; }) };
    const ds: any = { createQueryRunner: () => runner, query: jest.fn() };
    const cleanup = { record: jest.fn(async () => { order.push('record'); return cleanupId; }), process: jest.fn(async () => { order.push('cleanup'); return 'completed'; }) };
    const storage = { proposalThemePrefix: jest.fn(() => 'doflow/site-proposal-themes/custom/1.0.0/'), deleteThemePrefix: jest.fn() };
    const request = { user: { id: cleanupId, role: 'admin', tenantId: 'doflow' } };
    const service = new TenantSiteProposalsThemeService(ds, {} as any, storage as any, { invalidate: jest.fn() } as any, cleanup as any, request);
    (service as any).ensure = jest.fn();
    await expect(service.delete('custom', '1.0.0')).resolves.toMatchObject({ deleted: true, cleanupPending: false });
    expect(order.indexOf('commit')).toBeLessThan(order.indexOf('cleanup'));
    expect(storage.deleteThemePrefix).not.toHaveBeenCalled();
  });

  it('does not touch storage when the database transaction fails', async () => {
    const runner: any = { isTransactionActive: false, connect: jest.fn(), startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }), release: jest.fn().mockResolvedValue(undefined), query: jest.fn().mockRejectedValue(new Error('database failed')) };
    const ds: any = { createQueryRunner: () => runner, query: jest.fn() }; const cleanup = { record: jest.fn(), process: jest.fn() }; const storage = { proposalThemePrefix: jest.fn(), deleteThemePrefix: jest.fn() };
    const service = new TenantSiteProposalsThemeService(ds, {} as any, storage as any, { invalidate: jest.fn() } as any, cleanup as any, { user: { id: cleanupId, role: 'admin', tenantId: 'doflow' } }); (service as any).ensure = jest.fn();
    await expect(service.delete('custom', '1.0.0')).rejects.toThrow('database failed'); expect(cleanup.record).not.toHaveBeenCalled(); expect(cleanup.process).not.toHaveBeenCalled(); expect(storage.deleteThemePrefix).not.toHaveBeenCalled();
  });

  it('sets exactly one global default without privileging Colsova', async () => {
    const statements: string[] = [];
    const runner: any = { isTransactionActive: false, connect: jest.fn(), startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }), commitTransaction: jest.fn(async () => { runner.isTransactionActive = false; }), rollbackTransaction: jest.fn().mockResolvedValue(undefined), release: jest.fn().mockResolvedValue(undefined), query: jest.fn(async (sql: string) => { statements.push(sql); if (sql.includes('SELECT v.*,t.id theme_id')) return [{ id: 'version', theme_id: 'theme', status: 'active', theme_active: true, schema_version: '2.0', contract_version: '2.0', content_profile: 'proposal-basic-v2', runtime_adapter_status: 'ready' }]; return []; }) };
    const ds: any = { createQueryRunner: () => runner, query: jest.fn() }; const templates = { invalidate: jest.fn() };
    const service = new TenantSiteProposalsThemeService(ds, {} as any, {} as any, templates as any, {} as any, { user: { id: cleanupId, role: 'admin', tenantId: 'doflow' } }); (service as any).ensure = jest.fn(); jest.spyOn(service, 'get').mockResolvedValue({ slug: 'custom', version: '1.0.0' } as any);
    await expect(service.setDefault('custom', '1.0.0')).resolves.toMatchObject({ slug: 'custom' });
    const clear = statements.findIndex((sql) => sql.includes('SET default_version=NULL')); const select = statements.findIndex((sql) => sql.includes('SET default_version=$1'));
    expect(clear).toBeGreaterThan(-1); expect(clear).toBeLessThan(select); expect(runner.commitTransaction).toHaveBeenCalled(); expect(templates.invalidate).toHaveBeenCalledWith('doflow');
  });

  it('rejects a pending runtime adapter before changing the global default', async () => {
    const statements: string[] = [];
    const runner: any = { isTransactionActive: false, connect: jest.fn(), startTransaction: jest.fn(async () => { runner.isTransactionActive = true; }), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(async () => { runner.isTransactionActive = false; }), release: jest.fn().mockResolvedValue(undefined), query: jest.fn(async (sql: string) => { statements.push(sql); if (sql.includes('SELECT v.*,t.id theme_id')) return [{ id:'version',theme_id:'theme',status:'active',theme_active:true,schema_version:'2.0',contract_version:'2.1',content_profile:'beauty-editorial-v1',runtime_adapter_status:'pending' }]; return []; }) };
    const service = new TenantSiteProposalsThemeService({ createQueryRunner: () => runner } as any, {} as any, {} as any, { invalidate: jest.fn() } as any, {} as any, { user: { id: cleanupId, role: 'admin', tenantId: 'doflow' } });
    (service as any).ensure = jest.fn();
    await expect(service.setDefault('aurea','1.2.0')).rejects.toThrow('adattatore di generazione non ancora attivo');
    expect(statements.some((sql) => sql.includes('SET default_version=NULL'))).toBe(false);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });
});
