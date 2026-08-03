import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { COLSOVA_TEMPLATE } from './tenant-site-proposals.constants';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const TEMPLATE_PATH = path.join(__dirname, 'site-proposal-templates', 'colsova', '1.0.0', 'template.html');

function splitTemplate(html: string) {
  const matches = [...html.matchAll(SCRIPT_RE)];
  if (matches.length !== 1) throw new Error('template-config count');
  const match = matches[0];
  const payloadStart = match.index! + match[0].indexOf(match[1]);
  const payloadEnd = payloadStart + match[1].length;
  return { matches, config: JSON.parse(match[1]), prefix: html.slice(0, payloadStart), suffix: html.slice(payloadEnd) };
}

describe('TenantSiteProposalsTemplateService', () => {
  let service: TenantSiteProposalsTemplateService;

  beforeEach(() => {
    service = new TenantSiteProposalsTemplateService();
  });

  it('uses the canonical white-label template and its real config structure', () => {
    const bytes = fs.readFileSync(TEMPLATE_PATH);
    const html = bytes.toString('utf8');
    const parsed = splitTemplate(html);
    expect(bytes).toHaveLength(102989);
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(COLSOVA_TEMPLATE.sourceSha256);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.config.template.name).toBe('White-label Medicina Estetica');
    expect(parsed.config.editingContract.fixedCounts).toEqual({ treatmentCards: 3, productPoints: 3, reviews: 6, faqs: 6 });
    expect(Array.isArray(parsed.config.palette)).toBe(true);
    expect(Object.keys(parsed.config.images)).toEqual(['logo', 'hero', 'consultation', 'products', 'review1', 'review2', 'review3', 'review4', 'review5', 'review6']);
    expect(parsed.config.content.treatments.cards).toHaveLength(3);
    expect(parsed.config.content.products.points).toHaveLength(3);
    expect(parsed.config.content.reviews.items).toHaveLength(6);
    expect(parsed.config.content.faq.items).toHaveLength(6);
    expect(parsed.config.routing.paths).toBeDefined();
    expect(parsed.config.routing.labels).toBeDefined();
    expect(parsed.config.textLimits).toBeDefined();
  });

  it('contains no data from the obsolete customer snapshot', () => {
    const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const obsoleteTerms = [
      ['Ele', 'na'].join(''),
      ['Kolt', 'sova'].join(''),
      ['ele', 'na', 'kolt', 'sova.it'].join(''),
      ['Via del', ' Fante'].join(''),
      ['Reggio', ' Emilia'].join(''),
      ['345 463', ' 2086'].join(''),
      ['data:image/', 'webp;base64'].join(''),
    ];
    for (const term of obsoleteTerms) {
      expect(html.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('publishes Tema Colsova without mutating the canonical base config', async () => {
    const canonical = splitTemplate(fs.readFileSync(TEMPLATE_PATH, 'utf8')).config;
    const config = await service.getDefaultConfig();
    const manifest = await service.getManifest();
    expect(canonical.template.name).toBe('White-label Medicina Estetica');
    expect(config.template).toMatchObject({ name: 'Tema Colsova', templateVersion: '1.0.0', schemaVersion: '1.0', layoutLocked: true });
    expect((config.routing as any).localPreviewMode).toBe(true);
    expect(manifest).toMatchObject({ name: 'Tema Colsova', slug: 'colsova', version: '1.0.0', schemaVersion: '1.0', sourceSha256: COLSOVA_TEMPLATE.sourceSha256 });
    expect(manifest.fixedCounts).toEqual({ treatmentCards: 3, productPoints: 3, reviews: 6, faqs: 6 });
    expect(manifest.imageSlots).toEqual(['logo', 'hero', 'consultation', 'products', 'review1', 'review2', 'review3', 'review4', 'review5', 'review6']);
    expect(manifest.routes).toContain('bookingPage');
    expect(Object.keys(manifest.textLimits).length).toBeGreaterThan(0);
  });

  it('replaces only the JSON payload, escapes XSS, and does not mutate its input', async () => {
    const original = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const originalParts = splitTemplate(original);
    const config = await service.getDefaultConfig();
    config.template = { ...(config.template as object), name: 'Override vietato' };
    (config.content as any).hero.description = '</script><img src=x>\u2028\u2029&';
    const rendered = await service.renderHtml(config);
    const renderedParts = splitTemplate(rendered.html);
    expect(renderedParts.prefix).toBe(originalParts.prefix);
    expect(renderedParts.suffix).toBe(originalParts.suffix);
    expect(renderedParts.config.template.name).toBe('Tema Colsova');
    expect((config.template as any).name).toBe('Override vietato');
    expect(rendered.html).toContain('\\u003c/script\\u003e');
    expect(rendered.html).toContain('\\u2028');
    expect(rendered.html).toContain('\\u2029');
    expect(rendered.html).toContain('\\u0026');
  });

  it('rejects missing/duplicated nodes, invalid counts, palette and dangerous routes', async () => {
    const config = await service.getDefaultConfig();
    (service as any).templateCache = Promise.resolve({ html: '<html></html>', config, sha256: 'x', manifest: {} });
    await expect(service.renderHtml(config)).rejects.toThrow(BadRequestException);
    (service as any).templateCache = Promise.resolve({ html: '<script id="template-config" type="application/json">{}</script><script id="template-config" type="application/json">{}</script>', config, sha256: 'x', manifest: {} });
    await expect(service.renderHtml(config)).rejects.toThrow(BadRequestException);

    const badCount = await new TenantSiteProposalsTemplateService().getDefaultConfig();
    (badCount.content as any).reviews.items.pop();
    await expect(new TenantSiteProposalsTemplateService().renderHtml(badCount)).rejects.toThrow(BadRequestException);
    const badPalette = await new TenantSiteProposalsTemplateService().getDefaultConfig();
    (badPalette.palette as any[])[0].value = 'url(javascript:alert(1))';
    await expect(new TenantSiteProposalsTemplateService().renderHtml(badPalette)).rejects.toThrow(BadRequestException);
    const badRoute = await new TenantSiteProposalsTemplateService().getDefaultConfig();
    (badRoute.routing as any).paths.bookingPage = '../secret';
    await expect(new TenantSiteProposalsTemplateService().renderHtml(badRoute)).rejects.toThrow(BadRequestException);
  });

  it('builds interpolated safe redirects and rejects path traversal', async () => {
    const config = await service.getDefaultConfig();
    (config.business as any).citySlug = 'roma';
    const redirects = await service.buildRedirectFiles(config);
    expect(redirects.some((r) => r.path === 'medicina-estetica-roma-contatti/index.html')).toBe(true);
    (config.routing as any).paths.bookingPage = '../secret';
    await expect(service.buildRedirectFiles(config)).rejects.toThrow(BadRequestException);
  });

  it('creates a public ZIP entry list without internal commercial data', async () => {
    const artifact = new TenantSiteProposalsArtifactService();
    const zip = await artifact.createZip('<!doctype html><title>Demo</title>', [{ path: 'prenota/index.html', html: '<html></html>' }]);
    expect(zip.entries).toContain('index.html');
    expect(zip.entries).toContain('README-ANTEPRIMA.txt');
    expect(zip.entries).toContain('prenota/index.html');
    expect(zip.buffer.length).toBeGreaterThan(100);
    expect(zip.entries.join('|')).not.toContain('email');
    expect(zip.entries.join('|')).not.toContain('commercial');
  });
});
