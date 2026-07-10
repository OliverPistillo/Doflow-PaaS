import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ensureTenantKnowledgeTables, seedTenantKnowledgeBase } from './tenant-knowledge-schema';
import { TenantKnowledgeService } from './tenant-knowledge.service';

describe('TenantKnowledgeService', () => {
  const ownerUser = { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' };
  const managerUser = { sub: '22222222-2222-4222-8222-222222222222', role: 'manager', tenantId: 'doflow' };

  function makeService(user = ownerUser) {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantKnowledgeService({ query } as any, { user });
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    return { service, query };
  }

  it('options ritorna allowlist interne e nessun client portal', () => {
    const { service } = makeService();

    const options = service.options();

    expect(options.article_types).toContain('procedure');
    expect(options.template_types).toContain('launch_checklist');
    expect(options.entity_types).toContain('calendar_event');
  });

  it('rifiuta article_type non consentito', async () => {
    const { service } = makeService();

    await expect(service.createArticle({
      title: 'Procedura unsafe',
      article_type: 'execute_code',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manager non puo creare template finance', async () => {
    const { service } = makeService(managerUser);

    await expect(service.createTemplate({
      name: 'Finance interno',
      template_type: 'generic',
      category: 'finance',
      content: {},
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create article crea versione iniziale e activity', async () => {
    const article = {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Procedura interna',
      slug: 'procedura-interna',
      content: 'Testo',
      content_format: 'markdown',
      status: 'draft',
      visibility: 'team',
    };
    const { service, query } = makeService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO "doflow".knowledge_articles')) return [article];
      return [];
    });

    const created = await service.createArticle({ title: article.title, content: article.content });

    expect(created).toMatchObject({ id: article.id, title: article.title });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('knowledge_article_versions'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('knowledge_activity'))).toBe(true);
  });

  it('preview template sostituisce variabili senza eval', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getTemplate').mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Snippet',
      category: 'sales',
      content: { body: 'Ciao {{client_name}}' },
    } as any);

    const result = await service.previewTemplate('44444444-4444-4444-8444-444444444444', {
      variables: { client_name: 'doflow' },
    });

    expect(result.rendered_preview).toEqual({ body: 'Ciao doflow' });
  });
});

describe('tenant knowledge schema', () => {
  it('bootstrap schema non usa DROP TABLE', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await ensureTenantKnowledgeTables({ query } as any, 'doflow');

    expect(query.mock.calls.some(([sql]) => String(sql).includes('DROP TABLE'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('knowledge_articles'))).toBe(true);
  });

  it('seed base e idempotente', async () => {
    const categories = new Map<string, string>();
    const collections = new Map<string, string>();
    const templates = new Map<string, string>();
    let inserts = 0;
    let updates = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ');
      if (compact.includes('SELECT id FROM "doflow".knowledge_categories')) {
        const id = categories.get(String(params[0]));
        return id ? [{ id }] : [];
      }
      if (compact.includes('SELECT id FROM "doflow".asset_collections')) {
        const id = collections.get(String(params[0]));
        return id ? [{ id }] : [];
      }
      if (compact.includes('SELECT id FROM "doflow".operational_templates')) {
        const id = templates.get(String(params[0]));
        return id ? [{ id }] : [];
      }
      if (compact.includes('INSERT INTO "doflow".knowledge_categories')) {
        inserts += 1;
        categories.set(String(params[1]), `category-${inserts}`);
      }
      if (compact.includes('INSERT INTO "doflow".asset_collections')) {
        inserts += 1;
        collections.set(String(params[1]), `collection-${inserts}`);
      }
      if (compact.includes('INSERT INTO "doflow".operational_templates')) {
        inserts += 1;
        templates.set(String(params[1]), `template-${inserts}`);
      }
      if (compact.includes('UPDATE "doflow".knowledge_categories') || compact.includes('UPDATE "doflow".asset_collections') || compact.includes('UPDATE "doflow".operational_templates')) {
        updates += 1;
      }
      return [];
    });

    await seedTenantKnowledgeBase({ query } as any, 'doflow');
    await seedTenantKnowledgeBase({ query } as any, 'doflow');

    expect(categories.size).toBe(10);
    expect(collections.size).toBe(6);
    expect(templates.size).toBe(8);
    expect(updates).toBe(24);
  });
});
