import * as path from 'path';
import { load } from 'cheerio';
import * as yauzl from 'yauzl';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { getProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';
import { applyAiOutputForProfile, buildDeterministicProposalForTemplate } from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsLogoGeneratorService } from './tenant-site-proposals-logo-generator.service';
import { evaluateProposalPersonalizationDelta } from './tenant-site-proposals-personalization-delta';
import { getTemplateRegistration } from './tenant-site-proposals-template-registry';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { CanonicalProposalInput, JsonObject } from './tenant-site-proposals.types';

const ROOT = path.join(__dirname, 'site-proposal-templates');
const cases = [
  { slug: 'aurea', version: '1.2.0', hero: 'TEST-AUREA-HERO-UNIQUE', service: 'TEST-AUREA-SERVICE-UNIQUE', ctaPath: 'content.booking.cta' },
  { slug: 'luce', version: '1.2.0', hero: 'TEST-LUCE-HERO-UNIQUE', service: 'TEST-LUCE-SERVICE-UNIQUE', ctaPath: 'content.cta.button' },
  { slug: 'colsova', version: '2.4.1', hero: 'TEST-COLSOVA-HERO-UNIQUE', service: 'TEST-COLSOVA-SERVICE-UNIQUE', ctaPath: 'content.headerCta' },
] as const;
const packageService = new TenantSiteProposalsThemePackageService();
const compiler = new TenantSiteProposalsThemeCompilerService(packageService);
const logoGenerator = new TenantSiteProposalsLogoGeneratorService();

function at(value: any, key: string) { return key.split('.').reduce((current, part) => current?.[part], value); }
function renderSlots(html: string) {
  const $ = load(html); const config = JSON.parse($('#template-config').text()) as JsonObject;
  $('[data-doflow-slot]').each((_index, element) => {
    const node = $(element); const value = at(config, String(node.attr('data-doflow-slot'))); const attr = node.attr('data-doflow-attr');
    if (value == null) return; if (attr && value !== '') node.attr(attr, String(value)); else if (!attr) node.text(String(value));
  });
  $('[data-logo-slot]').each((_index, element) => { const node = $(element); const logo = at(config, `images.${node.attr('data-logo-slot')}`); if (logo?.src) node.attr('src', logo.src); });
  return { $, config };
}
function canonical(item: typeof cases[number], name = `Impresa ${item.slug}`): CanonicalProposalInput {
  return { businessName: name, descriptor: 'Centro professionale', category: 'Beauty e wellness', city: 'Roma', overview: item.hero, services: [item.service, 'Servizio Due', 'Servizio Tre', 'Servizio Quattro', 'Servizio Cinque'], brands: [], extra: {} };
}
async function built(item: typeof cases[number], name?: string) {
  const validated = await packageService.validateDirectory(path.join(ROOT, item.slug, item.version), true);
  const registration = getTemplateRegistration(item.slug, item.version); const input = canonical(item, name);
  const logos = logoGenerator.generate({ businessName: input.businessName, descriptor: input.descriptor, palette: validated.defaultConfig.palette as JsonObject, contentProfile: registration.contentProfile, fingerprint: `pipeline:${input.businessName}` });
  const assets: JsonObject = {
    logoDefault: logos.defaultLogo.dataUri, logoLight: logos.lightLogo.dataUri, sourceMethod: 'generated',
    logoDefaultAsset: { sha256: logos.defaultLogo.sha256, mime: logos.defaultLogo.mime, width: logos.defaultLogo.width, height: logos.defaultLogo.height },
    logoLightAsset: { sha256: logos.lightLogo.sha256, mime: logos.lightLogo.mime, width: logos.lightLogo.width, height: logos.lightLogo.height },
  };
  return { validated, registration, base: validated.defaultConfig, result: buildDeterministicProposalForTemplate(validated.defaultConfig, registration, input, undefined, assets), logos };
}

describe.each(cases)('$slug personalized copy pipeline', (item) => {
  it('builds a sufficient profile-driven visible delta and preserves protected demo reviews', async () => {
    const value = await built(item); const adapter = getProposalContentProfileAdapter(value.registration.contentProfile);
    const delta = evaluateProposalPersonalizationDelta(value.base, value.result.config, adapter);
    expect(delta.sufficient).toBe(true); expect(delta.changedVisibleCount).toBeGreaterThanOrEqual(adapter.minimumVisibleChanges);
    expect(delta.changedVisiblePaths).toEqual(expect.arrayContaining(adapter.visibleChangeRequirements.map((group) => expect.stringMatching(group.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')))));
    if (adapter.protectedContentPaths.includes('reviews')) expect((value.result.config.content as JsonObject).reviews).toEqual((value.base.content as JsonObject).reviews);
  });

  it('persists the custom config in the only template-config and renders sentinels into final DOM slots', async () => {
    const value = await built(item); const compiled = compiler.compileValidated(value.validated, value.result.config, true);
    expect(compiled.html.match(/id=["']template-config["']/g)).toHaveLength(1);
    const rendered = renderSlots(compiled.html); expect(rendered.config.content).toEqual(value.result.config.content); expect(rendered.config.brand).toEqual(value.result.config.brand);
    const hero = rendered.$('[data-doflow-slot="content.hero.description"]').first(); const service = rendered.$('[data-doflow-slot="content.services.0.title"]').first();
    expect(hero.text()).toBe(item.hero); expect(service.text()).toBe(item.service);
    expect(hero.text()).not.toBe(String(at(value.base, 'content.hero.description'))); expect(service.text()).not.toBe(String(at(value.base, 'content.services.0.title')));
    expect(String(at(rendered.config, item.ctaPath))).not.toBe(String(at(value.base, item.ctaPath)));
  });

  it('uses config SHA-sensitive deterministic compilation', async () => {
    const first = await built(item); const repeat = compiler.compileValidated(first.validated, first.result.config, true); const again = compiler.compileValidated(first.validated, first.result.config, true);
    const other = await built(item, `Secondo prospect ${item.slug}`); const different = compiler.compileValidated(other.validated, other.result.config, true);
    expect(again).toEqual(repeat); expect(different.sha256).not.toBe(repeat.sha256); expect(different.compilationReport.configSha256).not.toBe(repeat.compilationReport.configSha256);
    expect(repeat.compilationReport.compilerVersion).toBe('modular-compiler-v2');
  });

  it('rejects AI attribution when only analysis, email or SEO changes', async () => {
    const value = await built(item); const candidate = applyAiOutputForProfile(value.result, { analysis: { changed: true }, email: { subject: 'Changed', body: 'Changed' }, seo: { title: 'Changed', description: 'Changed' }, content: {} }, value.registration);
    const delta = evaluateProposalPersonalizationDelta(value.result.config, candidate.config, getProposalContentProfileAdapter(value.registration.contentProfile));
    expect(delta.sufficient).toBe(false); expect(delta.changedVisibleCount).toBe(0);
  });

  it('renders generated logos offline and packages byte-identical SVG files', async () => {
    const value = await built(item); const compiled = compiler.compileValidated(value.validated, value.result.config, true); const rendered = renderSlots(compiled.html);
    const defaultSrc = item.slug === 'colsova' ? rendered.$('[data-logo-slot="logoDefault"]').first().attr('src') : rendered.$('[data-doflow-slot="brand.logoDefault"]').first().attr('src');
    expect(defaultSrc).toBe(value.logos.defaultLogo.dataUri); expect(compiled.html).toContain(value.logos.defaultLogo.dataUri);
    const artifacts = new TenantSiteProposalsArtifactService(); const zip = await artifacts.createZip(compiled.html, [], [
      { path: 'assets/generated/logo-default.svg', bytes: value.logos.defaultLogo.bytes },
      { path: 'assets/generated/logo-light.svg', bytes: value.logos.lightLogo.bytes },
    ]);
    expect(zip.entries).toEqual(expect.arrayContaining(['assets/generated/logo-default.svg','assets/generated/logo-light.svg']));
    const extracted = await zipEntries(zip.buffer); expect(extracted.get('assets/generated/logo-default.svg')?.equals(value.logos.defaultLogo.bytes)).toBe(true); expect(extracted.get('assets/generated/logo-light.svg')?.equals(value.logos.lightLogo.bytes)).toBe(true);
  });
});

describe('personalized HTML render cache', () => {
  it('keys output by package SHA, config SHA and renderer version', async () => {
    const templates = new TenantSiteProposalsTemplateService(undefined, compiler, packageService);
    const registration = getTemplateRegistration('aurea', '1.2.0'); const base = await templates.getDefaultConfig('aurea', '1.2.0');
    const firstConfig = buildDeterministicProposalForTemplate(base, registration, canonical(cases[0], 'Prospect Cache Uno')).config;
    const secondConfig = buildDeterministicProposalForTemplate(base, registration, canonical(cases[0], 'Prospect Cache Due')).config;
    const first = await templates.renderHtml(firstConfig); const repeated = await templates.renderHtml(firstConfig); const second = await templates.renderHtml(secondConfig);
    expect(repeated).toEqual(first); expect(second.sha256).not.toBe(first.sha256);
    const keys = [...((templates as any).renderCache as Map<string, unknown>).keys()]; expect(keys).toHaveLength(2); expect(keys.every((key) => key.endsWith(':proposal-renderer-v2'))).toBe(true);
    expect(keys[0].split(':')).toHaveLength(3); expect(keys[0]).not.toBe(keys[1]);
  });
});

function zipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
    if (error || !zip) return reject(error); const entries = new Map<string, Buffer>();
    zip.on('error', reject); zip.on('end', () => resolve(entries)); zip.on('entry', (entry) => zip.openReadStream(entry, (streamError, stream) => {
      if (streamError || !stream) return reject(streamError); const chunks: Buffer[] = []; stream.on('data', (chunk) => chunks.push(Buffer.from(chunk))); stream.on('error', reject); stream.on('end', () => { entries.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
    })); zip.readEntry();
  }));
}
