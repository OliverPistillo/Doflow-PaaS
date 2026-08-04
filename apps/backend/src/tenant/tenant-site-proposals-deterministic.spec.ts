import { buildDeterministicProposal } from './tenant-site-proposals-deterministic';
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
});
