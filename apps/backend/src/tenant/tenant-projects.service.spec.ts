import { TenantProjectsService } from './tenant-projects.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const QUOTE_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

describe('TenantProjectsService', () => {
  function createService(tenantId = 'doflow') {
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn(),
    };
    const runner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    };
    dataSource.createQueryRunner.mockReturnValue(runner);
    const request = {
      authUser: {
        id: USER_ID,
        email: 'owner@doflow.it',
        role: 'owner',
        tenantId,
      },
    };
    const service = new TenantProjectsService(dataSource as any, request);
    return { service, dataSource, runner };
  }

  it('applies safe defaults for manual project creation payloads', () => {
    const { service } = createService();
    const cleaned = (service as any).cleanProjectBody({ name: 'Progetto manuale' }, false, 'doflow');

    expect(cleaned.name).toBe('Progetto manuale');
    expect(cleaned.status).toBe('to_start');
    expect(cleaned.priority).toBe('medium');
    expect(cleaned.progress).toBe(0);
  });

  it('normalizes Doflow reads in memory without dropping unknown records', async () => {
    const { service, dataSource } = createService();
    (service as any).ensureSchema = jest.fn();
    dataSource.query
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: PROJECT_ID, status: 'client_review' },
        { id: QUOTE_ID, status: 'unexpected' },
      ]);

    const result = await service.listProjects({ limit: 100 });

    expect(result.items).toEqual([
      expect.objectContaining({ id: PROJECT_ID, status: 'review' }),
      expect.objectContaining({ id: QUOTE_ID, status: 'unexpected', project_status_unmapped: true }),
    ]);
    expect(result.total).toBe(2);
  });

  it('expands a canonical Doflow filter with parameterized aliases', async () => {
    const { service, dataSource } = createService();
    (service as any).ensureSchema = jest.fn();
    dataSource.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await service.listProjects({ status: 'review' });

    const [countSql, params] = dataSource.query.mock.calls[0];
    expect(countSql).toContain("LOWER(COALESCE(p.status, '')) = ANY($1::text[])");
    expect(params[0]).toEqual(['internal_review', 'client_review', 'corrections', 'seo_performance', 'qa', 'review']);
  });

  it('persists known aliases canonically and writes one specific status audit', async () => {
    const { service, dataSource } = createService();
    (service as any).ensureSchema = jest.fn();
    jest.spyOn(service, 'getProject').mockResolvedValue({ id: PROJECT_ID, status: 'review' } as any);
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM "doflow".projects')) return [{ status: 'client_review' }];
      if (sql.includes('UPDATE "doflow".projects')) return [{ id: PROJECT_ID }];
      return [];
    });

    await service.updateProjectStatus(PROJECT_ID, 'qa');

    const update = dataSource.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE "doflow".projects'));
    expect(update?.[1]?.[0]).toBe('review');
    const audits = dataSource.query.mock.calls.filter(([sql]) => String(sql).includes('audit_log'));
    expect(audits).toHaveLength(1);
    expect(audits[0][1]).toEqual(expect.arrayContaining([
      'project_status_changed',
      PROJECT_ID,
      expect.stringContaining('"previous_status_raw":"client_review"'),
    ]));
  });

  it('rejects unknown Doflow writes and prevents generic current_phase updates', () => {
    const { service } = createService();
    expect(() => (service as any).cleanProjectBody({ status: 'unexpected' }, true, 'doflow')).toThrow('Status progetto non valido');
    expect((service as any).cleanProjectBody({ current_phase: 'legacy note' }, true, 'doflow')).toEqual({});
  });

  it('preserves legacy status and current_phase behavior for other tenants', () => {
    const { service } = createService('tenant_legacy');
    expect((service as any).cleanProjectBody({ status: 'client_review', current_phase: 'Copy finale' }, true, 'tenant_legacy')).toEqual({
      status: 'client_review',
      current_phase: 'Copy finale',
    });
    expect(() => (service as any).cleanProjectBody({ status: 'review' }, true, 'tenant_legacy')).toThrow('Status progetto non valido');
  });

  it('creates a project from an accepted quote with medium priority when priority is omitted', async () => {
    const { service, runner } = createService();
    jest.spyOn(service, 'getProject').mockResolvedValue({ id: PROJECT_ID, priority: 'medium' } as any);

    runner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "doflow".projects WHERE quote_id')) return [];
      if (sql.includes('FROM "doflow".quotes q')) {
        return [{
          id: QUOTE_ID,
          status: 'accepted',
          title: 'Preventivo sito',
          company_id: null,
          contact_id: null,
          opportunity_id: null,
          briefing_id: null,
          service_type: null,
          briefing_type: null,
        }];
      }
      if (sql.includes('INSERT INTO "doflow".projects')) return [{ id: PROJECT_ID }];
      return [];
    });

    await service.createFromQuote(QUOTE_ID, {});

    const projectInsert = runner.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO "doflow".projects'));
    expect(projectInsert).toBeTruthy();
    expect(projectInsert?.[1]).toEqual(expect.arrayContaining(['to_start', 'medium', 0]));
  });
});
