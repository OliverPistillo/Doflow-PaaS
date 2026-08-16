import * as fs from 'fs';
import * as path from 'path';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';

const ROOT = path.join(__dirname, 'site-proposal-templates', 'colsova', '2.4.1');
const TEMPLATE = path.join(ROOT, 'template.html');
const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;

describe('Tema Colsova 2.4.1 package', () => {
  const files = ['template.html', 'theme.json', 'README.md', 'NOTE-REVISIONE.md', 'ASSET-CREDITS.md'];
  let html: string;
  let config: any;
  beforeAll(async () => {
    const source = fs.readFileSync(TEMPLATE, 'utf8');
    config = JSON.parse([...source.matchAll(SCRIPT_RE)][0][1]);
    html = (await new TenantSiteProposalsThemeCompilerService().compileDirectory(ROOT)).html;
  });

  it('contains the modular source files and preserved documentation', () => { for (const file of files) expect(fs.existsSync(path.join(ROOT,file))).toBe(true); for (const directory of ['styles','scripts','assets/images','assets/icons']) expect(fs.statSync(path.join(ROOT,directory)).isDirectory()).toBe(true); });
  it('preserves the exact standalone provenance', () => { const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme.json'), 'utf8')); expect(manifest.provenance).toMatchObject({sourceTemplateSha256:'395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263',sourceTemplateSize:2276156}); });
  it('contains one template-config', () => expect([...html.matchAll(SCRIPT_RE)]).toHaveLength(1));
  it('has the exact modular manifest identity and categories', () => { const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'theme.json'), 'utf8')); expect(manifest).toMatchObject({ name: 'Tema Colsova', slug: 'colsova', version: '2.4.1', schemaVersion: '2.0', contractVersion: '2.1', format:'modular', entry: 'template.html', runtimeAdapterStatus:'ready' }); expect(manifest.categories).toEqual(['beauty', 'wellness', 'lead-generation']); });
  it('declares all exact fixed counts', () => expect(config.editingContract.fixedCounts).toEqual({ services: 3, reviews: 6, faqs: 6, trustItems: 4, consultationHighlights: 3, processSteps: 3 }));
  it('contains the exact conversion collections', () => { expect(config.content.services).toHaveLength(3); expect(config.content.reviews).toHaveLength(6); expect(config.content.faq).toHaveLength(6); expect(config.content.trust.items).toHaveLength(4); expect(config.content.consultation.highlights).toHaveLength(3); expect(config.content.process.steps).toHaveLength(3); });
  it('declares the five required image slots', () => expect(Object.keys(config.images)).toEqual(['logoDefault', 'logoLight', 'hero', 'consultation', 'feature']));
  it('uses the conversion palette instead of the basic V2 palette', () => expect(Object.keys(config.palette)).toEqual(['ink', 'inkSoft', 'muted', 'ivory', 'cream', 'sand', 'sandSoft', 'gold', 'goldDeep', 'white']));
  it('supports the required feature flags and page modes', () => { expect(config.features).toMatchObject({ showProducts: expect.any(Boolean), showAccount: expect.any(Boolean), showCart: expect.any(Boolean), showReviews: expect.any(Boolean), showFaq: expect.any(Boolean), showContactForm: expect.any(Boolean), showMobileCta: expect.any(Boolean), reviewsMode: 'demo' }); expect(['homepage', 'landing']).toContain(config.personalization.pageMode); });
  it('preserves demonstrative reviews and the visible disclaimer', () => { expect(config.features.reviewsMode).toBe('demo'); expect(config.content.reviewsIntro.disclaimer).toMatch(/Recensioni dimostrative/i); expect(html).toContain('Recensioni dimostrative'); });
  it('keeps the demo form local and intercepted', () => { expect(html).toMatch(/<form\b/i); expect(html).toMatch(/preventDefault\s*\(/); expect(html).toMatch(/modalit[aà]\s+demo|demo[^<]{0,80}non invia/i); expect(html).not.toMatch(/<form\b[^>]*action=["']https?:/i); });
  it('has restrictive indexing and CSP with no external executable resources', () => { expect(html).toMatch(/noindex,nofollow,noarchive/i); for (const directive of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'"]) expect(html).toContain(directive); expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i); expect(html).not.toMatch(/<link\b[^>]*rel=["'][^"']*stylesheet/i); });
  it('contains no forbidden runtime primitives', () => { expect(html).not.toMatch(/\beval\s*\(|new\s+Function\b|document\.write\s*\(|\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\blocalStorage\b|\bsessionStorage\b/i); });
  it('keeps the doflow developer URL and contains no known prospect PII', () => { expect(config.business.developerUrl).toMatch(/^https:\/\/[^\s]*doflow/i); expect(html.toLowerCase()).not.toMatch(/elena\s*koltsova|345\s*463\s*2086/); });
});
