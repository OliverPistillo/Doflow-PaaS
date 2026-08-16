import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { ProposalAiUnavailableError } from './tenant-site-proposals-ai.service';
import { TenantSiteProposalsPersonalizationService } from './tenant-site-proposals-personalization.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

jest.mock('./tenant-site-proposals-schema', () => ({
  ensureDoflowSiteProposalTables: jest.fn().mockResolvedValue(undefined),
}));

const proposalId = '550e8400-e29b-41d4-a716-446655440000';
const runId = '660e8400-e29b-41d4-a716-446655440000';
const ensureTables = ensureDoflowSiteProposalTables as jest.Mock;

function proposal(version = '2.0.0') {
  return {
    id: proposalId,
    display_name: 'Studio Demo',
    template_slug: 'colsova',
    template_version: version,
    status: 'draft',
    current_version: 1,
    source_data: {
      businessName: 'Studio Demo',
      city: 'Roma',
      category: 'studio professionale',
      services: ['A', 'B', 'C'],
      brands: [],
      extra: {},
    },
    site_config: {},
  };
}

function runtimeRequest(overrides: any = {}) {
  return {
    user: { id: proposalId, role: 'manager', tenantId: 'doflow' },
    tenantId: 'doflow',
    ...overrides,
  };
}

function setup(queryResults: any[] = [], request = runtimeRequest()) {
  const query = jest.fn();
  queryResults.forEach((value) => query.mockResolvedValueOnce(value));
  const runnerQuery = jest
    .fn()
    .mockResolvedValueOnce([{ id: proposalId, template_version: '2.0.0' }])
    .mockResolvedValue([]);
  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(function startTransaction() { (this as any).isTransactionActive = true; }),
    query: runnerQuery,
    commitTransaction: jest.fn(function commitTransaction() { (this as any).isTransactionActive = false; }),
    rollbackTransaction: jest.fn(function rollbackTransaction() { (this as any).isTransactionActive = false; }),
    release: jest.fn(),
    isTransactionActive: false,
  };
  const dataSource = { query, createQueryRunner: jest.fn(() => runner) } as any;
  const fetcher = { fetchHomepage: jest.fn() } as any;
  const extractor = { extract: jest.fn() } as any;
  const brand = { extract: jest.fn() } as any;
  const images = {
    resolveImages: jest.fn().mockResolvedValue({
      images: {
        hero: { src: 'https://images.unsplash.com/hero', alt: 'Hero', objectPosition: 'center', sourceMethod: 'catalog' },
        consultation: { src: 'https://images.unsplash.com/consultation', alt: 'Consultation', objectPosition: 'center', sourceMethod: 'catalog' },
        feature: { src: 'https://images.unsplash.com/feature', alt: 'Feature', objectPosition: 'center', sourceMethod: 'catalog' },
      },
      warnings: [],
    }),
  } as any;
  const ai = { configuration: jest.fn(() => ({ model: 'gemini-3.5-flash' })), generate: jest.fn() } as any;
  const service = new TenantSiteProposalsPersonalizationService(
    dataSource,
    fetcher,
    extractor,
    brand,
    images,
    ai,
    new TenantSiteProposalsTemplateService(),
    request,
  );
  return { service, query, runner, runnerQuery, ai, fetcher, brand, images, dataSource };
}

describe('proposal personalization coordinator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the production request.user tenantId shape and provisions doflow', async () => {
    const x = setup([[proposal('1.0.0')]]);

    await expect(x.service.personalize(proposalId, {})).rejects.toBeInstanceOf(ConflictException);

    expect(ensureTables).toHaveBeenCalledWith(x.dataSource, 'doflow');
  });

  it.each([
    ['user.tenant_id', runtimeRequest({ user: { id: proposalId, role: 'manager', tenant_id: 'doflow' }, tenantId: undefined })],
    ['user.tenantSlug', runtimeRequest({ user: { id: proposalId, role: 'manager', tenantSlug: 'doflow' }, tenantId: undefined })],
    ['authUser.tenantId', { authUser: { sub: proposalId, role: 'manager', tenantId: 'doflow' }, tenantId: 'doflow' }],
    ['request.tenantId', { user: { id: proposalId, role: 'manager' }, tenantId: 'doflow' }],
    ['legacy request.tenant.schemaName', { user: { id: proposalId, role: 'manager' }, tenant: { schemaName: 'doflow' } }],
  ])('resolves doflow from %s', (_source, request) => {
    const x = setup([], request);
    expect((x.service as any).schema()).toBe('doflow');
  });

  it('accepts authUser.sub and request.user.userId for manager-or-higher access', () => {
    const authUser = setup([], { authUser: { sub: proposalId, role: 'manager', tenantId: 'doflow' } });
    const owner = setup([], { user: { userId: proposalId, role: 'owner', tenant_id: 'doflow' } });

    expect((authUser.service as any).assertAccess()).toMatchObject({ id: proposalId, role: 'manager' });
    expect((owner.service as any).assertAccess()).toMatchObject({ id: proposalId, role: 'owner' });
  });

  it('rejects editor and anonymous access', () => {
    expect(() => (setup([], { user: { id: proposalId, role: 'editor', tenantId: 'doflow' } }).service as any).assertAccess())
      .toThrow(ForbiddenException);
    expect(() => (setup([], { tenantId: 'doflow' }).service as any).assertAccess())
      .toThrow(ForbiddenException);
  });

  it('returns 404 without calling safeSchema or the database when tenant is absent and releases the lock', async () => {
    const x = setup([], { user: { id: proposalId, role: 'manager' } });

    await expect(x.service.personalize(proposalId, {})).rejects.toBeInstanceOf(NotFoundException);

    expect(ensureTables).not.toHaveBeenCalled();
    expect(x.query).not.toHaveBeenCalled();
    expect((x.service as any).locks.has(proposalId)).toBe(false);
  });

  it.each([
    ['public', { user: { id: proposalId, role: 'manager', tenantId: 'public' } }, NotFoundException],
    ['foreign tenant', { user: { id: proposalId, role: 'manager', tenantId: 'acme' } }, ForbiddenException],
  ])('rejects %s before any database query', async (_label, request, exception) => {
    const x = setup([], request);

    await expect(x.service.personalize(proposalId, {})).rejects.toBeInstanceOf(exception as any);

    expect(ensureTables).not.toHaveBeenCalled();
    expect(x.query).not.toHaveBeenCalled();
  });

  it('rejects an unsafe tenant reference through safeSchema without interpolating SQL', async () => {
    const x = setup([], { user: { id: proposalId, role: 'manager', tenantId: 'doflow;drop' } });

    await expect(x.service.personalize(proposalId, {})).rejects.toThrow('Invalid schema name');

    expect(ensureTables).not.toHaveBeenCalled();
    expect(x.query).not.toHaveBeenCalled();
  });

  it('lists personalization history with the runtime request shape and no request.tenant', async () => {
    const x = setup([[{ id: proposalId }], []]);

    await expect(x.service.list(proposalId)).resolves.toEqual([]);

    expect(ensureTables).toHaveBeenCalledWith(x.dataSource, 'doflow');
  });

  it('requires explicit upgrade for legacy proposals', async () => {
    const x = setup([[proposal('1.0.0')]]);
    await expect(x.service.personalize(proposalId, {})).rejects.toThrow('Aggiorna prima');
    expect(x.ai.generate).not.toHaveBeenCalled();
  });

  it('returns a cached snapshot without Gemini or a new version', async () => {
    const cached = { id: runId, status: 'fallback' };
    const x = setup([[proposal()], [], [], [cached]]);

    await expect(x.service.personalize(proposalId, {})).resolves.toMatchObject({ cached: true, status: 'fallback' });
    expect(x.ai.generate).not.toHaveBeenCalled();
    expect(x.runner.query).not.toHaveBeenCalled();
  });

  it('reproduces the production request shape and completes a fallback personalization', async () => {
    const x = setup([[proposal()], [], [], [{ id: runId }], []], {
      user: { id: proposalId, role: 'manager', tenantId: 'doflow' },
      tenantId: 'doflow',
    });
    x.ai.generate.mockRejectedValue(new ProposalAiUnavailableError('missing_key'));

    const result = await x.service.personalize(proposalId, { force: true });

    expect(result).toMatchObject({ cached: false, status: 'fallback', provider: 'local' });
    expect(ensureTables).toHaveBeenCalledWith(x.dataSource, 'doflow');
    expect(x.query.mock.calls.some(([sql]) => String(sql).includes('site_proposal_personalizations') && String(sql).includes('INSERT INTO'))).toBe(true);
    expect(x.runner.commitTransaction).toHaveBeenCalled();
    expect(x.runnerQuery.mock.calls.some(([sql]) => String(sql).includes('site_proposal_versions'))).toBe(true);
    expect(x.runnerQuery.mock.calls.some(([sql, args]) => String(sql).includes('site_proposal_activity') && args[1] === 'PROPOSAL_PERSONALIZATION_FALLBACK')).toBe(true);
    expect((x.service as any).locks.has(proposalId)).toBe(false);
  });

  it('persists resolved image methods and warnings before Gemini fallback', async () => {
    const x = setup([[proposal()], [], [], [{ id: runId }], []]);
    x.images.resolveImages.mockResolvedValue({
      images: {
        hero: { src: 'https://example.com/hero.jpg', alt: 'Hero', objectPosition: 'center', sourceMethod: 'website' },
        consultation: { src: 'https://images.unsplash.com/c1', alt: 'C', objectPosition: 'center', sourceMethod: 'catalog' },
        feature: { src: 'https://images.unsplash.com/f1', alt: 'F', objectPosition: 'center', sourceMethod: 'catalog_fallback' },
      },
      warnings: ['warning catalogo'],
    });
    x.ai.generate.mockRejectedValue(new ProposalAiUnavailableError('missing_key'));

    await x.service.personalize(proposalId, { force: true });

    const update = x.runnerQuery.mock.calls.find(([sql]) => String(sql).includes('SET template_version'))?.[1];
    const config = JSON.parse(update[0]);
    expect(config.images.hero.sourceMethod).toBe('website');
    expect(config.images.consultation.src).toBeTruthy();
    expect(config.images.feature.src).toBeTruthy();
    expect(config.personalization.warnings).toContain('warning catalogo');
  });

  it('uses validated Gemini output and marks completed', async () => {
    const x = setup([[proposal()], [], [], [{ id: runId }], []]);
    x.ai.generate.mockResolvedValue({
      model: 'gemini-test',
      output: {
        analysis: { summary: 'Sintesi', strengths: [], improvementAreas: [], opportunities: [], whyDoflow: [], requiresManualReview: true },
        content: {
          hero: {}, approach: {},
          services: [{ title: 'A', description: 'a' }, { title: 'B', description: 'b' }, { title: 'C', description: 'c' }],
          benefits: {},
          trustItems: Array.from({ length: 6 }, (_, index) => ({ title: `T${index}`, description: 'd' })),
          faq: Array.from({ length: 6 }, (_, index) => ({ question: `Q${index}`, answer: 'a' })),
          contact: {}, footer: {},
        },
        seo: { title: 'Titolo', description: 'Descrizione' },
        email: { subject: 'Oggetto', body: 'Corpo [LINK_DEMO]' },
      },
    });

    const result = await x.service.personalize(proposalId, { force: true });

    expect(result).toMatchObject({ status: 'completed', provider: 'gemini' });
    expect(x.runnerQuery.mock.calls.some(([sql, args]) => String(sql).includes('site_proposal_activity') && args[1] === 'PROPOSAL_PERSONALIZATION_COMPLETED')).toBe(true);
  });

  it('marks the run failed and never applies a partial config on total error', async () => {
    const x = setup([[proposal()], [], [], [{ id: runId }], [], []]);
    x.ai.generate.mockRejectedValue(new Error('unexpected'));

    await expect(x.service.personalize(proposalId, { force: true })).rejects.toThrow('unexpected');

    expect(x.runner.query).not.toHaveBeenCalled();
    expect(x.query.mock.calls.some(([sql, args]) => String(sql).includes("status='failed'") && args[1] === runId)).toBe(true);
  });

  it('blocks an in-process duplicate and always releases the lock', async () => {
    const x = setup();
    (x.service as any).locks.add(proposalId);
    await expect(x.service.personalize(proposalId, {})).rejects.toThrow('Personalizzazione già in corso');
    (x.service as any).locks.delete(proposalId);
    const y = setup([[proposal('1.0.0')]]);
    await expect(y.service.personalize(proposalId, {})).rejects.toBeInstanceOf(ConflictException);
    expect((y.service as any).locks.has(proposalId)).toBe(false);
  });
});
