import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantTimelineService } from './tenant-timeline.service';
import { ensureDoflowTimelineSchema } from './tenant-timeline-schema';

jest.mock('./tenant-timeline-schema', () => ({
  ensureDoflowTimelineSchema: jest.fn().mockResolvedValue(undefined),
}));

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OPPORTUNITY_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

function access(overrides: Record<string, any> = {}) {
  const full = { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
  return {
    role: 'owner',
    audience: 'executive',
    modules: {
      crm: { ...full }, projects: { ...full }, documents: { ...full }, quotes: { ...full },
      contracts: { ...full }, finance: { ...full }, ...overrides,
    },
  };
}

function harness(options: {
  tenant?: string;
  query?: jest.Mock;
  access?: any;
  company?: any;
  opportunity?: any;
  project?: any;
} = {}) {
  const query = options.query || jest.fn(async (sql: string) => {
    if (sql.includes('to_regclass')) return [{ name: null }];
    return [];
  });
  const crm = {
    findOne: jest.fn(async (resource: string, id: string) => {
      if (resource === 'companies') return options.company || { id };
      return options.opportunity || { id, company_id: COMPANY_ID, contact_id: null };
    }),
  };
  const projects = {
    getProject: jest.fn(async (id: string) => options.project || ({ id, company_id: COMPANY_ID, opportunity_id: OPPORTUNITY_ID })),
  };
  const permissions = { getCurrentAccess: jest.fn(async () => options.access || access()) };
  const request = {
    user: { sub: USER_ID, email: 'owner@example.test', role: 'owner', tenantId: options.tenant || 'doflow' },
  };
  return {
    service: new TenantTimelineService({ query } as any, request, crm as any, projects as any, permissions as any),
    query,
    crm,
    projects,
    permissions,
  };
}

describe('TenantTimelineService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resta disponibile soltanto nel tenant doflow', async () => {
    const { service } = harness({ tenant: 'tenantlegacy' });
    await expect(service.list({ record_kind: 'company', record_id: COMPANY_ID })).rejects.toBeInstanceOf(ForbiddenException);
    expect(ensureDoflowTimelineSchema).not.toHaveBeenCalled();
  });

  it('rifiuta UUID e record_kind invalidi prima delle query dominio', async () => {
    const { service, crm } = harness();
    await expect(service.list({ record_kind: 'company', record_id: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ record_kind: 'lead', record_id: COMPANY_ID })).rejects.toBeInstanceOf(BadRequestException);
    expect(crm.findOne).not.toHaveBeenCalled();
  });

  it('propaga il record inesistente dal servizio tenant-scoped', async () => {
    const { service, crm } = harness();
    crm.findOne.mockRejectedValueOnce(new NotFoundException('Azienda non trovata'));
    await expect(service.list({ record_kind: 'company', record_id: COMPANY_ID })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applica capability di lettura e scrittura backend', async () => {
    const denied = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    const reader = { can_view: true, can_create: false, can_update: false, can_delete: false, can_manage: false };
    await expect(harness({ access: access({ crm: denied }) }).service.list({ record_kind: 'company', record_id: COMPANY_ID }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness({ access: access({ crm: reader }) }).service.createNote({ record_kind: 'company', record_id: COMPANY_ID, body: 'Nota' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mappa attività, audit, commenti e task in ordine recente con cursor pagination', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ name: null }];
      if (sql.includes('commercial_activities a')) return [{
        id: 'activity:a', company_id: COMPANY_ID, type: 'call', channel: 'phone', direction: 'outbound',
        author_user_id: USER_ID, author_label: 'Operatore', created_at: '2026-08-17T10:00:00.000Z',
        status: 'manually_confirmed', outcome: 'answered', title: 'Chiamata', body: 'Esito', metadata: {}, source: 'commercial_activity',
      }];
      if (sql.includes('project_comments pc')) return [{
        id: 'comment:b', company_id: COMPANY_ID, project_id: PROJECT_ID, type: 'note', channel: 'internal',
        author_label: 'Operatore', created_at: '2026-08-17T09:00:00.000Z', status: 'recorded', title: 'Nota progetto', body: 'Nota', metadata: {}, source: 'project_comment',
      }];
      if (sql.includes('FROM "doflow".tasks t')) return [{
        id: 'task:c', company_id: COMPANY_ID, project_id: PROJECT_ID, type: 'activity', channel: 'project',
        author_label: 'Operatore', created_at: '2026-08-17T08:00:00.000Z', status: 'ready', title: 'Task', metadata: {}, source: 'project_task',
      }];
      if (sql.includes('audit_log a')) return [];
      return [];
    });
    const { service } = harness({ query });
    const first = await service.list({ record_kind: 'company', record_id: COMPANY_ID, limit: 2 });
    expect(first.items.map((item) => item.type)).toEqual(['call', 'note']);
    expect(first.has_more).toBe(true);
    expect(first.next_cursor).toEqual(expect.any(String));
    const second = await service.list({ record_kind: 'company', record_id: COMPANY_ID, limit: 2, cursor: first.next_cursor });
    expect(second.items.map((item) => item.type)).toEqual(['activity']);
  });

  it('parametrizza target, filtri data, operatore e limita la pagina', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT email FROM')) return [{ email: 'operator@example.test' }];
      if (sql.includes('to_regclass')) return [{ name: null }];
      return [];
    });
    const { service } = harness({ query });
    await service.list({
      record_kind: 'opportunity', record_id: OPPORTUNITY_ID, operator_id: USER_ID,
      date_from: '2026-08-01', date_to: '2026-08-31', outcome: 'answered', types: 'call,email', limit: 999,
    });
    const activity = query.mock.calls.find(([sql]) => String(sql).includes('commercial_activities a')) as any[] | undefined;
    expect(activity).toBeDefined();
    expect(activity![0]).toContain('a.opportunity_id = $1');
    expect(activity![0]).toContain('a.created_by = $');
    expect(activity![0]).toContain('= ANY($');
    expect(activity![0]).toContain('COALESCE(a.outcome, a.status) = $');
    expect(activity![1][0]).toBe(OPPORTUNITY_ID);
    expect(activity![1]).toContainEqual(['call', 'email']);
    expect(activity![1]).toContain('answered');
    expect(activity![1].at(-1)).toBeLessThanOrEqual(204);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('project_comments pc'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM "doflow".tasks t'))).toBe(false);
  });

  it('rende commenti e task progetto visibili nella timeline cliente collegata', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ name: null }];
      return [];
    });
    await harness({ query }).service.list({ record_kind: 'company', record_id: COMPANY_ID });
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('p.company_id = $1');
    expect(sql).toContain('project_comments pc');
    expect(sql).toContain('FROM "doflow".tasks t');
  });

  it('include i pagamenti collegati via fattura nella timeline opportunità', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('to_regclass') && String(params?.[0] || '').includes('payments')) return [{ name: 'doflow.payments' }];
      if (sql.includes('to_regclass')) return [{ name: null }];
      return [];
    });
    await harness({ query }).service.list({ record_kind: 'opportunity', record_id: OPPORTUNITY_ID });
    const paymentSql = query.mock.calls.find(([sql]) => String(sql).includes('FROM "doflow".payments WHERE'))?.[0];
    expect(paymentSql).toContain('FROM "doflow".invoices i');
    expect(paymentSql).toContain('i.opportunity_id = $1');
  });

  it('esclude eventi finance e relativi target senza capability finance', async () => {
    const readOnly = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ name: null }];
      return [];
    });
    await harness({ query, access: access({ finance: readOnly }) }).service.list({ record_kind: 'company', record_id: COMPANY_ID });
    const audit = query.mock.calls.find(([sql]) => String(sql).includes('audit_log a')) as any[] | undefined;
    expect(audit).toBeDefined();
    expect(audit![1][1].some((action: string) => action.startsWith('finance_'))).toBe(false);
    expect(audit![1][1]).toEqual(expect.arrayContaining([
      'commercial_lead_created',
      'commercial_activity_reordered',
      'commercial_attribution_changed',
    ]));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM "doflow".invoices'))).toBe(false);
  });

  it('mappa audit di stato e rimuove metadata economici senza permesso finance', async () => {
    const noFinance = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ name: null }];
      if (sql.includes('audit_log a')) return [{
        id: 'audit:1', action: 'crm_opportunity_stage_changed', actor_email: 'operator@example.test',
        created_at: '2026-08-17T11:00:00.000Z', metadata: { previous_stage: 'quote', new_stage: 'closed_won', total: 9999 },
      }];
      return [];
    });
    const result = await harness({ query, access: access({ finance: noFinance }) }).service
      .list({ record_kind: 'opportunity', record_id: OPPORTUNITY_ID, types: 'status_change' });
    expect(result.items[0]).toEqual(expect.objectContaining({
      type: 'status_change', status: 'closed_won', title: 'Fase commerciale aggiornata', source: 'audit_log',
    }));
    expect(result.items[0].metadata).toEqual({ previous_stage: 'quote', new_stage: 'closed_won' });
  });

  it('mappa materiali come attività singole e file con azione specifica', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('to_regclass') && String(params?.[0] || '').includes('document_activity')) return [{ name: 'doflow.document_activity' }];
      if (sql.includes('to_regclass')) return [{ name: null }];
      if (sql.includes('audit_log a')) return [{
        id: 'audit:material', action: 'material_requested', actor_email: 'operator@example.test',
        created_at: '2026-08-17T11:00:00.000Z', metadata: { title: 'Logo vettoriale', status: 'requested' },
      }];
      if (sql.includes('document_activity a')) return [{
        id: 'document:version', actor_user_id: USER_ID, author_label: 'Operatore',
        created_at: '2026-08-17T10:00:00.000Z', action: 'version_created', metadata: {},
      }];
      return [];
    });
    const result = await harness({ query }).service.list({ record_kind: 'company', record_id: COMPANY_ID });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'activity', title: 'Materiale richiesto', source: 'audit_log' }),
      expect.objectContaining({ type: 'file', title: 'Nuova versione file', source: 'document_activity' }),
    ]));
  });

  it.each([
    ['note', 'createNote', { body: 'Nota interna' }, 'recorded'],
    ['activity', 'createActivity', { title: 'Follow-up', due_at: '2026-08-20T10:00:00Z', priority: 'high' }, 'pending'],
    ['appointment', 'createAppointment', { title: 'Riunione', due_at: '2026-08-20T10:00:00Z' }, 'scheduled'],
  ])('crea %s come singolo evento immutabile', async (_label, method, payload, expectedStatus) => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO "doflow".commercial_activities')) return [{
        id: OPPORTUNITY_ID, company_id: COMPANY_ID, type: method === 'createNote' ? 'note' : method === 'createActivity' ? 'activity' : 'appointment',
        title: 'Evento', created_by: USER_ID, created_at: new Date().toISOString(), status: expectedStatus, metadata: {},
      }];
      return [];
    });
    const service: any = harness({ query }).service;
    const event = await service[method]({ record_kind: 'company', record_id: COMPANY_ID, ...payload });
    expect(event.status).toBe(expectedStatus);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'))).toHaveLength(1);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('audit_log'))).toBe(false);
  });

  it('registra la chiamata soltanto dopo conferma manuale e con esito reale', async () => {
    const { service } = harness();
    await expect(service.createCall({ record_kind: 'company', record_id: COMPANY_ID, number: '+3902', outcome: 'answered' }))
      .rejects.toThrow('Conferma manuale');
    await expect(service.createCall({ record_kind: 'company', record_id: COMPANY_ID, number: '+3902', outcome: 'delivered', confirmed: true }))
      .rejects.toThrow('Esito chiamata non valido');
  });

  it('conferma manualmente email/WhatsApp senza delivery o read fittizi', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO "doflow".commercial_activities')) return [{
        id: OPPORTUNITY_ID, company_id: COMPANY_ID, type: params[11], channel: params[11], direction: 'outbound',
        title: 'Messaggio', description: 'Testo', created_by: USER_ID, created_at: new Date().toISOString(),
        status: params[13], outcome: params[14], metadata: JSON.parse(String(params[15])),
      }];
      return [];
    });
    const { service } = harness({ query });
    await expect(service.createExternalMessage({ record_kind: 'company', record_id: COMPANY_ID, channel: 'whatsapp', destination: '+3902', body: 'Testo' }))
      .rejects.toThrow('Conferma manuale');
    const event = await service.createExternalMessage({ record_kind: 'company', record_id: COMPANY_ID, channel: 'whatsapp', destination: '+3902', body: 'Testo', confirmed: true });
    expect(event.status).toBe('manually_confirmed');
    expect(event.metadata).toEqual(expect.objectContaining({ confirmation: 'manual', provider_delivery: false }));
    expect(JSON.stringify(event)).not.toMatch(/delivered|read/);
  });

  it('rifiuta cursor, intervalli e tipi non validi', async () => {
    const { service } = harness();
    await expect(service.list({ record_kind: 'company', record_id: COMPANY_ID, cursor: 'broken' })).rejects.toThrow('cursor');
    await expect(service.list({ record_kind: 'company', record_id: COMPANY_ID, date_from: '2026-09-01', date_to: '2026-08-01' })).rejects.toThrow('Intervallo');
    await expect(service.list({ record_kind: 'company', record_id: COMPANY_ID, types: 'unknown' })).rejects.toThrow('types');
  });

  it('aggrega la timeline globale progetti in una sola query parametrizzata e tenant-scoped', async () => {
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('to_regclass')) return [{ name: null }];
      if (sql.includes('COUNT(*) OVER()')) return [{
        id: 'task:event', project_id: PROJECT_ID, project_name: 'Progetto Demo', company_name: 'Cliente Demo',
        project_status: 'client_review', project_manager_id: USER_ID, type: 'activity', author_user_id: USER_ID,
        author_label: 'Operatore', created_at: '2026-08-17T10:00:00.000Z', title: 'Verifica', status: 'ready', source: 'project_task', total: 1,
      }];
      return [];
    });
    const { service } = harness({ query });
    const result = await service.listProjects({ project_id: PROJECT_ID, operator_id: USER_ID, stage: 'client_review', types: 'activity', date_from: '2026-08-01', date_to: '2026-08-31' });
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ project_status: 'client_review', author_label: 'Operatore' }));
    const aggregate = query.mock.calls.find(([sql]) => String(sql).includes('COUNT(*) OVER()'));
    expect(aggregate).toBeDefined();
    expect(aggregate?.[1]).toEqual(expect.arrayContaining([PROJECT_ID, USER_ID, ['activity']]));
    expect(String(aggregate?.[0])).toContain('UNION ALL');
    expect(String(aggregate?.[0])).toContain('project_members');
  });
});
