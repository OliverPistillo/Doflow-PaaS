import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantRecordOperationsService } from './tenant-record-operations.service';
import { ensureDoflowRecordOperationsTables } from './tenant-record-operations-schema';

jest.mock('./tenant-record-operations-schema', () => ({
  ensureDoflowRecordOperationsTables: jest.fn().mockResolvedValue(undefined),
}));

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OPPORTUNITY_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const MATERIAL_ID = '44444444-4444-4444-8444-444444444444';
const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';

function fullAccess(overrides: Record<string, any> = {}) {
  const capability = { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
  return { role: 'owner', audience: 'executive', modules: { crm: { ...capability }, projects: { ...capability }, documents: { ...capability }, finance: { ...capability }, ...overrides } };
}

function harness(options: { tenant?: string; query?: jest.Mock; access?: any } = {}) {
  const query = options.query || jest.fn().mockResolvedValue([]);
  const crm = {
    findOne: jest.fn(async (resource: string, id: string) => resource === 'companies'
      ? { id }
      : { id, company_id: COMPANY_ID }),
  };
  const projects = {
    getProject: jest.fn(async (id: string) => ({ id, company_id: COMPANY_ID, opportunity_id: OPPORTUNITY_ID, quote_id: null })),
  };
  const permissions = { getCurrentAccess: jest.fn(async () => options.access || fullAccess()) };
  const request = { user: { sub: USER_ID, email: 'owner@example.test', role: 'owner', tenantId: options.tenant || 'doflow' } };
  return {
    service: new TenantRecordOperationsService({ query } as any, request, crm as any, projects as any, permissions as any),
    query, crm, projects, permissions,
  };
}

describe('TenantRecordOperationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resta tenant-only e valida kind e UUID prima delle query dominio', async () => {
    await expect(harness({ tenant: 'legacy' }).service.listMaterials({ record_kind: 'company', record_id: COMPANY_ID }))
      .rejects.toBeInstanceOf(ForbiddenException);
    const { service, crm } = harness();
    await expect(service.listMaterials({ record_kind: 'lead', record_id: COMPANY_ID })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listMaterials({ record_kind: 'company', record_id: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    expect(crm.findOne).not.toHaveBeenCalled();
  });

  it('propaga record non trovato e nega documenti senza capability', async () => {
    const missing = harness();
    missing.crm.findOne.mockRejectedValueOnce(new NotFoundException('Azienda non trovata'));
    await expect(missing.service.listMaterials({ record_kind: 'company', record_id: COMPANY_ID })).rejects.toBeInstanceOf(NotFoundException);
    const denied = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    await expect(harness({ access: fullAccess({ documents: denied }) }).service.listMaterials({ record_kind: 'company', record_id: COMPANY_ID }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea una richiesta parametrizzata e un solo audit', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('INSERT INTO "doflow".material_requests')) return [{ id: MATERIAL_ID, title: 'Logo vettoriale', status: 'requested' }];
      return [];
    });
    const { service } = harness({ query });
    const result = await service.createMaterial({ record_kind: 'company', record_id: COMPANY_ID, title: 'Logo vettoriale' });
    expect(result).toMatchObject({ id: MATERIAL_ID, status: 'requested' });
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('material_requests ('));
    expect(insert?.[1]).toContain(COMPANY_ID);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('audit_log'))).toHaveLength(1);
    const auditCall = query.mock.calls.find(([sql]) => String(sql).includes('audit_log'));
    expect(auditCall).toBeDefined();
    expect(auditCall![1]?.[2]).toBe('material_requested');
  });

  it('elenca richieste sul target senza perdere gli stati conclusi', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => sql.includes('FROM "doflow".material_requests m') ? [{ id: MATERIAL_ID, status: 'received' }] : []);
    const result = await harness({ query }).service.listMaterials({ record_kind: 'opportunity', record_id: OPPORTUNITY_ID });
    expect(result.items).toHaveLength(1);
    const call = query.mock.calls.find(([sql]) => String(sql).includes('material_requests m'));
    expect(call?.[0]).toContain('m.opportunity_id = $1');
    expect(call?.[1]).toEqual([OPPORTUNITY_ID]);
  });

  it('riceve e collega un file al progetto una volta sola', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT * FROM "doflow".material_requests')) return [{ id: MATERIAL_ID, project_id: PROJECT_ID, title: 'Foto', status: 'requested' }];
      if (sql.includes('FROM "doflow".documents')) return [{ id: DOCUMENT_ID, category: 'project_asset', visibility: 'internal' }];
      if (sql.includes('UPDATE "doflow".material_requests')) return [{ id: MATERIAL_ID, status: 'received', received_document_id: DOCUMENT_ID }];
      return [];
    });
    const { service } = harness({ query });
    await expect(service.receiveMaterial(MATERIAL_ID, { document_id: DOCUMENT_ID })).resolves.toMatchObject({ status: 'received' });
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('INSERT INTO "doflow".document_links');
    expect(sql).toContain('INSERT INTO "doflow".project_file_links');
    expect(query.mock.calls.filter(([statement]) => String(statement).includes('document_activity'))).toHaveLength(0);
    expect(query.mock.calls.filter(([statement]) => String(statement).includes('audit_log'))).toHaveLength(1);
  });

  it('receive e waive sono idempotenti sugli stati già conclusi', async () => {
    const receiveQuery = jest.fn(async (sql: string, _params?: unknown[]) => sql.includes('SELECT * FROM "doflow".material_requests')
      ? [{ id: MATERIAL_ID, company_id: COMPANY_ID, status: 'received', received_document_id: DOCUMENT_ID }]
      : []);
    await harness({ query: receiveQuery }).service.receiveMaterial(MATERIAL_ID, { document_id: DOCUMENT_ID });
    expect(receiveQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE "doflow".material_requests'))).toBe(false);
    const waiveQuery = jest.fn(async (sql: string, _params?: unknown[]) => sql.includes('SELECT * FROM "doflow".material_requests')
      ? [{ id: MATERIAL_ID, company_id: COMPANY_ID, status: 'waived' }]
      : []);
    await harness({ query: waiveQuery }).service.waiveMaterial(MATERIAL_ID);
    expect(waiveQuery.mock.calls.some(([sql]) => String(sql).includes('audit_log'))).toBe(false);
  });

  it('rifiuta documenti finance come materiali operativi', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT * FROM "doflow".material_requests')) return [{ id: MATERIAL_ID, company_id: COMPANY_ID, status: 'requested' }];
      if (sql.includes('FROM "doflow".documents')) return [{ id: DOCUMENT_ID, category: 'invoice', visibility: 'finance' }];
      return [];
    });
    await expect(harness({ query }).service.receiveMaterial(MATERIAL_ID, { document_id: DOCUMENT_ID })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nega l’aggregato senza finance e usa soltanto subquery schema-scoped', async () => {
    const denied = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    await expect(harness({ access: fullAccess({ finance: denied }) }).service.administration({ record_kind: 'company', record_id: COMPANY_ID }))
      .rejects.toBeInstanceOf(ForbiddenException);

    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM "doflow".invoices i')) return [{ id: DOCUMENT_ID, status: 'sent', total: 1200, paid_total: 400, remaining_total: 800, due_date: '2026-08-01' }];
      if (sql.includes('FROM "doflow".financial_deadlines')) return [{ id: MATERIAL_ID, status: 'open', due_date: '2026-09-01' }];
      return [];
    });
    const result = await harness({ query }).service.administration({ record_kind: 'company', record_id: COMPANY_ID });
    expect(result.summary).toEqual(expect.objectContaining({ total_invoiced: 1200, total_paid: 400, total_remaining: 800, total_overdue: 800 }));
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).not.toMatch(/FROM invoices\b|FROM quotes\b|FROM projects\b|FROM recurring_services\b/);
    expect(sql).toContain('FROM "doflow".invoices');
  });

  it('crea lo schema minimo soltanto dopo accesso e target validi', async () => {
    await harness().service.listMaterials({ record_kind: 'company', record_id: COMPANY_ID });
    expect(ensureDoflowRecordOperationsTables).toHaveBeenCalledWith(expect.anything(), 'doflow');
  });
});
