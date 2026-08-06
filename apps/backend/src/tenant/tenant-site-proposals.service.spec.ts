import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsService } from './tenant-site-proposals.service';
import * as deterministic from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsCsvService } from './tenant-site-proposals-csv.service';
import { ITALIAN_CSV_FIXTURE } from './tenant-site-proposals-csv.fixture';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

function makeService(request: any, queryMock = jest.fn()) {
  const ds = { query: queryMock } as any;
  const csv = { parseCsvFile: jest.fn(), buildPreviewRows: jest.fn(), normalizeRow: jest.fn(), buildSiteConfig: jest.fn() } as any;
  const registration = { slug: 'colsova', version: '2.4.1', contentProfile: 'colsova-conversion-v1', sourceSha256: 'sha', isBuiltin: true, sourceKind: 'builtin' };
  const templates = {
    listTemplates: jest.fn().mockResolvedValue([{ slug: 'colsova' }]),
    getRegistration: jest.fn().mockResolvedValue(registration),
    resolveRuntimeTheme: jest.fn().mockResolvedValue(registration),
    getDefaultConfig: jest.fn(), getDefaultConfigForRegistration: jest.fn(), renderHtml: jest.fn(), buildRedirectFiles: jest.fn(),
  } as any;
  const artifacts = { createZip: jest.fn() } as any;
  const storage = { uploadGeneratedBuffer: jest.fn(), downloadObjectStream: jest.fn(), deleteGeneratedPrefix: jest.fn() } as any;
  const generationCore = { generate: jest.fn() } as any;
  const service = new TenantSiteProposalsService(ds, csv, templates, artifacts, storage, request, undefined, undefined, generationCore);
  (service as any).ensure = jest.fn().mockResolvedValue(undefined);
  return { service, ds, csv, templates, artifacts, storage, generationCore, queryMock };
}

describe('TenantSiteProposalsService', () => {
  it('lists active and archived proposals with disjoint scopes', async () => {
    const active = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    active.queryMock.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await active.service.list({ scope: 'active' });
    expect(active.queryMock.mock.calls[0][0]).toContain("deleted_at IS NULL AND status <> 'archived'");

    const archived = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    archived.queryMock.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await archived.service.list({ scope: 'archived', status: 'archived' });
    expect(archived.queryMock.mock.calls[0][0]).toContain("deleted_at IS NOT NULL AND status = 'archived'");
    expect(archived.queryMock.mock.calls[1][0]).toContain('archived_from_status');
  });

  it('rejects invalid list scopes and archived status filters', async () => {
    const { service } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    await expect(service.list({ scope: 'unknown' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ scope: 'archived', status: 'draft' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes unique bulk UUIDs and enforces validation limits', () => {
    const { service } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    expect((service as any).normalizeBulkIds({ ids: [uuid, uuid] })).toEqual([uuid]);
    expect(() => (service as any).normalizeBulkIds({ ids: [] })).toThrow('Seleziona almeno una proposta');
    const tooMany = Array.from({ length: 101 }, (_, index) => `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`);
    expect(() => (service as any).normalizeBulkIds({ ids: tooMany })).toThrow('massimo 100');
    expect(() => (service as any).normalizeBulkIds({ ids: ['not-a-uuid'] })).toThrow('ID proposta non valido');
  });

  it('rejects non-doflow tenant and roles below manager', async () => {
    expect(() => makeService({ user: { role: 'manager', tenantId: 'federicanerone' } }).service['assertAccess'](false)).toThrow(NotFoundException);
    expect(() => makeService({ user: { role: 'viewer', tenantId: 'doflow' } }).service['assertAccess'](false)).toThrow(ForbiddenException);
  });

  it('creates import preview batch with duplicate row information', async () => {
    const { service, csv, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    csv.parseCsvFile.mockReturnValue({ rows: [{ business_name: 'A' }] });
    csv.buildPreviewRows.mockReturnValue([{ rowIndex: 1, valid: false, errors: [{ code: 'DUPLICATE_ROW' }] }]);
    queryMock.mockResolvedValueOnce([{ slug: 'colsova', version: '2.4.1' }]).mockResolvedValueOnce([{ id: uuid, status: 'preview' }]);
    const result = await service.previewImport({ originalname: 'x.csv', mimetype: 'text/csv', buffer: Buffer.from('a') } as any);
    expect(result.rows[0].errors[0].code).toBe('DUPLICATE_ROW');
  });
  it('rejects a manipulated import payload selecting a pending theme', async () => {
    const { service, csv, templates, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    csv.parseCsvFile.mockReturnValue({ rows: [{ business_name: 'A' }] });
    queryMock.mockResolvedValueOnce([]);
    templates.resolveRuntimeTheme.mockRejectedValue(new BadRequestException('Il tema è disponibile in Libreria, ma il relativo adattatore non è attivo.'));
    await expect(service.previewImport({ originalname:'x.csv',mimetype:'text/csv',buffer:Buffer.from('a') } as any, 'preview-only', '1.0.0')).rejects.toThrow('relativo adattatore non è attivo');
    expect(csv.buildPreviewRows).not.toHaveBeenCalled();
  });
  it('uses the unique global DB default without a Colsova preference', async () => { const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } }); queryMock.mockResolvedValueOnce([{ slug: 'luce', version: '1.2.0' }]); await expect((service as any).defaultThemeSelection()).resolves.toEqual({ slug: 'luce', version: '1.2.0' }); expect(queryMock.mock.calls[0][0]).not.toContain("CASE WHEN t.slug='colsova'"); });

  it('respects Aurea as the global DB default', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ slug: 'aurea', version: '1.2.0' }]);
    await expect((service as any).defaultThemeSelection()).resolves.toEqual({ slug: 'aurea', version: '1.2.0' });
  });

  it.each([
    ['colsova', 'aurea', 'beauty-editorial-v1'],
    ['colsova', 'luce', 'beauty-conversion-v1'],
    ['aurea', 'luce', 'beauty-conversion-v1'],
    ['luce', 'aurea', 'beauty-editorial-v1'],
    ['aurea', 'colsova', 'colsova-conversion-v1'],
  ])('queues a complete cross-profile change from %s to %s', async (from, to, contentProfile) => {
    const { service, templates } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    jest.spyOn(service, 'get').mockResolvedValue({ proposal: { id: uuid, template_slug: from, template_version: from === 'colsova' ? '2.4.1' : '1.2.0' } } as any);
    templates.getRegistration.mockResolvedValue({ slug: to, version: to === 'colsova' ? '2.4.1' : '1.2.0', contentProfile });
    const enqueue = jest.fn().mockResolvedValue({ queued: true, preparationRunId: uuid });
    (service as any).preparationQueue = { enqueue };
    await expect(service.upgradeTemplate(uuid, { targetSlug: to })).resolves.toMatchObject({ idempotent: false });
    expect(enqueue).toHaveBeenCalledWith('doflow', uuid, expect.objectContaining({ id: uuid }), expect.objectContaining({
      force: true,
      generate: true,
      reason: 'template_upgrade',
      targetTemplateSlug: to,
      targetTemplateVersion: to === 'colsova' ? '2.4.1' : '1.2.0',
    }));
  });

  it('confirmImport is idempotent when batch is already confirmed', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'confirmed', rows: [] }]);
    queryMock.mockResolvedValueOnce([{ id: uuid, display_name: 'A' }]);
    const result = await service.confirmImport(uuid);
    expect(result.idempotent).toBe(true);
    expect(result.proposals).toHaveLength(1);
  });

  it('confirms four valid rows and automatically creates four real queued preparation runs', async () => {
    const ids = Array.from({ length: 4 }, (_, index) => `750e8400-e29b-41d4-a716-${String(index + 1).padStart(12, '0')}`);
    const csvService = new TenantSiteProposalsCsvService();
    const defaultConfig = await new TenantSiteProposalsTemplateService().getDefaultConfig('colsova', '1.0.0');
    const rows = csvService.buildPreviewRows(csvService.parseCsvText(ITALIAN_CSV_FIXTURE).rows, defaultConfig);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.valid && row.canonical?.businessName && row.canonical.city === 'Reggio Emilia')).toBe(true);
    const batch = { id: uuid, status: 'preview', valid_count: 4, rows, template_slug: 'colsova', template_version: '2.4.1' };
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    jest.spyOn(service, 'getImport').mockResolvedValueOnce(batch as any).mockResolvedValueOnce({ ...batch, status: 'confirmed' } as any);
    (service as any).defaultImageMode = jest.fn().mockResolvedValue('hybrid');
    (service as any).matchCompany = jest.fn().mockResolvedValue({ companyId: null });
    (service as any).createVersion = jest.fn();
    (service as any).activity = jest.fn();
    (service as any).one = jest.fn(async (sql: string, params: any[]) => sql.includes('INSERT INTO') ? { id: ids[Number(params[1]) - 1], source_row_index: params[1], display_name: params[6], preparation_status: 'idle' } : undefined);
    const built = jest.spyOn(deterministic, 'buildDeterministicProposalForTemplate').mockReturnValue({ config: { content: {} }, analysis: {}, email: { subject: 'Oggetto', body: 'Corpo [LINK_DEMO]' } } as any);
    const enqueue = jest.fn().mockResolvedValue({ queued: true, pendingDispatch: false });
    (service as any).preparationQueue = { enqueue };
    queryMock.mockImplementation(async (sql: string) => sql.includes('LEFT JOIN LATERAL') ? ids.map((id, index) => ({ id, display_name: `Impresa ${index + 1}`, source_row_index: index + 1, preparation_status: 'queued', preparation_run_status: 'dispatched', progress_percent: 0, progress_stage: 'waiting', progress_message: 'In attesa' })) : []);
    try {
      await expect(service.confirmImport(uuid)).resolves.toMatchObject({ created: 4, queued: 4, pendingDispatch: 0, failed: 0, proposalIds: ids });
      expect(enqueue).toHaveBeenCalledTimes(4);
    } finally { built.mockRestore(); }
  });

  it('isolates one confirm dispatch error and still queues all following valid rows', async () => {
    const ids = Array.from({ length: 4 }, (_, index) => `760e8400-e29b-41d4-a716-${String(index + 1).padStart(12, '0')}`);
    const rows = ids.map((_, index) => ({ rowIndex: index + 1, valid: true, errors: [], warnings: [], canonical: { businessName: `Impresa ${index + 1}` }, sourceRowHash: `hash-${index}`, fingerprint: `fingerprint-${index}`, siteConfig: { template: { slug: 'colsova', templateVersion: '2.4.1' } }, displayName: `Impresa ${index + 1}`, sourceRow: {} }));
    const batch = { id: uuid, status: 'preview', valid_count: 4, rows, template_slug: 'colsova', template_version: '2.4.1' };
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    jest.spyOn(service, 'getImport').mockResolvedValueOnce(batch as any).mockResolvedValueOnce({ ...batch, status: 'confirmed' } as any);
    (service as any).defaultImageMode = jest.fn().mockResolvedValue('hybrid');
    (service as any).matchCompany = jest.fn().mockResolvedValue({ companyId: null });
    (service as any).createVersion = jest.fn();
    (service as any).activity = jest.fn();
    (service as any).one = jest.fn(async (sql: string, params: any[]) => sql.includes('INSERT INTO') ? { id: ids[Number(params[1]) - 1], source_row_index: params[1], display_name: params[6], preparation_status: 'idle' } : undefined);
    const built = jest.spyOn(deterministic, 'buildDeterministicProposalForTemplate').mockReturnValue({ config: { content: {} }, analysis: {}, email: { subject: 'Oggetto', body: 'Corpo [LINK_DEMO]' } } as any);
    const enqueue = jest.fn().mockResolvedValueOnce({ queued: true }).mockRejectedValueOnce(new Error('dispatch failed')).mockResolvedValue({ queued: true });
    (service as any).preparationQueue = { enqueue };
    queryMock.mockImplementation(async (sql: string) => sql.includes('LEFT JOIN LATERAL') ? ids.map((id, index) => ({ id, preparation_status: index === 1 ? 'idle' : 'queued', preparation_run_status: index === 1 ? null : 'dispatched', progress_percent: 0, progress_stage: index === 1 ? 'dispatch-failed' : 'waiting' })) : []);
    try {
      await expect(service.confirmImport(uuid)).resolves.toMatchObject({ created: 4, queued: 3, failed: 1, proposalIds: ids });
      expect(enqueue).toHaveBeenCalledTimes(4);
      expect(queryMock.mock.calls.some(([sql]) => String(sql).includes("progress_stage='dispatch-failed'"))).toBe(true);
    } finally { built.mockRestore(); }
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

  it('delegates generation exclusively to the shared generation core', async () => {
    const { service, generationCore } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    generationCore.generate.mockResolvedValue({ id: 'gen', status: 'completed' });
    await expect(service.generateProposal(uuid)).resolves.toMatchObject({ status: 'completed' });
    expect(generationCore.generate).toHaveBeenCalledWith('doflow', expect.objectContaining({ id: uuid }), uuid);
  });

  it.each([
    ['empty email body', { emailBody: '' }],
    ['email without demo link', { emailBody: 'Testo manuale '.repeat(30) }],
    ['empty analysis', { commercialAnalysis: {} }],
  ])('invalidates positive preparation state after PATCH with %s', async (_name, patch) => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    const current: any = { id: uuid, status: 'generated', current_version: 2, template_slug: 'colsova', template_version: '2.4.1', site_config: {}, commercial_analysis: { summary: 'Sintesi commerciale sufficientemente lunga e verificabile per il test.', strengths: ['a'], improvementAreas: ['b'], opportunities: ['c'], whyDoflow: ['d'], evidence: ['e'], requiresManualReview: true }, email_subject: 'Oggetto valido', email_body: `${'Testo completo '.repeat(25)}[LINK_DEMO]`, preparation_status: 'ready', personalization_status: 'completed' };
    jest.spyOn(service, 'get').mockResolvedValue({ proposal: current } as any); (service as any).siteConfigValid = jest.fn().mockResolvedValue(true); (service as any).createVersion = jest.fn(); (service as any).activity = jest.fn();
    queryMock.mockResolvedValueOnce([{ ...current, email_body: (patch as any).emailBody ?? current.email_body, commercial_analysis: (patch as any).commercialAnalysis ?? current.commercial_analysis, preparation_status: 'idle', personalization_status: 'idle' }]);
    const result: any = await service.update(uuid, patch as any);
    expect(result.readiness.complete).toBe(false); expect(queryMock.mock.calls[0][0]).toContain("preparation_status='idle'"); expect(queryMock.mock.calls[0][0]).toContain("personalization_status='idle'");
    if ('emailBody' in patch) expect(result.email_body).toBe((patch as any).emailBody);
  });
  it('isolates a failed batch enqueue and continues all following rows', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    const ids = Array.from({ length: 5 }, (_, index) => `750e8400-e29b-41d4-a716-${String(index + 1).padStart(12, '0')}`);
    queryMock.mockResolvedValueOnce(ids.map((id) => ({ id, template_slug: 'colsova', template_version: '2.4.1' })));
    const enqueue = jest.fn().mockResolvedValue({ queued: true, pendingDispatch: false }).mockRejectedValueOnce(new Error('second failed'));
    // Put the isolated failure on the second row while preserving processing of rows three to five.
    enqueue.mockReset().mockResolvedValueOnce({ queued: true }).mockRejectedValueOnce(new Error('second failed')).mockResolvedValue({ queued: true });
    (service as any).preparationQueue = { enqueue };
    const result: any = await service.prepareImport(uuid, { force: true });
    expect(enqueue).toHaveBeenCalledTimes(5); expect(result).toMatchObject({ total: 5, queued: 4, failed: 1 }); expect(result.results[1]).toMatchObject({ proposalId: ids[1], failed: true });
  });

  it('routes the legacy batch generate action through preparation and isolates enqueue failures', async () => {
    const importId = '650e8400-e29b-41d4-a716-446655440000';
    const proposalId = '750e8400-e29b-41d4-a716-446655440000';
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    const generate = jest.spyOn(service, 'generateProposal');
    const enqueue = jest.fn().mockResolvedValueOnce({ queued: true }).mockRejectedValueOnce(new Error('dispatch failed'));
    (service as any).preparationQueue = { enqueue };
    queryMock.mockResolvedValueOnce([{ id: uuid, template_slug: 'colsova', template_version: '2.4.1' }, { id: proposalId, template_slug: 'colsova', template_version: '2.4.1' }]).mockResolvedValue([]);

    await expect(service.generateImport(importId)).resolves.toMatchObject({ total: 2, queued: 1, failed: 1 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(['pending', 'queued', 'running'])('returns preparing preview state instead of transient 404 for %s', async (preparationStatus) => {
    const { service } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    (service as any).one = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: uuid, preparation_status: preparationStatus, progress_percent: 60, progress_stage: 'images', progress_message: 'Selezione immagini' });
    await expect(service.previewState(uuid)).resolves.toMatchObject({ status: 'preparing', progressPercent: 60, progressStage: 'images', retryAfterSeconds: 2 });
  });

  it('streams a previous completed generation consistently during a new preparation', async () => {
    const generationId = '650e8400-e29b-41d4-a716-446655440000';
    const { service, storage } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    const stream = { pipe: jest.fn() }; storage.downloadObjectStream.mockResolvedValue({ stream });
    (service as any).one = jest.fn().mockResolvedValueOnce({ id: generationId, html_key: `doflow/site-proposals/${uuid}/${generationId}/index.html` });
    await expect(service.previewState(uuid)).resolves.toMatchObject({ status: 'completed', stream });
  });

  it('returns a coherent application conflict after failure without a completed generation', async () => {
    const { service } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    (service as any).one = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: uuid, preparation_status: 'failed', preparation_error: 'Validazione proposta fallita' });
    await expect(service.previewState(uuid)).rejects.toBeInstanceOf(ConflictException);
  });

  it('download verifies generation belongs to proposal and archive is soft', async () => {
    const { service, queryMock, storage } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: '650e8400-e29b-41d4-a716-446655440000', html_key: `doflow/site-proposals/${uuid}/650e8400-e29b-41d4-a716-446655440000/index.html`, status: 'completed' }]);
    storage.downloadObjectStream.mockResolvedValue({ stream: {} });
    await expect(service.downloadArtifact(uuid, 'html')).resolves.toMatchObject({ filename: 'index.html' });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'archived' }]);
    await service.archive(uuid);
    expect(queryMock.mock.calls.some((call) => String(call[0]).includes('archived_from_status = CASE'))).toBe(true);
  });

  it('bulk archives only active proposals and records activity', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'archived', deleted_at: 'now' }]).mockResolvedValue([]);
    await expect(service.archiveBulk({ ids: [uuid] })).resolves.toMatchObject({ requested: 1, affected: 1 });
    expect(queryMock.mock.calls[0][0]).toContain("deleted_at IS NULL AND status <> 'archived'");
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('PROPOSAL_ARCHIVED'))).toBe(false);
    expect(queryMock.mock.calls.some(([sql, params]) => String(sql).includes('site_proposal_activity') && params[1] === 'PROPOSAL_ARCHIVED')).toBe(true);
  });

  it('restores archived proposals using previous status and legacy fallbacks', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'ready', deleted_at: null }]).mockResolvedValue([]);
    await service.restore(uuid);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("WHEN archived_from_status = ANY($1::text[]) THEN archived_from_status");
    expect(sql).toContain("WHEN last_generated_at IS NOT NULL THEN 'generated'");
    expect(sql).toContain("ELSE 'draft'");
    expect(sql).toContain('archived_from_status = NULL, deleted_at = NULL');
    expect(queryMock.mock.calls.some(([, params]) => params?.[1] === 'PROPOSAL_RESTORED')).toBe(true);
  });

  it.each([
    [{ id: uuid, archived_from_status: null, last_generated_at: 'now', status: 'generated' }, 'generated'],
    [{ id: uuid, archived_from_status: null, last_generated_at: null, status: 'draft' }, 'draft'],
  ])('returns the legacy restore fallback status %s', async (restored, expectedStatus) => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([restored]).mockResolvedValue([]);
    await expect(service.restore(uuid)).resolves.toMatchObject({ status: expectedStatus });
  });

  it('bulk restores only archived proposals', async () => {
    const { service, queryMock } = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    queryMock.mockResolvedValueOnce([{ id: uuid, status: 'generated', deleted_at: null }]).mockResolvedValue([]);
    await expect(service.restoreBulk({ ids: [uuid] })).resolves.toMatchObject({ requested: 1, affected: 1 });
    expect(queryMock.mock.calls[0][0]).toContain("deleted_at IS NOT NULL AND status = 'archived'");
  });

  it('restricts permanent deletion to admin and deletes storage before the database row', async () => {
    const manager = makeService({ user: { id: uuid, role: 'manager', tenantId: 'doflow' } });
    await expect(manager.service.delete(uuid)).rejects.toBeInstanceOf(ForbiddenException);

    const runner: any = { isTransactionActive: false };
    runner.connect = jest.fn().mockResolvedValue(undefined);
    runner.startTransaction = jest.fn().mockImplementation(async () => { runner.isTransactionActive = true; });
    runner.query = jest.fn()
      .mockResolvedValueOnce([{ id: uuid }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    runner.commitTransaction = jest.fn().mockImplementation(async () => { runner.isTransactionActive = false; });
    runner.rollbackTransaction = jest.fn();
    runner.release = jest.fn().mockResolvedValue(undefined);
    const query = jest.fn();
    const admin = makeService({ user: { id: uuid, role: 'admin', tenantId: 'doflow' } }, query);
    admin.ds.createQueryRunner = jest.fn().mockReturnValue(runner);
    admin.storage.deleteGeneratedPrefix.mockResolvedValue(4);

    await expect(admin.service.delete(uuid)).resolves.toEqual({ deleted: true, id: uuid, storageObjectsDeleted: 4 });
    expect(runner.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(admin.storage.deleteGeneratedPrefix).toHaveBeenCalledWith(`doflow/site-proposals/${uuid}/`);
    expect(runner.query.mock.calls[2][0]).toContain('DELETE FROM "doflow".site_proposals');
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it.each(['admin', 'owner', 'superadmin'])('allows permanent deletion access for %s', (role) => {
    const { service } = makeService({ user: { id: uuid, role, tenantId: 'doflow' } });
    expect(() => (service as any).assertPermanentDeleteAccess()).not.toThrow();
  });

  it('returns conflict for running generations and rolls back storage failures', async () => {
    const runner: any = { isTransactionActive: false };
    runner.connect = jest.fn();
    runner.startTransaction = jest.fn().mockImplementation(async () => { runner.isTransactionActive = true; });
    runner.query = jest.fn().mockResolvedValueOnce([{ id: uuid }]).mockResolvedValueOnce([{ id: 'running' }]);
    runner.commitTransaction = jest.fn();
    runner.rollbackTransaction = jest.fn().mockImplementation(async () => { runner.isTransactionActive = false; });
    runner.release = jest.fn();
    const running = makeService({ user: { id: uuid, role: 'admin', tenantId: 'doflow' } });
    running.ds.createQueryRunner = jest.fn().mockReturnValue(runner);
    await expect(running.service.delete(uuid)).rejects.toBeInstanceOf(ConflictException);
    expect(running.storage.deleteGeneratedPrefix).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();

    const storageRunner: any = { ...runner, isTransactionActive: false };
    storageRunner.connect = jest.fn();
    storageRunner.startTransaction = jest.fn().mockImplementation(async () => { storageRunner.isTransactionActive = true; });
    storageRunner.query = jest.fn().mockResolvedValueOnce([{ id: uuid }]).mockResolvedValueOnce([]);
    storageRunner.rollbackTransaction = jest.fn().mockImplementation(async () => { storageRunner.isTransactionActive = false; });
    storageRunner.release = jest.fn();
    const failed = makeService({ user: { id: uuid, role: 'admin', tenantId: 'doflow' } });
    failed.ds.createQueryRunner = jest.fn().mockReturnValue(storageRunner);
    failed.storage.deleteGeneratedPrefix.mockRejectedValue(new Error('storage unavailable'));
    await expect(failed.service.delete(uuid)).rejects.toThrow('storage unavailable');
    expect(storageRunner.query).toHaveBeenCalledTimes(2);
    expect(storageRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('continues bulk deletion after a sanitized individual failure', async () => {
    const second = '650e8400-e29b-41d4-a716-446655440000';
    const { service } = makeService({ user: { id: uuid, role: 'admin', tenantId: 'doflow' } });
    jest.spyOn(service, 'delete').mockResolvedValueOnce({ deleted: true, id: uuid, storageObjectsDeleted: 1 }).mockRejectedValueOnce(new Error('bucket secret SQL'));
    await expect(service.deleteBulk({ ids: [uuid, second] })).resolves.toEqual({
      requested: 2,
      deleted: 1,
      deletedIds: [uuid],
      failed: [{ id: second, message: 'Eliminazione non riuscita.' }],
    });
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
