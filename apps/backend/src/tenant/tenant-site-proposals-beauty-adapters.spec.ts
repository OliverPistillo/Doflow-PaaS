import * as fs from 'fs';
import * as path from 'path';
import { TenantSiteProposalsAiService, ProposalAiUnavailableError } from './tenant-site-proposals-ai.service';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { getProposalContentProfileAdapter, listProposalContentProfileAdapters } from './tenant-site-proposals-content-profile-adapters';
import { applyAiOutputForProfile, buildDeterministicProposalForTemplate } from './tenant-site-proposals-deterministic';
import { getTemplateRegistration } from './tenant-site-proposals-template-registry';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { CanonicalProposalInput, JsonObject } from './tenant-site-proposals.types';
import { evaluateProposalReadiness } from './tenant-site-proposals-readiness';
import { deepClone, validateSiteConfig } from './tenant-site-proposals-validation';

const ROOT = path.join(__dirname, 'site-proposal-templates');
const PROSPECTS: CanonicalProposalInput[] = [
  { businessName: 'Clinica Armonia', category: 'Medicina estetica', descriptor: 'Clinica con percorsi personalizzati', city: 'Milano', services: ['Consulenza estetica', 'Trattamenti viso', 'Trattamenti corpo', 'Dermocosmesi', 'Follow-up'], brands: [], extra: {} },
  { businessName: 'Spazio Equilibrio', category: 'Wellness', descriptor: 'Professionista del benessere', city: 'Bologna', services: ['Consulenza wellness', 'Massaggi', 'Percorsi corpo', 'Rituali viso'], brands: [], extra: {} },
  { businessName: 'Maison Bellezza', category: 'Beauty premium', descriptor: 'Centro beauty premium', city: 'Roma', services: ['Diagnosi beauty', 'Skincare', 'Rituali premium', 'Trattamenti corpo', 'Percorsi su misura'], brands: [], extra: {} },
];

function baseConfig(slug: 'aurea' | 'luce'): JsonObject {
  const html = fs.readFileSync(path.join(ROOT, slug, '1.2.0', 'template.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, slug, '1.2.0', 'theme.json'), 'utf8')) as JsonObject;
  const match = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) throw new Error('template-config missing');
  const config = JSON.parse(match[1]) as JsonObject;
  config.textLimits = deepClone(manifest.textLimits as JsonObject);
  return config;
}

function outputFor(slug: 'aurea' | 'luce', input = PROSPECTS[0]) {
  const registration = getTemplateRegistration(slug, '1.2.0');
  const built = buildDeterministicProposalForTemplate(baseConfig(slug), registration, input);
  const adapter = getProposalContentProfileAdapter(registration.contentProfile);
  const content = built.config.content as JsonObject;
  return {
    built,
    registration,
    output: {
      analysis: {
        summary: built.analysis.summary,
        strengths: deepClone(built.analysis.strengths),
        improvementAreas: deepClone(built.analysis.improvementAreas),
        opportunities: ['Rendere più immediato il percorso verso il contatto.'],
        whyDoflow: ['Una demo mirata rende concreta la proposta di miglioramento.'],
        evidence: ['Le indicazioni derivano esclusivamente dai dati pubblici forniti.'],
        requiresManualReview: built.analysis.requiresManualReview,
      },
      content: Object.fromEntries(adapter.generatedContentKeys.map((key) => [key, deepClone(content[key])])),
      seo: deepClone(built.config.seo as JsonObject),
      email: deepClone(built.email),
    } as JsonObject,
  };
}

describe('runtime content profile adapter registry', () => {
  it('registers exactly the four supported runtime profiles', () => {
    expect(listProposalContentProfileAdapters().map((item) => item.profile).sort()).toEqual(['beauty-conversion-v1','beauty-editorial-v1','colsova-conversion-v1','proposal-basic-v2']);
  });
  it.each(['beauty-editorial-v1','beauty-conversion-v1'] as const)('declares %s ready without slug-dependent resolution', (profile) => {
    expect(getProposalContentProfileAdapter(profile)).toMatchObject({ profile, runtimeReady: true });
  });
  it('rejects unknown profiles instead of falling back to Colsova', () => expect(() => getProposalContentProfileAdapter('unknown')).toThrow('Unsupported proposal content profile'));
});

describe.each([
  ['aurea', 4, 3, 4],
  ['luce', 5, 3, 5],
] as const)('%s deterministic runtime adapter', (slug, serviceCount, resultCount, trustCount) => {
  it.each(PROSPECTS)('builds a complete prospect-specific config for $businessName', (input) => {
    const { built, registration } = outputFor(slug, input);
    expect(() => validateSiteConfig(built.config, registration)).not.toThrow();
    const content = built.config.content as JsonObject;
    expect(content.services).toHaveLength(serviceCount);
    expect(content.trust).toHaveLength(trustCount);
    if (slug === 'aurea') expect((content.results as JsonObject).items).toHaveLength(resultCount);
    else {
      expect(((built.config.images as JsonObject).results as unknown[])).toHaveLength(resultCount);
      expect((content.cta as JsonObject).items).toHaveLength(4);
      expect(((content.cta as JsonObject).items as string[])[3]).toBe('Supporto costante e dedicato');
      expect((content.reviews as JsonObject).items).toHaveLength(3);
    }
    expect(built.email.body).toContain('[LINK_DEMO]');
    expect(String((built.config.seo as JsonObject).title)).toContain(input.businessName);
    expect((built.config.personalization as JsonObject).contentProfile).toBe(registration.contentProfile);
    expect((built.config.brand as JsonObject).logoDefault).toBeTruthy();
    for (const slot of ['hero', 'consultation', 'feature']) {
      expect((built.config.images as JsonObject)[slot]).toMatchObject({ src: expect.any(String), alt: expect.any(String), objectPosition: expect.any(String), sourceMethod: expect.any(String) });
    }
    expect(Object.keys(built.config.palette as JsonObject).sort()).toEqual([...getProposalContentProfileAdapter(registration.contentProfile).paletteKeys].sort());
    expect(evaluateProposalReadiness({ emailSubject: built.email.subject, emailBody: built.email.body, commercialAnalysis: built.analysis, siteConfigValid: true, generationComplete: true, requireGeneration: true, adapterReady: true, themeActive: true }).complete).toBe(true);
  });

  it('is byte-deterministic for identical canonical input', () => {
    const first = outputFor(slug, PROSPECTS[0]).built;
    const second = outputFor(slug, PROSPECTS[0]).built;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('produces different copy for different prospects', () => {
    const first = outputFor(slug, PROSPECTS[0]).built;
    const second = outputFor(slug, PROSPECTS[1]).built;
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
    expect(first.email.subject).not.toBe(second.email.subject);
  });
});

describe('strict beauty AI validation and protected merge', () => {
  const ai = new TenantSiteProposalsAiService();

  it.each(['aurea','luce'] as const)('accepts a complete %s output', (slug) => {
    const { built, output, registration } = outputFor(slug);
    expect(() => ai.validate(output, built.config.textLimits as JsonObject, registration.contentProfile)).not.toThrow();
  });

  it.each([
    ['aurea', 'empty hero', (output: JsonObject): void => { ((output.content as JsonObject).hero as JsonObject).title = ''; }],
    ['aurea', 'services count', (output: JsonObject) => (output.content as JsonObject).services = ((output.content as JsonObject).services as unknown[]).slice(0, 3)],
    ['aurea', 'results count', (output: JsonObject) => ((output.content as JsonObject).results as JsonObject).items = (((output.content as JsonObject).results as JsonObject).items as unknown[]).slice(0, 2)],
    ['aurea', 'trust count', (output: JsonObject) => (output.content as JsonObject).trust = ((output.content as JsonObject).trust as unknown[]).slice(0, 3)],
    ['aurea', 'booking empty', (output: JsonObject): void => { ((output.content as JsonObject).booking as JsonObject).cta = ''; }],
    ['aurea', 'newsletter empty', (output: JsonObject): void => { ((output.content as JsonObject).newsletter as JsonObject).title = ''; }],
    ['luce', 'services count', (output: JsonObject) => (output.content as JsonObject).services = ((output.content as JsonObject).services as unknown[]).slice(0, 4)],
    ['luce', 'trust count', (output: JsonObject) => (output.content as JsonObject).trust = ((output.content as JsonObject).trust as unknown[]).slice(0, 4)],
    ['luce', 'cta count', (output: JsonObject) => ((output.content as JsonObject).cta as JsonObject).items = (((output.content as JsonObject).cta as JsonObject).items as unknown[]).slice(0, 3)],
    ['luce', 'protected fourth cta', (output: JsonObject): void => { (((output.content as JsonObject).cta as JsonObject).items as string[])[3] = 'Altro testo'; }],
    ['luce', 'reviews injection', (output: JsonObject) => (output.content as JsonObject).reviews = {}],
    ['luce', 'feature injection', (output: JsonObject) => (output.content as JsonObject).features = {}],
  ] as const)('rejects %s AI output with %s', (slug, _case, mutate) => {
    const { built, output, registration } = outputFor(slug);
    mutate(output);
    expect(() => ai.validate(output, built.config.textLimits as JsonObject, registration.contentProfile)).toThrow(ProposalAiUnavailableError);
  });

  it.each(['aurea','luce'] as const)('rejects common incomplete or unsafe %s output', (slug) => {
    const { built, output, registration } = outputFor(slug);
    (output.email as JsonObject).body = 'Email completa ma priva del segnaposto richiesto. '.repeat(8);
    expect(() => ai.validate(output, built.config.textLimits as JsonObject, registration.contentProfile)).toThrow('AI non disponibile');
  });

  it.each(['aurea','luce'] as const)('preserves protected %s configuration during AI merge', (slug) => {
    const { built, output, registration } = outputFor(slug);
    const before = deepClone({ routing: built.config.routing, features: built.config.features, images: built.config.images, palette: built.config.palette, editingContract: built.config.editingContract, reviews: (built.config.content as JsonObject).reviews });
    const merged = applyAiOutputForProfile(built, output, registration);
    expect({ routing: merged.config.routing, features: merged.config.features, images: merged.config.images, palette: merged.config.palette, editingContract: merged.config.editingContract, reviews: (merged.config.content as JsonObject).reviews }).toEqual(before);
  });
});

describe('beauty modular generation artifacts', () => {
  const validator = new TenantSiteProposalsThemePackageService();
  const compiler = new TenantSiteProposalsThemeCompilerService(validator);
  const artifacts = new TenantSiteProposalsArtifactService();

  it.each(['aurea','luce'] as const)('compiles deterministic standalone HTML and ZIP for %s', async (slug) => {
    const { built } = outputFor(slug);
    const validated = await validator.validateDirectory(path.join(ROOT, slug, '1.2.0'), true);
    const first = compiler.compileValidated(validated, built.config, true);
    const second = compiler.compileValidated(validated, built.config, true);
    expect(second).toMatchObject({ html: first.html, sha256: first.sha256, size: first.size });
    expect(first.html).toContain('template-config');
    expect(first.html).toContain(PROSPECTS[0].businessName);
    const zipA = await artifacts.createZip(first.html, []);
    const zipB = await artifacts.createZip(first.html, []);
    expect(zipB.sha256).toBe(zipA.sha256);
    expect(zipB.buffer.equals(zipA.buffer)).toBe(true);
  });
});
