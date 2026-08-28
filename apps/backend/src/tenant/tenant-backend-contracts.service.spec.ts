import { DataSource } from 'typeorm';
import { TenantCommercialAccessService } from './tenant-commercial-access.service';
import {
  DEFAULT_INBOX_STATE_FILTERS,
  normalizeInboxStateFilters,
  TenantBackendContractsService,
} from './tenant-backend-contracts.service';

jest.mock('./tenant-universal-features-schema', () => ({
  ensureTenantUniversalFeatureTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./tenant-backend-contracts-schema', () => ({
  ensureTenantBackendContractTables: jest.fn().mockResolvedValue(undefined),
}));

describe('TenantBackendContractsService Inbox state contract', () => {
  const actor = {
    id: '00000000-0000-4000-8000-000000000001',
    schema: 'doflow',
    capabilities: new Set<string>(),
  };

  function serviceWithFilters(filters: unknown[]) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('customer_inbox_user_state')) return filters;
      if (sql.includes('customer_inbox_conversations')) return [];
      if (sql.includes('customer_inbox_drafts')) return [];
      if (sql.includes('customer_inbox_receipts')) return [];
      throw new Error(`Unexpected query: ${sql}`);
    });
    const access = {
      current: jest.fn().mockResolvedValue(actor),
      require: jest.fn(),
    };
    const service = new TenantBackendContractsService(
      { query } as unknown as DataSource,
      access as unknown as TenantCommercialAccessService,
      {},
    );
    return { access, query, service };
  }

  it('returns the complete default filter contract when production has no user-state row', async () => {
    const { access, service } = serviceWithFilters([]);

    await expect(service.inboxState()).resolves.toEqual({
      conversations: [],
      drafts: [],
      receipts: [],
      filters: DEFAULT_INBOX_STATE_FILTERS,
      adapters: {
        email: { outboundConfigured: false, inboundConfigured: false, lastSuccessfulSync: null, errorCode: null },
        whatsapp: { mode: 'web_handoff' },
      },
    });
    expect(access.require).toHaveBeenCalledWith(actor, 'canReadNotifications');
  });

  it('merges partial persisted state with safe defaults', async () => {
    const { service } = serviceWithFilters([{
      filters: { search: 'lead', status: 'Risolta', unreadOnly: true },
    }]);

    await expect(service.inboxState()).resolves.toMatchObject({
      filters: {
        search: 'lead',
        status: 'Risolta',
        priority: 'all',
        channel: 'all',
        scope: 'all',
        unreadOnly: true,
      },
    });
  });

  it('normalizes invalid or non-object persisted values without leaking extra keys', () => {
    expect(normalizeInboxStateFilters({
      search: null,
      status: 'unsupported',
      priority: 42,
      channel: 'fax',
      scope: 'global',
      unreadOnly: 'yes',
      injected: 'ignored',
    })).toEqual(DEFAULT_INBOX_STATE_FILTERS);
    expect(normalizeInboxStateFilters(null)).toEqual(DEFAULT_INBOX_STATE_FILTERS);
  });

  it('persists conversation receipts with a tenant user composite key', async () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM "doflow".companies')) return [{ id: companyId }];
      if (sql.includes('customer_inbox_receipts')) return [{ company_id: companyId, user_id: actor.id }];
      throw new Error(`Unexpected query: ${sql}`);
    });
    const access = { current: jest.fn().mockResolvedValue(actor), require: jest.fn() };
    const service = new TenantBackendContractsService({ query } as unknown as DataSource, access as unknown as TenantCommercialAccessService, {});

    await expect(service.markInboxRead(companyId)).resolves.toMatchObject({ company_id: companyId, user_id: actor.id });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('(company_id,user_id)'), [companyId, actor.id]);
    expect(access.require).toHaveBeenCalledWith(actor, 'canReadNotifications');
  });
});
