import { ensureLeadIntakeSubmissionsTable } from '../public-lead-intake/public-lead-intake-schema';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import { TenantCrmService } from './tenant-crm.service';

jest.mock('../public-lead-intake/public-lead-intake-schema', () => ({
  ensureLeadIntakeSubmissionsTable: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./tenant-crm-schema', () => ({
  ensureTenantCrmCoreTables: jest.fn().mockResolvedValue(undefined),
}));

describe('TenantCrmService lead intake integration', () => {
  const originalTenants = process.env.PUBLIC_LEAD_INTAKE_TENANTS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PUBLIC_LEAD_INTAKE_TENANTS;
  });

  afterAll(() => {
    if (originalTenants === undefined) delete process.env.PUBLIC_LEAD_INTAKE_TENANTS;
    else process.env.PUBLIC_LEAD_INTAKE_TENANTS = originalTenants;
  });

  it('assicura lo schema intake dopo il CRM core ed espone l ultima submission per lead', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const dataSource = { query };
    const request = {
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'manager',
        tenantId: 'doflow',
      },
    };
    const service = new TenantCrmService(dataSource as any, request);

    await service.list('leads', {});

    expect(ensureTenantCrmCoreTables).toHaveBeenCalledWith(dataSource, 'doflow');
    expect(ensureLeadIntakeSubmissionsTable).toHaveBeenCalledWith(dataSource, 'doflow');
    expect((ensureTenantCrmCoreTables as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((ensureLeadIntakeSubmissionsTable as jest.Mock).mock.invocationCallOrder[0]);

    const listSql = String(query.mock.calls[1][0]).replace(/\s+/g, ' ');
    expect(listSql).toContain('LEFT JOIN LATERAL');
    expect(listSql).toContain('ORDER BY lis.created_at DESC');
    expect(listSql).toContain('LIMIT 1');
    expect(listSql).toContain('intake.submission_id AS intake_submission_id');
    expect(listSql).toContain('intake.form_data AS intake_form_data');
    expect(listSql).toContain('intake.attribution AS intake_attribution');
    expect(listSql).toContain('intake.landing_url AS intake_landing_url');
    expect(listSql).toContain('intake.source_origin AS intake_source_origin');
    expect(listSql).toContain('intake.created_at AS intake_created_at');
  });

  it('non crea o referenzia la tabella intake per un tenant non abilitato e mantiene gli alias null', async () => {
    process.env.PUBLIC_LEAD_INTAKE_TENANTS = 'doflow';
    const row = {
      id: 'lead-1',
      intake_submission_id: null,
      intake_form_data: null,
      intake_attribution: null,
      intake_landing_url: null,
      intake_source_origin: null,
      intake_created_at: null,
    };
    const query = jest.fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);
    const dataSource = { query };
    const request = {
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'manager',
        tenantId: 'federicanerone',
      },
    };
    const service = new TenantCrmService(dataSource as any, request);

    const result = await service.list('leads', {});

    expect(ensureTenantCrmCoreTables).toHaveBeenCalledWith(dataSource, 'federicanerone');
    expect(ensureLeadIntakeSubmissionsTable).not.toHaveBeenCalled();

    const statements = query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' '));
    expect(statements.join(' ')).not.toContain('lead_intake_submissions');
    expect(statements[1]).not.toContain('LEFT JOIN LATERAL');
    expect(statements[1]).toContain('NULL::uuid AS intake_submission_id');
    expect(statements[1]).toContain('NULL::jsonb AS intake_form_data');
    expect(statements[1]).toContain('NULL::jsonb AS intake_attribution');
    expect(statements[1]).toContain('NULL::text AS intake_landing_url');
    expect(statements[1]).toContain('NULL::text AS intake_source_origin');
    expect(statements[1]).toContain('NULL::timestamptz AS intake_created_at');
    expect(result.items[0]).toEqual(row);
  });

  it('espone intake e dati contatto nelle opportunities e nella pipeline del tenant abilitato', async () => {
    const listQuery = jest.fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    const request = {
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'manager',
        tenantId: 'doflow',
      },
    };
    const listService = new TenantCrmService({ query: listQuery } as any, request);

    await listService.list('opportunities', {});

    const opportunitySql = String(listQuery.mock.calls[1][0]).replace(/\s+/g, ' ');
    expect(opportunitySql).toContain('LEFT JOIN LATERAL');
    expect(opportunitySql).toContain('WHERE lis.opportunity_id = t.id');
    expect(opportunitySql).toContain('ORDER BY lis.created_at DESC');
    expect(opportunitySql).toContain('LIMIT 1');
    expect(opportunitySql).toContain('ct.email AS contact_email');
    expect(opportunitySql).toContain('ct.phone AS contact_phone');
    expect(opportunitySql).toContain('intake.submission_id AS intake_submission_id');
    expect(opportunitySql).toContain('intake.form_data AS intake_form_data');
    expect(opportunitySql).toContain('intake.attribution AS intake_attribution');
    expect(opportunitySql).toContain('intake.landing_url AS intake_landing_url');
    expect(opportunitySql).toContain('intake.source_origin AS intake_source_origin');
    expect(opportunitySql).toContain('intake.created_at AS intake_created_at');

    const pipelineQuery = jest.fn().mockResolvedValueOnce([]);
    const pipelineService = new TenantCrmService({ query: pipelineQuery } as any, request);
    await pipelineService.pipeline({});

    const pipelineSql = String(pipelineQuery.mock.calls[0][0]).replace(/\s+/g, ' ');
    expect(pipelineSql).toContain('LEFT JOIN LATERAL');
    expect(pipelineSql).toContain('WHERE lis.opportunity_id = t.id');
    expect(pipelineSql).toContain('intake.submission_id AS intake_submission_id');
    expect(pipelineSql).toContain('intake.form_data AS intake_form_data');
    expect(pipelineSql).toContain('intake.attribution AS intake_attribution');
    expect(pipelineSql).toContain('intake.landing_url AS intake_landing_url');
    expect(pipelineSql).toContain('intake.source_origin AS intake_source_origin');
    expect(pipelineSql).toContain('intake.created_at AS intake_created_at');
  });

  it('mantiene opportunities e pipeline compatibili senza DDL o riferimenti intake per federicanerone', async () => {
    process.env.PUBLIC_LEAD_INTAKE_TENANTS = 'doflow';
    const request = {
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        role: 'manager',
        tenantId: 'federicanerone',
      },
    };
    const listQuery = jest.fn()
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await new TenantCrmService({ query: listQuery } as any, request).list('opportunities', {});

    const pipelineQuery = jest.fn().mockResolvedValueOnce([]);
    await new TenantCrmService({ query: pipelineQuery } as any, request).pipeline({});

    const statements = [...listQuery.mock.calls, ...pipelineQuery.mock.calls]
      .map(([sql]) => String(sql).replace(/\s+/g, ' '));
    expect(ensureLeadIntakeSubmissionsTable).not.toHaveBeenCalled();
    expect(statements.join(' ')).not.toContain('lead_intake_submissions');
    expect(statements.join(' ')).not.toContain('LEFT JOIN LATERAL');
    for (const sql of [statements[1], statements[2]]) {
      expect(sql).toContain('NULL::uuid AS intake_submission_id');
      expect(sql).toContain('NULL::jsonb AS intake_form_data');
      expect(sql).toContain('NULL::jsonb AS intake_attribution');
      expect(sql).toContain('NULL::text AS intake_landing_url');
      expect(sql).toContain('NULL::text AS intake_source_origin');
      expect(sql).toContain('NULL::timestamptz AS intake_created_at');
    }
  });

  it('mantiene invariato il comando di aggiornamento stage', async () => {
    const service = new TenantCrmService({ query: jest.fn() } as any, {
      user: { sub: '11111111-1111-4111-8111-111111111111', role: 'manager', tenantId: 'doflow' },
    });
    const update = jest.spyOn(service, 'update').mockResolvedValue({ id: 'opportunity-1', stage: 'contacted' });

    await expect(service.updateOpportunityStage('opportunity-1', 'contacted')).resolves.toEqual({ id: 'opportunity-1', stage: 'contacted' });
    expect(update).toHaveBeenCalledWith('opportunities', 'opportunity-1', { stage: 'contacted' });
    await expect(service.updateOpportunityStage('opportunity-1', 'invalid-stage')).rejects.toThrow('Stage non valido');
  });
});
