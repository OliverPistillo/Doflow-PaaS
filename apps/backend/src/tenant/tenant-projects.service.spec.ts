import { TenantProjectsService } from './tenant-projects.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const QUOTE_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

describe('TenantProjectsService', () => {
  function createService() {
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
        tenantId: 'doflow',
      },
    };
    const service = new TenantProjectsService(dataSource as any, request);
    return { service, dataSource, runner };
  }

  it('applies safe defaults for manual project creation payloads', () => {
    const { service } = createService();
    const cleaned = (service as any).cleanProjectBody({ name: 'Progetto manuale' }, false);

    expect(cleaned.name).toBe('Progetto manuale');
    expect(cleaned.status).toBe('to_start');
    expect(cleaned.priority).toBe('medium');
    expect(cleaned.progress).toBe(0);
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
