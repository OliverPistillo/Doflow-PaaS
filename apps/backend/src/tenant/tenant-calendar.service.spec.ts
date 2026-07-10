import { BadRequestException } from '@nestjs/common';
import { ensureTenantCalendarTables, seedTenantPlanningViews } from './tenant-calendar-schema';
import { TenantCalendarService } from './tenant-calendar.service';

describe('TenantCalendarService', () => {
  const ownerUser = { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' };
  const managerUser = { sub: '22222222-2222-4222-8222-222222222222', role: 'manager', tenantId: 'doflow' };

  function makeService(user = ownerUser) {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantCalendarService(
      { query } as any,
      { createNotification: jest.fn().mockResolvedValue({ created: true }) } as any,
      { user },
    );
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    return { service, query };
  }

  it('options ritorna allowlist calendario e non contiene integrazioni esterne', async () => {
    const { service } = makeService();

    const options = await service.options();

    expect(options.event_types).toContain('task_due');
    expect(options.event_types).toContain('invoice_due');
    expect(options.reminder_methods).toContain('notification');
    expect(options.event_types).not.toContain('google_calendar');
  });

  it('rifiuta event_type non consentito', async () => {
    const { service } = makeService();

    await expect(service.createEvent({
      title: 'Evento unsafe',
      event_type: 'send_webhook',
      start_at: new Date().toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rifiuta end_at prima di start_at', async () => {
    const { service } = makeService();

    await expect(service.createEvent({
      title: 'Evento invalido',
      start_at: '2026-07-10T12:00:00.000Z',
      end_at: '2026-07-10T10:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea evento manuale valido e logga activity', async () => {
    const event = {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Kickoff interno',
      event_type: 'meeting',
      status: 'scheduled',
      priority: 'medium',
      start_at: '2026-07-10T10:00:00.000Z',
      end_at: null,
      visibility: 'team',
      metadata: null,
    };
    const { service, query } = makeService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO "doflow".calendar_events')) return [event];
      return [];
    });

    const created = await service.createEvent({
      title: 'Kickoff interno',
      event_type: 'meeting',
      start_at: event.start_at,
    });

    expect(created).toMatchObject({ id: event.id, title: event.title });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('planning_activity'))).toBe(true);
  });

  it('oscura evento finance a manager', () => {
    const { service } = makeService(managerUser);
    const scrubbed = (service as any).scrubEvent({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Fattura ABC 5000 euro',
      description: 'Incasso sensibile',
      event_type: 'invoice_due',
      metadata: { amount: 5000 },
      source_entity_id: '55555555-5555-4555-8555-555555555555',
    }, { id: managerUser.sub, role: 'manager' });

    expect(scrubbed.title).toBe('Scadenza fattura');
    expect(scrubbed.description).toBeNull();
    expect(scrubbed.source_entity_id).toBeNull();
    expect(scrubbed.metadata).toEqual({ scrubbed: true });
  });

  it('conflicts costruisce query overlap busy events', async () => {
    const { service, query } = makeService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "doflow".calendar_events a') && sql.includes('JOIN "doflow".calendar_events b')) {
        return [{ event_a_id: 'a', event_b_id: 'b', reason: 'overlap_busy_events' }];
      }
      return [];
    });

    const result = await service.conflicts({
      start: '2026-07-10T00:00:00.000Z',
      end: '2026-07-17T00:00:00.000Z',
    });

    expect(result.total).toBe(1);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('overlap_busy_events'))).toBe(true);
  });
});

describe('tenant calendar schema', () => {
  it('bootstrap schema non usa DROP TABLE', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await ensureTenantCalendarTables({ query } as any, 'doflow');

    expect(query.mock.calls.some(([sql]) => String(sql).includes('DROP TABLE'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('calendar_events'))).toBe(true);
  });

  it('seeda viste base in modo idempotente', async () => {
    const views = new Map<string, string>();
    const systemViews = new Map<string, { id: string; name: string; view_type: string; filters: string }>();
    let insertCount = 0;
    let updateCount = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ');
      if (compact.includes('SELECT id FROM "doflow".planning_views')) {
        const key = `${params[0]}:${params[1]}`;
        const id = views.get(key);
        return id ? [{ id }] : [];
      }
      if (compact.includes('INSERT INTO "doflow".planning_views')) {
        insertCount += 1;
        const key = `${params[0]}:${params[1]}`;
        const id = `view-${insertCount}`;
        views.set(key, id);
        systemViews.set(id, { id, name: String(params[0]), view_type: String(params[1]), filters: String(params[2]) });
        return [];
      }
      if (compact.includes('UPDATE "doflow".planning_views')) {
        expect(compact).toContain('SET name = $1, view_type = $2, filters = $3::jsonb');
        expect(params).toHaveLength(4);
        updateCount += 1;
        const existing = systemViews.get(String(params[3]));
        if (existing) {
          existing.name = String(params[0]);
          existing.view_type = String(params[1]);
          existing.filters = String(params[2]);
        }
        return [];
      }
      return [];
    });

    await seedTenantPlanningViews({ query } as any, 'doflow');
    await seedTenantPlanningViews({ query } as any, 'doflow');

    expect(views.size).toBe(5);
    expect(systemViews.size).toBe(5);
    expect(insertCount).toBe(5);
    expect(updateCount).toBe(5);
    expect(new Set(Array.from(systemViews.values()).map((view) => `${view.name}:${view.view_type}`)).size).toBe(5);
  });
});
