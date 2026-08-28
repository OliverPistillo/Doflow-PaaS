import { ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TenantCommercialCoreService } from './tenant-commercial-core.service';

jest.mock('./tenant-crm-schema', () => ({
  ensureTenantCrmCoreTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./tenant-timeline-schema', () => ({
  ensureDoflowTimelineSchema: jest.fn().mockResolvedValue(undefined),
}));

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'commerciale@example.test',
  role: 'user',
  schema: 'doflow',
  capabilities: new Set([
    'canViewAssignedLeads',
    'canCreateLeads',
    'canEditAssignedLead',
    'canEditCustomers',
    'canInspectDuplicates',
    'canMergeDuplicates',
    'canManageArchive',
    'canViewCampaigns',
  ]),
};

function access(overrides: Partial<typeof actor> = {}) {
  const currentActor = { ...actor, ...overrides };
  return {
    current: jest.fn().mockResolvedValue(currentActor),
    has: jest.fn((candidate: typeof actor, capability: string) =>
      candidate.capabilities.has('*') || candidate.capabilities.has(capability),
    ),
    require: jest.fn((candidate: typeof actor, ...capabilities: string[]) => {
      if (!capabilities.some((capability) => candidate.capabilities.has('*') || candidate.capabilities.has(capability))) {
        throw new ForbiddenException('Capability commerciale richiesta');
      }
    }),
  };
}

function transactionalDataSource(query: jest.Mock) {
  const manager = { query };
  return {
    query,
    transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)),
  };
}

describe('TenantCommercialCoreService', () => {
  it('crea lead, azienda e contatto in una sola transazione idempotente', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';
    const contactId = '44444444-4444-4444-8444-444444444444';
    const leadId = '55555555-5555-4555-8555-555555555555';
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow".companies') && sql.includes('FOR UPDATE')) return [];
      if (sql.includes('INSERT INTO "doflow".companies')) return [{ id: companyId, name: 'Azienda API' }];
      if (sql.includes('FROM "doflow".contacts') && sql.includes('FOR UPDATE')) return [];
      if (sql.includes('SELECT 1 FROM "doflow".contacts')) return [];
      if (sql.includes('INSERT INTO "doflow".contacts')) return [{ id: contactId, first_name: 'Mario', last_name: 'Rossi', email: 'mario@example.test' }];
      if (sql.includes('INSERT INTO "doflow".leads')) return [{ id: leadId, title: 'Nuova opportunità' }];
      if (sql.includes('INSERT INTO "doflow".opportunities')) return [{ id: opportunityId, title: 'Nuova opportunità', version: 1, stage: 'new', ui_stage: 'new' }];
      return [];
    });
    const ds = transactionalDataSource(query);
    const service = new TenantCommercialCoreService(ds as any, access() as any);
    const result = await service.createLead({
      companyName: 'Azienda API',
      title: 'Nuova opportunità',
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'MARIO@example.test',
      assignedTo: actor.id,
      stage: 'new',
    }, 'lead:create:0001');

    expect(result.item).toEqual(expect.objectContaining({ id: opportunityId, company_name: 'Azienda API' }));
    expect(ds.transaction).toHaveBeenCalledTimes(1);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.filter((sql) => sql.includes('INSERT INTO "doflow".companies'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO "doflow".contacts'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO "doflow".leads'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO "doflow".opportunities'))).toHaveLength(1);
    expect(query.mock.calls.find(([sql]) => String(sql).includes('commercial_outbox'))?.[1]?.[2])
      .toBe('commercial_lead_created');
  });

  it('esegue una transizione assegnata con concurrency, audit, history e outbox una sola volta', async () => {
    const opportunity = {
      id: '22222222-2222-4222-8222-222222222222',
      stage: 'new',
      ui_stage: 'new',
      assigned_to: actor.id,
      version: 3,
    };
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM "doflow".commercial_idempotency')) return [];
      if (sql.includes('FROM "doflow".opportunities') && sql.includes('FOR UPDATE')) return [opportunity];
      if (sql.includes('UPDATE "doflow".opportunities')) return [[{ ...opportunity, stage: 'quote', ui_stage: 'proposal', version: 4 }], 1];
      return [];
    });
    const ds = transactionalDataSource(query);
    const service = new TenantCommercialCoreService(ds as any, access() as any);

    const result = await service.transitionOpportunity(
      opportunity.id,
      { stage: 'proposal', version: 3, reason: 'Preventivo pronto' },
      'transition:test:0001',
    );

    expect(result.item).toEqual(expect.objectContaining({ stage: 'quote', ui_stage: 'proposal', version: 4 }));
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.filter((sql) => sql.includes('commercial_history'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('audit_log'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('commercial_outbox'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('SET status = \'completed\''))).toHaveLength(1);
    const updateCall = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE "doflow".opportunities'));
    expect(updateCall?.[1]).toEqual(['quote', 'proposal', actor.id, opportunity.id, 3]);
  });

  it.each(['proposal', 'negotiation'])(
    'riordina la colonna UI %s usando la fase canonica quote senza perdere la partizione visuale',
    async (uiStage) => {
      const opportunityId = '22222222-2222-4222-8222-222222222222';
      const query = jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
        if (sql.includes('FROM "doflow".opportunities') && sql.includes('FOR UPDATE')) {
          return [{
            id: opportunityId,
            stage: 'quote',
            ui_stage: uiStage,
            assigned_to: actor.id,
            version: 3,
            pipeline_order: 9,
          }];
        }
        return [];
      });
      const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);

      await expect(service.reorderPipeline(
        { stage: uiStage, leadIds: [opportunityId] },
        `pipeline:reorder:${uiStage}`,
      )).resolves.toEqual(expect.objectContaining({
        ok: true,
        stage: 'quote',
        leadIds: [opportunityId],
      }));

      const selectCall = query.mock.calls.find(([sql]) => String(sql).includes('FROM "doflow".opportunities'));
      expect(String(selectCall?.[0])).toContain('ui_stage');
      const historyCall = query.mock.calls.find(([sql]) => String(sql).includes('commercial_history'));
      expect(JSON.parse(String(historyCall?.[1]?.[8]))).toEqual(expect.objectContaining({
        stage: 'quote',
        ui_stage: uiStage,
      }));
    },
  );

  it('rifiuta un riordino che mescola due colonne UI sulla stessa fase canonica', async () => {
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow".opportunities') && sql.includes('FOR UPDATE')) {
        return [{
          id: opportunityId,
          stage: 'quote',
          ui_stage: 'proposal',
          assigned_to: actor.id,
          version: 3,
          pipeline_order: 1,
        }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);

    await expect(service.reorderPipeline(
      { stage: 'negotiation', leadIds: [opportunityId] },
      'pipeline:reorder:mixed-ui-stage',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SET pipeline_order'))).toBe(false);
  });

  it('riordina e completa ui_stage per un record canonico preesistente', async () => {
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow".opportunities') && sql.includes('FOR UPDATE')) {
        return [{
          id: opportunityId,
          stage: 'quote',
          ui_stage: null,
          assigned_to: actor.id,
          version: 3,
          pipeline_order: 1,
        }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);

    await expect(service.reorderPipeline(
      { stage: 'proposal', leadIds: [opportunityId] },
      'pipeline:reorder:legacy-null-ui-stage',
    )).resolves.toEqual(expect.objectContaining({ ok: true, stage: 'quote' }));
    const updateCall = query.mock.calls.find(([sql]) => String(sql).includes('SET pipeline_order'));
    expect(String(updateCall?.[0])).toContain('ui_stage = COALESCE(ui_stage, $2)');
    expect(updateCall?.[1]).toEqual([1, 'proposal', actor.id, opportunityId]);
  });

  it('restituisce un conflitto controllato quando la versione è cambiata', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('opportunities') && sql.includes('FOR UPDATE')) {
        return [{ id: '22222222-2222-4222-8222-222222222222', stage: 'new', assigned_to: actor.id, version: 5 }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    await expect(service.transitionOpportunity(
      '22222222-2222-4222-8222-222222222222',
      { stage: 'qualified', version: 4 },
      'transition:test:0002',
    )).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('commercial_history'))).toBe(false);
  });

  it('riusa la risposta persistita per la stessa Idempotency-Key senza ripetere la mutazione', async () => {
    const response = { status: 'existing', clientId: '33333333-3333-4333-8333-333333333333' };
    const request = {
      id: '22222222-2222-4222-8222-222222222222',
      expectedVersion: 2,
      existingCompanyId: null,
      createOnboardingActivity: true,
    };
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) {
        return [{ request_hash: hash, status: 'completed', response }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    await expect(service.convertOpportunity(request.id, { version: 2, createOnboardingActivity: true }, 'convert:test:0001'))
      .resolves.toEqual(response);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('blocca solo la riga opportunità durante la conversione con join opzionali', async () => {
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const companyId = '33333333-3333-4333-8333-333333333333';
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow".opportunities')) {
        return [{
          id: opportunityId,
          assigned_to: actor.id,
          version: 2,
          converted_company_id: companyId,
        }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);

    await expect(service.convertOpportunity(
      opportunityId,
      { version: 2, createOnboardingActivity: true },
      'convert:lock-scope:0001',
    )).resolves.toEqual(expect.objectContaining({ status: 'existing', clientId: companyId }));

    const lockQuery = query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('FROM "doflow".opportunities'));
    expect(lockQuery).toContain('FOR UPDATE OF o');
  });

  it('riusa il risultato persistito di una fusione idempotente senza trasferire due volte i riferimenti', async () => {
    const request = {
      primaryId: '33333333-3333-4333-8333-333333333333',
      secondaryId: '44444444-4444-4444-8444-444444444444',
      primaryVersion: 2,
      secondaryVersion: 3,
      fields: {},
    };
    const response = { ok: true, primaryId: request.primaryId, secondaryId: request.secondaryId, recordType: 'companies' };
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) {
        return [{ request_hash: hash, status: 'completed', response }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);

    await expect(service.mergeDuplicates(request, 'merge:idempotent:0001')).resolves.toEqual(response);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('fonde record omogenei in transazione, trasferisce riferimenti e archivia senza DELETE fisico', async () => {
    const primaryId = '33333333-3333-4333-8333-333333333333';
    const secondaryId = '44444444-4444-4444-8444-444444444444';
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow"."companies"') && sql.includes('FOR UPDATE')) {
        const id = params?.[0];
        return [{ id, name: id === primaryId ? 'Principale' : 'Secondaria', version: id === primaryId ? 2 : 4, deleted_at: null, merged_into_id: null }];
      }
      if (sql.includes('information_schema.columns')) return [{ '?column?': 1 }];
      if (sql.includes('archive_reason = \'Fusione duplicati\'')) return [{ id: secondaryId, version: 5, merged_into_id: primaryId }];
      if (sql.includes('UPDATE "doflow"."companies"') && sql.includes('RETURNING *')) return [{ id: primaryId, version: 4 }];
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    const result = await service.mergeDuplicates({
      primaryId,
      secondaryId,
      primaryVersion: 2,
      secondaryVersion: 4,
      fields: { company: 'Società canonica' },
    }, 'merge:test:0001');

    expect(result).toEqual(expect.objectContaining({ ok: true, primaryId, secondaryId, recordType: 'companies' }));
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('merged_into_id = $1');
    expect(sql).toContain('commercial_duplicate_decisions');
    expect(sql).not.toMatch(/DELETE\s+FROM\s+"doflow"\."companies"/i);
    expect(sql).toContain('commercial_history');
  });

  it('nega merge senza capability backend prima di leggere i record', async () => {
    const denied = access({ capabilities: new Set(['canInspectDuplicates']) });
    const query = jest.fn(async (sql: string) => sql.includes('commercial_idempotency') && sql.includes('SELECT') ? [] : []);
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, denied as any);
    await expect(service.mergeDuplicates({
      primaryId: '33333333-3333-4333-8333-333333333333',
      secondaryId: '44444444-4444-4444-8444-444444444444',
      primaryVersion: 1,
      secondaryVersion: 1,
    }, 'merge:test:denied')).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM "doflow"."companies"'))).toBe(false);
  });

  it('impedisce il ripristino indipendente di un record già fuso', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('companies') && sql.includes('deleted_at IS NOT NULL')) {
        return [{ id: '33333333-3333-4333-8333-333333333333', version: 2, merged_into_id: '44444444-4444-4444-8444-444444444444' }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    await expect(service.restore('customer', '33333333-3333-4333-8333-333333333333', { version: 2 }, 'restore:test:0001'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('riordina attività dirette con versioni, rollback transazionale e un solo evento business', async () => {
    const firstId = '55555555-5555-4555-8555-555555555555';
    const secondId = '66666666-6666-4666-8666-666666666666';
    const rows = [
      { id: firstId, status: 'todo', kanban_order: 1000, version: 2, assigned_to: actor.id },
      { id: secondId, status: 'in_progress', kanban_order: 2000, version: 4, assigned_to: actor.id },
    ];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('commercial_activities') && sql.includes('FOR UPDATE')) return rows;
      if (sql.includes('UPDATE "doflow".commercial_activities') && sql.includes('RETURNING')) {
        const id = params?.[2];
        const source = rows.find((row) => row.id === id)!;
        return [{ ...source, status: params?.[0], kanban_order: params?.[1], version: source.version + 1 }];
      }
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    const result = await service.reorderActivities({
      activityId: firstId,
      status: 'completed',
      items: [
        { id: secondId, version: 4, order: 1000 },
        { id: firstId, version: 2, order: 2000 },
      ],
    }, 'activities:reorder:0001');

    expect(result).toEqual(expect.objectContaining({ unchanged: false }));
    expect(result.items).toHaveLength(2);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.filter((sql) => sql.includes('commercial_history'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('commercial_outbox'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('commercial_activity_reordered'))).toHaveLength(0);
    expect(query.mock.calls.find(([sql]) => String(sql).includes('commercial_outbox'))?.[1]?.[2])
      .toBe('commercial_activity_reordered');
  });

  it('salva attribution campagna append-only e incrementa la versione del lead', async () => {
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const campaignId = '77777777-7777-4777-8777-777777777777';
    const opportunity = { id: opportunityId, version: 3, assigned_to: actor.id, company_id: null, contact_id: null, lead_id: null };
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow".opportunities') && sql.includes('FOR UPDATE')) return [opportunity];
      if (sql.includes('FROM "doflow".commercial_attributions')) return [];
      if (sql.includes('FROM "doflow".campaigns')) return [{ id: campaignId, name: 'Campagna reale' }];
      if (sql.includes('INSERT INTO "doflow".commercial_attributions')) return [{ id: '88888888-8888-4888-8888-888888888888', campaign_id: campaignId }];
      if (sql.includes('UPDATE "doflow".opportunities')) return [{ ...opportunity, version: 4 }];
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    const result = await service.updateAttribution(opportunityId, { version: 3, campaignId }, 'attribution:test:0001');

    expect(result.item).toEqual(expect.objectContaining({ version: 4, campaign_id: campaignId }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes("'manual_last_touch'"))).toBe(true);
    expect(query.mock.calls.find(([sql]) => String(sql).includes('commercial_outbox'))?.[1]?.[2])
      .toBe('commercial_attribution_changed');
  });

  it('fonde lead e cliente in una singola transazione senza cancellazione fisica', async () => {
    const companyId = '33333333-3333-4333-8333-333333333333';
    const opportunityId = '22222222-2222-4222-8222-222222222222';
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('commercial_idempotency') && sql.includes('SELECT')) return [];
      if (sql.includes('FROM "doflow"."companies"') && sql.includes('FOR UPDATE')) {
        return params?.[0] === companyId
          ? [{ id: companyId, name: 'Cliente', version: 2, deleted_at: null, merged_into_id: null }]
          : [];
      }
      if (sql.includes('FROM "doflow"."contacts"') && sql.includes('FOR UPDATE')) return [];
      if (sql.includes('FROM "doflow"."opportunities"') && sql.includes('FOR UPDATE')) {
        return [{ id: opportunityId, title: 'Lead', company_id: null, assigned_to: actor.id, version: 5, deleted_at: null, merged_into_id: null }];
      }
      if (sql.includes('archive_reason = \'Fusione duplicati lead-cliente\'') && sql.includes('opportunities')) {
        return [{ id: opportunityId, version: 6, merged_into_id: companyId, deleted_at: new Date().toISOString() }];
      }
      if (sql.includes('UPDATE "doflow".companies') && sql.includes('RETURNING')) return [{ id: companyId, version: 3 }];
      return [];
    });
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, access() as any);
    const result = await service.mergeDuplicates({
      primaryId: companyId,
      secondaryId: opportunityId,
      primaryVersion: 2,
      secondaryVersion: 5,
      fields: { company: 'Cliente canonico' },
    }, 'merge:mixed:0001');

    expect(result).toEqual(expect.objectContaining({ ok: true, recordType: 'lead_client', primaryId: companyId }));
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('Fusione duplicati lead-cliente');
    expect(sql).not.toMatch(/DELETE\s+FROM\s+"doflow"\.(?:companies|opportunities)/i);
  });

  it('nega la conversione a chi non può gestire clienti', async () => {
    const denied = access({ capabilities: new Set(['canEditAssignedLead']) });
    const query = jest.fn(async (sql: string) => sql.includes('commercial_idempotency') && sql.includes('SELECT') ? [] : []);
    const service = new TenantCommercialCoreService(transactionalDataSource(query) as any, denied as any);
    await expect(service.convertOpportunity(
      '22222222-2222-4222-8222-222222222222',
      { version: 1, createOnboardingActivity: false },
      'convert:denied:0001',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM "doflow".opportunities'))).toBe(false);
  });
});
