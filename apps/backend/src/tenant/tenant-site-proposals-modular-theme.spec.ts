import * as fs from 'fs';
import * as path from 'path';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { getTemplateRegistration, latestTemplateRegistration, SITE_PROPOSAL_TEMPLATE_REGISTRY } from './tenant-site-proposals-template-registry';
import { sha256 } from './tenant-site-proposals-validation';

const ROOT = path.join(__dirname, 'site-proposal-templates');
const THEMES = [
  { slug: 'aurea', version: '1.2.0', profile: 'beauty-editorial-v1', status: 'ready', source: 'cdc959eaa870485134fc2e93bade901eebf20e0af54d2d8d4113c904790da5a6', size: 384117 },
  { slug: 'luce', version: '1.2.0', profile: 'beauty-conversion-v1', status: 'ready', source: '9f990c78514508cfe832a69e8a5caec21271085bed8eb977ff9dfce9ce6bd2c2', size: 347122 },
  { slug: 'colsova', version: '2.4.1', profile: 'colsova-conversion-v1', status: 'ready', source: '395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263', size: 2276156 },
] as const;

describe('built-in modular proposal themes', () => {
  const validator = new TenantSiteProposalsThemePackageService();
  const compiler = new TenantSiteProposalsThemeCompilerService(validator);

  it.each(THEMES)('validates $slug@$version from its declarative manifest', async (theme) => {
    const validated = await validator.validateDirectory(path.join(ROOT, theme.slug, theme.version), true);
    expect(validated).toMatchObject({ format: 'modular', contentProfile: theme.profile, modularPackage: { manifest: { runtimeAdapterStatus: theme.status, provenance: { sourceTemplateSha256: theme.source, sourceTemplateSize: theme.size } } } });
    expect(validated.modularPackage!.fileInventory.map((entry) => entry.path)).toEqual([...validated.modularPackage!.fileInventory.map((entry) => entry.path)].sort((left, right) => left.localeCompare(right)));
    for (const asset of validated.modularPackage!.assetInventory) {
      const bytes = validated.files[asset.path];
      expect(bytes.length).toBe(asset.size);
      expect(sha256(bytes)).toBe(asset.sha256);
    }
  });

  it.each(THEMES)('compiles $slug deterministically to a standalone artifact', async (theme) => {
    const root = path.join(ROOT, theme.slug, theme.version);
    const first = await compiler.compileDirectory(root);
    const second = await compiler.compileDirectory(root);
    expect(second).toEqual(first);
    expect(first.sha256).toBe(sha256(first.html));
    expect(first.size).toBe(Buffer.byteLength(first.html));
    expect(first.html).toContain('<style data-doflow-entry="styles/theme.css">');
    expect(first.html).toContain('<script data-doflow-entry="scripts/theme.js">');
    expect(first.html).not.toMatch(/(?:src|href)=["'](?:styles|scripts|assets)\//);
    expect(first.html).not.toMatch(/url\([^)]*assets\//);
    expect(first.html).toContain("connect-src 'none'");
    expect(first.html).toContain('data:image/');
  });

  it('normalizes Aurea only to template version 1.2.0', async () => {
    const value = await validator.validateDirectory(path.join(ROOT, 'aurea', '1.2.0'), true);
    expect((value.defaultConfig.template as any).templateVersion).toBe('1.2.0');
    expect(value.modularPackage!.manifest.collections.services.count).toBe(4);
    expect(value.modularPackage!.manifest.collections['results.items'].count).toBe(3);
  });

  it('normalizes Luce fourth CTA without changing its text or position', async () => {
    const value = await validator.validateDirectory(path.join(ROOT, 'luce', '1.2.0'), true);
    const content = value.defaultConfig.content as any;
    expect(content.cta.items).toHaveLength(4);
    expect(content.cta.items[3]).toBe('Supporto costante e dedicato');
    expect(value.template.toString('utf8')).toContain('data-doflow-slot="content.cta.items.3"');
    expect(value.modularPackage!.manifest.fixedCounts.ctaItems).toBe(4);
  });

  it('preserves Colsova demo reviews, disclaimer and form behavior', async () => {
    const value = await validator.validateDirectory(path.join(ROOT, 'colsova', '2.4.1'), true);
    const config = value.defaultConfig as any;
    const html = value.template.toString('utf8');
    expect(config.features.reviewsMode).toBe('demo');
    expect(config.content.reviews).toHaveLength(6);
    expect(config.content.reviewsIntro.disclaimer).toContain('dimostrative');
    expect(html).toContain('Recensioni dimostrative');
    expect(html).toContain('<form');
    expect(value.modularPackage!.manifest.fixedCounts).toMatchObject({ services: 3, reviews: 6, faqs: 6, trustItems: 4, consultationHighlights: 3, processSteps: 3 });
  });

  it('builds byte-identical deterministic built-in source ZIP files', async () => {
    const root = path.join(ROOT, 'colsova', '2.4.1');
    const first = await compiler.buildDirectoryZip(root);
    const second = await compiler.buildDirectoryZip(root);
    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(first.sha256).toBe(second.sha256);
    expect(first.entries).toEqual([...first.entries].sort());
  });

  it('replaces only template-config and escapes script-breaking JSON deterministically', async () => {
    const root = path.join(ROOT, 'colsova', '2.4.1');
    const validated = await validator.validateDirectory(root, true);
    const config = structuredClone(validated.defaultConfig) as any;
    config.sourceWebsite.title = '</script><b>&\u2028\u2029';
    const first = await compiler.compileDirectory(root, config);
    const second = await compiler.compileDirectory(root, config);
    expect(second).toEqual(first);
    expect(first.html).not.toContain('</script><b>');
    expect(first.html).toContain('\\u003c/script\\u003e\\u003cb\\u003e\\u0026\\u2028\\u2029');
    expect(first.html.match(/id="template-config"/g)).toHaveLength(1);
  });

  it('exposes runtime-ready beauty themes for selection and global default', () => {
    for (const slug of ['aurea', 'luce']) {
      const item = getTemplateRegistration(slug, '1.2.0');
      expect(item).toMatchObject({ format: 'modular', runtimeAdapterStatus: 'ready', visible: true, preview: true, download: true, selectableForProposal: true, selectableForImport: true, defaultCandidate: true });
    }
    expect(latestTemplateRegistration('colsova')).toMatchObject({ version: '2.4.1', format: 'modular', runtimeAdapterStatus: 'ready', selectableForProposal: true, selectableForImport: true, defaultCandidate: true });
    expect(SITE_PROPOSAL_TEMPLATE_REGISTRY.filter((item) => item.isLatest)).toHaveLength(3);
  });

  it('contains no inline theme CSS, application JS, missing asset or duplicate bytes', async () => {
    for (const theme of THEMES) {
      const value = await validator.validateDirectory(path.join(ROOT, theme.slug, theme.version), true);
      const html = value.template.toString('utf8');
      expect((html.match(/<style\b/gi) || [])).toHaveLength(0);
      expect((html.match(/<script\b/gi) || [])).toHaveLength(2);
      expect(html).not.toMatch(/data:image\/(?:webp|png|jpe?g|svg\+xml);base64/i);
      const assets = value.modularPackage!.assetInventory;
      expect(new Set(assets.map((asset) => asset.sha256)).size).toBe(assets.length);
      expect(assets.every((asset) => fs.existsSync(path.join(ROOT, theme.slug, theme.version, ...asset.path.split('/'))))).toBe(true);
    }
  });
});
