import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CompleteBackendContracts1860000000000 } from '../migrations/1860000000000-CompleteBackendContracts';
import { TenantBackendContractsService } from './tenant-backend-contracts.service';

describe('backend contract completion v186', () => {
  it('provisions typed tenant tables additively without plaintext secrets or destructive SQL', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes('FROM public.tenants')) return [{ schema_name: 'tenant_contract_a' }, { schema_name: 'tenant_contract_b' }];
        return [];
      }),
    };
    const migration = new CompleteBackendContracts1860000000000();
    await migration.up(runner as never);
    const ddl = statements.join('\n').toLowerCase();
    expect(migration.name).toBe('CompleteBackendContracts1860000000000');
    for (const table of [
      'calendar_integration_preferences', 'calendar_integration_events',
      'company_intelligence_report_shares', 'company_intelligence_competitors', 'company_intelligence_exports',
      'customer_inbox_conversations', 'customer_inbox_user_state', 'customer_inbox_drafts', 'customer_inbox_receipts',
      'commerce_settings', 'commerce_settings_audit', 'customer_care_settings',
      'customer_finance_snapshots', 'customer_finance_audit', 'customer_document_metadata',
      'guided_calls', 'guided_call_messages', 'guided_call_audit',
      'team_duties', 'team_duty_versions', 'team_duty_reads',
    ]) {
      expect(ddl).toContain(table);
    }
    for (const index of [
      'idx_calendar_integration_events_active', 'idx_flowboards_project', 'idx_flowboards_template',
      'uq_commercial_communications_idempotency', 'idx_customer_document_metadata_company',
      'uq_guided_calls_active_lead',
    ]) expect(ddl).toContain(index);
    expect(ddl).toContain("check (permission in ('view','edit'))");
    expect(ddl).toContain("check (visibility in ('internal','shared'))");
    expect(ddl).toContain("check (status in ('prepared','external_opened','manually_confirmed','not_sent','sent','replied','no_reply','follow_up'))");
    expect(ddl).toContain('ics_token_hash');
    expect(ddl).toContain('alter table if exists "tenant_contract_a".order_items add column if not exists archived_at timestamptz');
    expect(ddl).not.toMatch(/oauth[_ ]?(access|refresh)?[_ ]?token\s+text/);
    expect(statements.filter((statement) => !statement.includes('FROM public.tenants')).every((statement) => /^\s*(create|alter)\b/i.test(statement))).toBe(true);
    expect(ddl).not.toContain('tenant_settings');
    expect(ddl).toContain('"tenant_contract_a"');
    expect(ddl).toContain('"tenant_contract_b"');
    await expect(migration.down(runner as never)).resolves.toBeUndefined();
  });

  it('replays empty and populated synthetic tenant bootstrap idempotently', async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes('FROM public.tenants')) {
          return [{ schema_name: 'tenant_contract_empty' }, { schema_name: 'tenant_contract_populated' }];
        }
        return [];
      }),
    };
    const migration = new CompleteBackendContracts1860000000000();
    await migration.up(runner as never);
    const ddlCountAfterFirstApply = statements.filter((statement) => !statement.includes('FROM public.tenants')).length;
    expect(ddlCountAfterFirstApply).toBeGreaterThan(0);
    expect(statements.join('\n')).toContain('"tenant_contract_empty"');
    expect(statements.join('\n')).toContain('"tenant_contract_populated"');
    for (const statement of statements.filter((value) => !value.includes('FROM public.tenants'))) {
      expect(statement).toMatch(/^\s*(?:CREATE (?:UNIQUE )?(?:EXTENSION|TABLE|INDEX) IF NOT EXISTS|ALTER TABLE [\s\S]+ ADD COLUMN IF NOT EXISTS)/i);
    }

    await migration.up(runner as never);
    expect(statements.filter((statement) => !statement.includes('FROM public.tenants'))).toHaveLength(ddlCountAfterFirstApply);
    expect(statements.filter((statement) => statement.includes('FROM public.tenants'))).toHaveLength(2);
  });

  it('rejects an unsafe registry schema before interpolating it', async () => {
    const runner = { query: jest.fn(async (sql: string) => sql.includes('FROM public.tenants') ? [{ schema_name: 'bad-schema:semicolon' }] : []) };
    await expect(new CompleteBackendContracts1860000000000().up(runner as never)).rejects.toThrow();
    expect(runner.query).toHaveBeenCalledTimes(1);
  });

  it.each(['no-auth', 'suspended', 'read-only'])('denies %s before executing tenant SQL', async () => {
    const dataSource = { query: jest.fn(), transaction: jest.fn() };
    const access = { current: jest.fn(async () => { throw new ForbiddenException('denied'); }), require: jest.fn(), has: jest.fn() };
    const service = new TenantBackendContractsService(dataSource as never, access as never, {});
    await expect(service.commerceSettings()).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('uses only the authenticated schema and actor for calendar preference reads', async () => {
    const sql: string[] = [];
    const dataSource = {
      query: jest.fn(async (statement: string) => {
        sql.push(statement);
        if (statement.includes('calendar_integration_preferences') && statement.includes('SELECT enabled_categories')) return [];
        return [];
      }),
      transaction: jest.fn(),
    };
    const access = {
      current: jest.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111', email: 'a@example.test', role: 'owner', schema: 'tenant_contract_a', capabilities: new Set(['*']) })),
      require: jest.fn(),
      has: jest.fn(() => true),
    };
    const service = new TenantBackendContractsService(dataSource as never, access as never, {});
    await service.calendarIntegrations();
    expect(access.require).toHaveBeenCalled();
    expect(sql.join('\n')).toContain('"tenant_contract_a"');
    expect(sql.join('\n')).not.toContain('tenant_contract_b');
    const readCall = (dataSource.query as jest.Mock).mock.calls.find(([statement]) => String(statement).includes('SELECT enabled_categories'));
    expect(readCall?.[1]).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('resolves an ICS bearer token without exposing it or another tenant records', async () => {
    const rawToken = 'a'.repeat(43);
    const sql: Array<{ statement: string; parameters?: unknown[] }> = [];
    const dataSource = {
      query: jest.fn(async (statement: string, parameters?: unknown[]) => {
        sql.push({ statement, parameters });
        if (statement.includes('FROM public.tenants')) return [{ schema_name: 'tenant_contract_a' }, { schema_name: 'tenant_contract_b' }];
        if (statement.includes('"tenant_contract_a".calendar_integration_preferences')) return [];
        if (statement.includes('"tenant_contract_b".calendar_integration_preferences')) return [{ user_id: '22222222-2222-4222-8222-222222222222', enabled_categories: ['activity'] }];
        if (statement.includes('"tenant_contract_b".calendar_integration_events')) return [{ event_key: 'activity:1', title: 'Follow-up', starts_at: '2026-08-28T09:00:00.000Z', ends_at: null, category: 'activity', status: 'Da fare', description: 'Tenant B' }];
        return [];
      }),
      transaction: jest.fn(),
    };
    const service = new TenantBackendContractsService(dataSource as never, {} as never, {});
    const feed = await service.calendarFeed(rawToken);
    expect(feed).toContain('BEGIN:VCALENDAR');
    expect(feed).toContain('SUMMARY:Follow-up');
    expect(feed).not.toContain(rawToken);
    expect(sql.some(({ statement }) => statement.includes('"tenant_contract_a".calendar_integration_events'))).toBe(false);
    expect(sql.filter(({ statement }) => statement.includes('calendar_integration_preferences')).every(({ parameters }) => parameters?.[0] !== rawToken)).toBe(true);
  });

  it('enforces separation of duties when a Team Duty is approved', async () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const dutyId = '22222222-2222-4222-8222-222222222222';
    const dataSource: any = {
      query: jest.fn(async (statement: string) => statement.includes('SELECT d.*,v.content,v.author_user_id')
        ? [{ id: dutyId, current_version: 1, content: { status: 'Bozza' }, author_user_id: actorId }]
        : []),
    };
    dataSource.transaction = jest.fn(async (operation: (manager: unknown) => unknown) => operation(dataSource));
    const access = {
      current: jest.fn(async () => ({ id: actorId, email: 'author@example.test', role: 'owner', schema: 'tenant_contract_a', capabilities: new Set(['*']) })),
      require: jest.fn(),
    };
    const service = new TenantBackendContractsService(dataSource, access as never, {});
    await expect(service.approveTeamDuty(dutyId, { optimisticVersion: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE "tenant_contract_a".team_duties'), expect.anything());
  });
});
