import { applyAiOutputForProfile, buildDeterministicProposal } from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

const input = (name: string, city: string, category: string) => ({ businessName: name, city, category, services: ['Consulenza', 'Percorso', 'Assistenza'], brands: [], extra: {} });

describe('deterministic proposal engine 2.4.1', () => {
  let base: any;
  beforeAll(async () => { base = await new TenantSiteProposalsTemplateService().getDefaultConfig('colsova', '2.4.1'); });

  it('is reproducible for the same prospect', () => expect(buildDeterministicProposal(base, input('Alfa', 'Roma', 'studio professionale'))).toEqual(buildDeterministicProposal(base, input('Alfa', 'Roma', 'studio professionale'))));
  it('differentiates three prospects', () => { const packages = [input('Alfa', 'Roma', 'studio professionale'), input('Beta', 'Milano', 'centro estetico'), input('Gamma', 'Torino', 'medicina estetica')].map((item) => buildDeterministicProposal(base, item)); expect(new Set(packages.map((item) => (item.config.content as any).hero.title)).size).toBe(3); expect(new Set(packages.map((item) => item.email.body)).size).toBe(3); });
  it('creates all conversion counts and images', () => { const value = buildDeterministicProposal(base, input('Alfa', 'Roma', 'centro estetico')); const content = value.config.content as any; expect(content.services).toHaveLength(3); expect(content.trust.items).toHaveLength(4); expect(content.process.steps).toHaveLength(3); expect(content.faq).toHaveLength(6); for (const key of ['hero', 'consultation', 'feature']) expect((value.config.images as any)[key].src).toBeTruthy(); });
  it('preserves six demo reviews and their disclaimer', () => { const value = buildDeterministicProposal(base, input('Alfa', 'Roma', 'medicina estetica')); expect((value.config.content as any).reviews).toEqual((base.content as any).reviews); expect((value.config.features as any).reviewsMode).toBe('demo'); expect(JSON.stringify(value.config).toLowerCase()).toContain('recensioni dimostrative'); });
  it('preserves features, routing, assets and form structure', () => { const value = buildDeterministicProposal(base, input('Alfa', 'Roma', 'studio professionale')); expect(value.config.features).toEqual(base.features); expect(value.config.routing).toEqual(base.routing); expect(value.config.assets).toEqual(base.assets); expect((value.config.content as any).contact.demoNotice).toEqual((base.content as any).contact.demoNotice); });
  it('produces a complete email and internal analysis', () => { const value = buildDeterministicProposal(base, input('Alfa', 'Roma', 'studio professionale')); const internal = value.analysis as any; expect(value.email.subject.length).toBeGreaterThanOrEqual(8); expect(value.email.body.length).toBeGreaterThanOrEqual(250); expect(value.email.body).toContain('[LINK_DEMO]'); expect(internal.summary.length).toBeGreaterThanOrEqual(40); expect(internal.improvementAreas).toBeInstanceOf(Array); });
  it('merges basic AI output through an allowlist and preserves protected config', () => {
    const built: any = { config: { template: { slug: 'safe' }, editingContract: { locked: true }, textLimits: { x: 1 }, features: { enabled: true }, routing: { contact: '#contact' }, images: { hero: { src: 'data:image/png;base64,AA==' } }, assets: { immutable: true }, business: { name: 'A' }, brand: { name: 'A' }, palette: { primary: '#000' }, content: { hero: { protectedHint: 'keep', title: 'Old' }, reviews: ['protected'] } }, analysis: {}, email: { subject: '', body: '' } };
    const output: any = { analysis: { summary: 'ok' }, email: { subject: 'subject', body: 'body' }, seo: { title: 'SEO', description: 'Description' }, content: { hero: { title: 'New' }, approach: {}, services: [], benefits: {}, trustItems: [], faq: [], contact: {}, footer: {}, reviews: ['attack'] } };
    const result = applyAiOutputForProfile(built, output, { contentProfile: 'proposal-basic-v2' } as any);
    expect((result.config.content as any).hero).toEqual({ protectedHint: 'keep', title: 'New' });
    expect((result.config.content as any).reviews).toEqual(['protected']);
    for (const key of ['template','editingContract','textLimits','features','routing','images','assets','business','brand']) expect(result.config[key]).toEqual(built.config[key]);
  });
});
