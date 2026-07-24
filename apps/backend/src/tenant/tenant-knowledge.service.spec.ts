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

  it('patch article cambiando content crea versione 2', async () => {
    const articleId = '33333333-3333-4333-8333-333333333333';
    const current = {
      id: articleId,
      title: 'Procedura interna',
      slug: 'procedura-interna',
      content: 'Testo',
      content_format: 'markdown',
      article_type: 'article',
      status: 'draft',
      visibility: 'team',
      priority: 'medium',
      metadata: {},
    };
    const updated = { ...current, content: 'Testo aggiornato' };
    const { service, query } = makeService();
    jest.spyOn(service, 'getArticle').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".knowledge_articles WHERE id = $1')) return [updated];
      if (sql.includes('SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "doflow".knowledge_article_versions')) return [{ version: 2 }];
      return [];
    });

    const result = await service.updateArticle(articleId, {
      content: updated.content,
      change_summary: 'Aggiornamento contenuto test',
    });

    expect(result.content).toBe(updated.content);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".knowledge_article_versions'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('COALESCE($2::integer'))).toBe(true);
  });

  it('patch article con solo metadata non crea nuova versione e non fallisce', async () => {
    const articleId = '33333333-3333-4333-8333-333333333333';
    const current = {
      id: articleId,
      title: 'Procedura interna',
      slug: 'procedura-interna',
      content: 'Testo',
      content_format: 'markdown',
      article_type: 'article',
      status: 'draft',
      visibility: 'team',
      priority: 'medium',
      metadata: {},
    };
    const updated = { ...current, metadata: { area: 'operations' } };
    const { service, query } = makeService();
    jest.spyOn(service, 'getArticle').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".knowledge_articles WHERE id = $1')) return [updated];
      return [];
    });

    const result = await service.updateArticle(articleId, { metadata: { area: 'operations' } });

    expect(result.metadata).toEqual({ area: 'operations' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".knowledge_article_versions'))).toBe(false);
  });

  it('patch article con change_summary opzionale non fallisce', async () => {
    const articleId = '33333333-3333-4333-8333-333333333333';
    const current = {
      id: articleId,
      title: 'Procedura interna',
      slug: 'procedura-interna',
      content: 'Testo',
      content_format: 'markdown',
      article_type: 'article',
      status: 'draft',
      visibility: 'team',
      priority: 'medium',
      metadata: {},
    };
    const updated = { ...current, title: 'Procedura aggiornata' };
    const { service, query } = makeService();
    jest.spyOn(service, 'getArticle').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".knowledge_articles WHERE id = $1')) return [updated];
      if (sql.includes('SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "doflow".knowledge_article_versions')) return [{ version: 2 }];
      return [];
    });

    const result = await service.updateArticle(articleId, { title: updated.title });

    expect(result.title).toBe(updated.title);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('knowledge_article_versions'))).toBe(true);
  });

  it('create template crea versione iniziale e activity', async () => {
    const template = {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Template test',
      slug: 'template-test',
      template_type: 'generic',
      category: 'operations',
      status: 'draft',
      visibility: 'team',
      content: { body: 'Test' },
      variables: null,
      instructions: null,
      metadata: {},
    };
    const { service, query } = makeService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO "doflow".operational_templates')) return [template];
      return [];
    });

    const created = await service.createTemplate({ name: template.name, template_type: 'generic', content: template.content });

    expect(created).toMatchObject({ id: template.id, name: template.name });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('operational_template_versions'))).toBe(true);
  });

  it('patch template cambiando instructions crea versione 2', async () => {
    const templateId = '44444444-4444-4444-8444-444444444444';
    const current = {
      id: templateId,
      name: 'Template test',
      slug: 'template-test',
      template_type: 'generic',
      category: 'operations',
      status: 'draft',
      visibility: 'team',
      content: { body: 'Test' },
      variables: null,
      instructions: 'Prima versione',
      metadata: {},
      is_system: false,
    };
    const updated = { ...current, instructions: 'Template test aggiornato.' };
    const { service, query } = makeService();
    jest.spyOn(service, 'getTemplate').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".operational_templates WHERE id = $1')) return [updated];
      if (sql.includes('SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "doflow".operational_template_versions')) return [{ version: 2 }];
      return [];
    });

    const result = await service.updateTemplate(templateId, { instructions: updated.instructions });

    expect(result.instructions).toBe(updated.instructions);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".operational_template_versions'))).toBe(true);
  });

  it('patch template cambiando content crea versione successiva', async () => {
    const templateId = '44444444-4444-4444-8444-444444444444';
    const current = {
      id: templateId,
      name: 'Template test',
      slug: 'template-test',
      template_type: 'generic',
      category: 'operations',
      status: 'draft',
      visibility: 'team',
      content: { body: 'Test' },
      variables: null,
      instructions: null,
      metadata: {},
      is_system: false,
    };
    const updated = { ...current, content: { body: 'Test aggiornato' } };
    const { service, query } = makeService();
    jest.spyOn(service, 'getTemplate').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".operational_templates WHERE id = $1')) return [updated];
      if (sql.includes('SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "doflow".operational_template_versions')) return [{ version: 3 }];
      return [];
    });

    const result = await service.updateTemplate(templateId, { content: updated.content, change_summary: 'Cambio content' });

    expect(result.content).toEqual(updated.content);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('operational_template_versions'))).toBe(true);
  });

  it('patch template con change_summary opzionale non fallisce', async () => {
    const templateId = '44444444-4444-4444-8444-444444444444';
    const current = {
      id: templateId,
      name: 'Template test',
      slug: 'template-test',
      template_type: 'generic',
      category: 'operations',
      status: 'draft',
      visibility: 'team',
      content: { body: 'Test' },
      variables: null,
      instructions: null,
      metadata: {},
      is_system: false,
    };
    const updated = { ...current, instructions: 'Istruzioni aggiornate' };
    const { service, query } = makeService();
    jest.spyOn(service, 'getTemplate').mockResolvedValue(current as any);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM "doflow".operational_templates WHERE id = $1')) return [updated];
      if (sql.includes('SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "doflow".operational_template_versions')) return [{ version: 2 }];
      return [];
    });

    await expect(service.updateTemplate(templateId, { instructions: updated.instructions })).resolves.toMatchObject({ instructions: updated.instructions });
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

  it('template use senza target_entity_id funziona', async () => {
    const { service, query } = makeService();
    jest.spyOn(service, 'getTemplate').mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Snippet',
      category: 'sales',
      content: { body: 'Ciao' },
      usage_count: 0,
    } as any);
    query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO "doflow".operational_template_usage')) {
        expect(params[1]).toBeNull();
        expect(params[2]).toBeNull();
        return [{ id: '55555555-5555-4555-8555-555555555555', template_id: params[0], target_entity_type: null, target_entity_id: null }];
      }
      return [];
    });

    const result = await service.useTemplate('44444444-4444-4444-8444-444444444444', {});

    expect(result.usage.target_entity_id).toBeNull();
  });

  it('article link con UUID invalido ritorna 400 senza insert parziale', async () => {
    const { service, query } = makeService();
    jest.spyOn(service, 'getArticle').mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Procedura',
      visibility: 'team',
    } as any);

    await expect(service.createArticleLink('33333333-3333-4333-8333-333333333333', {
      entity_type: 'project',
      entity_id: '00000000-0000-0000-0000-000000000001',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(query.mock.calls.some(([sql]) => String(sql).includes('knowledge_article_links'))).toBe(false);
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
