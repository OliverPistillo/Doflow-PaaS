import { BadRequestException } from '@nestjs/common';
import { seedTenantAutomationTemplatesAndRules } from './tenant-automations-schema';
import { TenantAutomationsService } from './tenant-automations.service';

describe('TenantAutomationsService', () => {
  function makeService(role = 'owner') {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantAutomationsService(
      { query } as any,
      { createNotification: jest.fn().mockResolvedValue({ created: true }) } as any,
      { user: { sub: '11111111-1111-4111-8111-111111111111', role, tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    return { service, query };
  }

  it('options ritorna allowlist trigger/conditions/actions', async () => {
    const { service } = makeService();

    const options = await service.options();

    expect(options.triggers).toContain('task_overdue');
    expect(options.conditions).toContain('older_than_days');
    expect(options.actions).toContain('create_notification');
    expect(options.actions).not.toContain('send_email');
  });

  it('rifiuta azioni non allowlist quando crea una rule', async () => {
    const { service } = makeService();

    await expect(service.createRule({
      name: 'Custom unsafe',
      trigger_type: 'manual_run',
      actions: [{ type: 'send_email' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manager non vede rules finance nella lista', async () => {
    const { service, query } = makeService('manager');
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await service.listRules({});

    expect(query.mock.calls[0][0]).toContain("category <> 'finance'");
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.arrayContaining(['invoice_overdue'])]));
  });
});

describe('seedTenantAutomationTemplatesAndRules', () => {
  it('seeda template e rule base in modo idempotente', async () => {
    const templates = new Map<string, string>();
    const rules = new Set<string>();
    let counter = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ');
      if (compact.includes('INSERT INTO "doflow".automation_templates')) {
        counter += 1;
        const id = templates.get(String(params[0])) || `11111111-1111-4111-8111-${String(counter).padStart(12, '0')}`;
        templates.set(String(params[0]), id);
        return [{ id }];
      }
      if (compact.includes('SELECT id FROM "doflow".automation_rules')) {
        const id = String(params[0]);
        return rules.has(id) ? [{ id: `22222222-2222-4222-8222-${id.slice(-12)}` }] : [];
      }
      if (compact.includes('INSERT INTO "doflow".automation_rules')) {
        rules.add(String(params[0]));
        return [];
      }
      return [];
    });

    await seedTenantAutomationTemplatesAndRules({ query } as any, 'doflow');
    const firstTemplateCount = templates.size;
    const firstRuleCount = rules.size;
    await seedTenantAutomationTemplatesAndRules({ query } as any, 'doflow');

    expect(firstTemplateCount).toBeGreaterThanOrEqual(15);
    expect(templates.size).toBe(firstTemplateCount);
    expect(rules.size).toBe(firstRuleCount);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DROP TABLE'))).toBe(false);
  });
});
