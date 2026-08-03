import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsService } from './tenant-site-proposals.service';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

function makeService(request: any, queryMock = jest.fn()) {
  const ds = { query: queryMock } as any;
  const csv = { parseCsvFile: jest.fn(), buildPreviewRows: jest.fn(), normalizeRow: jest.fn(), buildSiteConfig: jest.fn() } as any;
  const templates = { listTemplates: jest.fn().mockResolvedValue([{ slug: 'colsova' }]), getDefaultConfig: jest.fn(), renderHtml: jest.fn(), buildRedirectFiles: jest.fn() } as any;
  const artifacts = { createZip: jest.fn() } as any;
  const storage = { uploadGeneratedBuffer: jest.fn(), downloadObjectStream: jest.fn() } as any;
  const service = new TenantSiteProposalsService(ds, csv, templates, artifacts, storage, request);
  (service as any).ensure = jest.fn().mockResolvedValue(undefined);
  return { service, ds, csv, templates, artifacts, storage, queryMock };
}

describe('TenantSiteProposalsService', () => {
  it('rejects non-doflow tenant and roles below manager', async () => {
    expect(() => makeService({ user: { role: 'manager', tenantId: 'federicanerone' } }).service['assertAccess'](false)).toThrow(NotFoundException);
    expect(() => makeService({ user: { role: 'viewer', tenantId: 'doflow' } }).service['assertAccess'](false)).toThrow(ForbiddenException);
  });

  it('creates import preview batch with duplicate row information', async () => {
    const { service, csv, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    csv.parseCsvFile.mockReturnValue({ rows: [{ business_name: 'A' }] });
    csv.buildPreviewRows.mockReturnValue([{ rowIndex: 1, valid: false, errors: [{ code: 'DUPLICATE_ROW' }] }]);
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'preview' }]);
    const result = await service.previewImport({ originalname: 'x.csv', mimetype: 'text/csv', buffer: Buffer.from('a') } as any);
    expect(result.rows[0].errors[0].code).toBe('DUPLICATE_ROW');
  });

  it('confirmImport is idempotent when batch is already confirmed', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'confirmed', rows: [] }]);
    queryMock.mockResolvedValueOnce([{ id: uuid, display_name: 'A' }]);
    const result = await service.confirmImport(uuid);
    expect(result.idempotent).toBe(true);
    expect(result.proposals).toHaveLength(1);
  });

  it('rejects a preview import with no valid rows before creating any proposal data', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'preview', valid_count: 0, rows: [] }]);

    await expect(service.confirmImport(uuid)).rejects.toMatchObject({ status: 400 });
    expect(queryMock.mock.calls.some(([query]) => /INSERT INTO .*site_proposals|site_proposal_versions|site_proposal_activity|UPDATE .*site_proposal_import_batches/s.test(String(query)))).toBe(false);
  });

  it('matches CRM uniquely, detects ambiguous matches and not found', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid }]);
    await expect((service as any).matchCompany({ websiteUrl: 'https://example.it', businessName: 'A' }, [])).resolves.toEqual({ companyId: uuid });
    queryMock.mockResolvedValueOnce([{ id: uuid }, { id: '650e8400-e29b-41d4-a716-446655440000' }]);
    const warnings: any[] = [];
    await (service as any).matchCompany({ websiteUrl: 'https://example.it', businessName: 'A' }, warnings);
    expect(warnings[0].code).toBe('CRM_MATCH_AMBIGUOUS');
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const warnings2: any[] = [];
    await (service as any).matchCompany({ websiteUrl: 'https://example.it', email: 'a@example.it', businessName: 'A' }, warnings2);
    expect(warnings2[0].code).toBe('CRM_MATCH_NOT_FOUND');
  });

  it('creates version 1 and activity records', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, email: 'm@example.it', role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValue([]);
    await (service as any).createVersion({ id: uuid, site_config: {}, commercial_analysis: {}, email_subject: 's', email_body: 'b' }, 1, { id: uuid, role: 'manager' }, 'initial');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('site_proposal_versions'), expect.any(Array));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('site_proposal_activity'), expect.any(Array));
  });

  it('generation uses safe S3 prefix and completed status', async () => {
    const { service, queryMock, templates, artifacts, storage } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    jest.spyOn(service, 'get').mockResolvedValue({ proposal: { id: uuid, current_version: 1, template_slug: 'colsova', template_version: '1.0.0', site_config: {} } } as any);
    queryMock.mockResolvedValueOnce([{ id: '650e8400-e29b-41d4-a716-446655440000' }]).mockResolvedValue([{ id: 'gen', status: 'completed' }]);
    templates.renderHtml.mockResolvedValue({ html: '<html></html>', sha256: 'h', size: 13 });
    templates.buildRedirectFiles.mockResolvedValue([]);
    artifacts.createZip.mockResolvedValue({ buffer: Buffer.from('zip'), sha256: 'z', size: 3, entries: [] });
    const result = await service.generateProposal(uuid);
    expect(storage.uploadGeneratedBuffer.mock.calls[0][0]).toContain(`doflow/site-proposals/${uuid}/`);
    expect(result.status).toBe('completed');
  });

  it('download verifies generation belongs to proposal and archive is soft', async () => {
    const { service, queryMock, storage } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: '650e8400-e29b-41d4-a716-446655440000', html_key: `doflow/site-proposals/${uuid}/650e8400-e29b-41d4-a716-446655440000/index.html`, status: 'completed' }]);
    storage.downloadObjectStream.mockResolvedValue({ stream: {} });
    await expect(service.downloadArtifact(uuid, 'html')).resolves.toMatchObject({ filename: 'index.html' });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'archived' }]);
    await service.archive(uuid);
    expect(queryMock.mock.calls.some((call) => String(call[0]).includes('deleted_at = COALESCE'))).toBe(true);
  });

  it('lists proposal activity with bounded pagination after checking the proposal', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid }]).mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id: 'activity', action: 'PROPOSAL_CREATED' }]);
    await expect(service.listActivity(uuid, { limit: '500', offset: '2' })).resolves.toMatchObject({ total: 1, limit: 100, offset: 2 });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC LIMIT $2 OFFSET $3'), [uuid, 100, 2]);
  });

  it('uses the singleton DataSource for shared provisioning and tenant connections for business queries', async () => {
    const runner: any = { isTransactionActive: false };
    runner.connect = jest.fn().mockResolvedValue(undefined);
    runner.startTransaction = jest.fn().mockImplementation(async () => {
      runner.isTransactionActive = true;
    });
    runner.query = jest.fn().mockResolvedValue([]);
    runner.commitTransaction = jest.fn().mockImplementation(async () => {
      runner.isTransactionActive = false;
    });
    runner.rollbackTransaction = jest.fn().mockImplementation(async () => {
      runner.isTransactionActive = false;
    });
    runner.release = jest.fn().mockResolvedValue(undefined);

    const singletonQuery = jest.fn();
    const singletonDataSource = {
      query: singletonQuery,
      createQueryRunner: jest.fn().mockReturnValue(runner),
    } as any;
    const tenantQueryA = jest.fn().mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    const tenantQueryB = jest.fn().mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    const dependencies = [
      { parseCsvFile: jest.fn(), buildPreviewRows: jest.fn(), normalizeRow: jest.fn(), buildSiteConfig: jest.fn() },
      { listTemplates: jest.fn(), getDefaultConfig: jest.fn(), renderHtml: jest.fn(), buildRedirectFiles: jest.fn() },
      { createZip: jest.fn() },
      { uploadGeneratedBuffer: jest.fn(), downloadObjectStream: jest.fn() },
    ] as any[];
    const serviceA = new TenantSiteProposalsService(
      singletonDataSource,
      dependencies[0],
      dependencies[1],
      dependencies[2],
      dependencies[3],
      { user: { id: uuid, role: 'manager', tenantId: 'doflow' }, tenantConnection: { query: tenantQueryA } },
    );
    const serviceB = new TenantSiteProposalsService(
      singletonDataSource,
      dependencies[0],
      dependencies[1],
      dependencies[2],
      dependencies[3],
      { user: { id: uuid, role: 'manager', tenantId: 'doflow' }, tenantConnection: { query: tenantQueryB } },
    );

    await Promise.all([serviceA.list({ limit: 1 }), serviceB.list({ limit: 1 })]);

    expect(singletonDataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(singletonQuery).not.toHaveBeenCalled();
    expect(tenantQueryA).toHaveBeenCalledTimes(2);
    expect(tenantQueryB).toHaveBeenCalledTimes(2);
  });
});
