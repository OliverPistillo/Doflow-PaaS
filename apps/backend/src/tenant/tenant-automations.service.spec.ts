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

  it('gestisce una rule appena creata con UUID valido su get/enable/disable/run/export', async () => {
    const ruleId = '4f52eac3-aee6-4d27-ab51-48632ca2df2a';
    const storedRule: Record<string, any> = {
      id: ruleId,
      template_id: null,
      name: 'Manual noop',
      description: null,
      category: 'general',
      trigger_type: 'manual_run',
      trigger_config: {},
      conditions: null,
      actions: [{ type: 'noop' }],
      schedule_config: null,
      is_enabled: false,
      run_mode: 'manual',
      priority: 'medium',
      cooldown_minutes: 60,
      max_runs_per_day: 50,
      created_by: '11111111-1111-4111-8111-111111111111',
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ');
      if (compact.includes('INSERT INTO "doflow".automation_rules') && compact.includes('RETURNING *')) {
        return [storedRule];
      }
      if (compact.includes('SELECT id, template_id, name') && compact.includes('FROM "doflow".automation_rules') && compact.includes('WHERE id = $1')) {
        expect(params[0]).toBe(ruleId);
        return [storedRule];
      }
      if (compact.includes('UPDATE "doflow".automation_rules SET is_enabled')) {
        storedRule.is_enabled = params[1];
        return [{ ...storedRule }];
      }
      if (compact.includes('INSERT INTO "doflow".automation_activity')) return [];
      return [];
    });
    const service = new TenantAutomationsService(
      { query } as any,
      { createNotification: jest.fn().mockResolvedValue({ created: true }) } as any,
      { user: { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'runRule').mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333', status: 'success' });

    const created = await service.createRule({ name: 'Manual noop', trigger_type: 'manual_run', actions: [{ type: 'noop' }] });
    expect(created.id).toBe(ruleId);
    await expect(service.getRule(ruleId)).resolves.toMatchObject({ id: ruleId });
    await expect(service.setEnabled(ruleId, true)).resolves.toMatchObject({ id: ruleId, is_enabled: true });
    await expect(service.setEnabled(ruleId, false)).resolves.toMatchObject({ id: ruleId, is_enabled: false });
    await expect(service.runRuleFromRequest(ruleId, {})).resolves.toMatchObject({ status: 'success' });
    await expect(service.exportRule(ruleId)).resolves.toMatchObject({ rule: expect.objectContaining({ id: ruleId }) });
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
