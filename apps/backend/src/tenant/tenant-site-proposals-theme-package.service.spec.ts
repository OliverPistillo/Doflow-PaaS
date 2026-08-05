import { BadRequestException } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import * as path from 'path';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { sha256 } from './tenant-site-proposals-validation';

async function zip(files: Record<string, Buffer | string>) {
  const output = new PassThrough(); const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const archive = archiver('zip', { zlib: { level: 9 } }); archive.on('error', (error) => output.destroy(error)); archive.pipe(output);
  for (const [name, value] of Object.entries(files)) archive.append(value, { name });
  await archive.finalize(); return done;
}
async function zipWithSymlink() {
  const output = new PassThrough(); const chunks: Buffer[] = []; output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
  const archive = archiver('zip'); archive.on('error', (error) => output.destroy(error)); archive.pipe(output); for (const [name, value] of Object.entries(basicPackage())) archive.append(value, { name }); archive.symlink('linked.md', 'README.md'); await archive.finalize(); return done;
}

function basicPackage(root = '') {
  const config: any = { template: { name: 'Tema test', slug: 'tema-test', schemaVersion: '2.0', templateVersion: '1.0.0', layoutLocked: true }, editingContract: { contractVersion: '2.0', fixedCounts: { services: 3, trustItems: 6, faqs: 6 } }, images: Object.fromEntries(['logoDefault', 'logoLight', 'hero', 'consultation', 'feature'].map((key) => [key, {}])), content: { hero: {}, approach: {}, services: [{}, {}, {}], benefits: {}, trustItems: [{}, {}, {}, {}, {}, {}], faq: [{}, {}, {}, {}, {}, {}], contact: {}, footer: {} } };
  const html = `<!doctype html><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><script id="template-config" type="application/json">${JSON.stringify(config)}</script>`;
  const manifest: any = { name: 'Tema test', slug: 'tema-test', version: '1.0.0', schemaVersion: '2.0', contractVersion: '2.0', entry: 'template.html', standalone: true, templateSha256: sha256(Buffer.from(html)), size: Buffer.byteLength(html), categories: ['lead-generation'], contentProfile: 'proposal-basic-v2' };
  return { [`${root}template.html`]: html, [`${root}theme.json`]: JSON.stringify(manifest), [`${root}README.md`]: 'Documentazione' };
}

describe('theme ZIP package validator', () => {
  const service = new TenantSiteProposalsThemePackageService();
  it('accepts a valid package', async () => expect(service.validate(await zip(basicPackage()))).resolves.toMatchObject({ contentProfile: 'proposal-basic-v2', validationReport: { valid: true } }));
  it('accepts one optional root folder', async () => expect(service.validate(await zip(basicPackage('tema-test/')))).resolves.toMatchObject({ contentProfile: 'proposal-basic-v2' }));
  it('accepts the modular Colsova built-in package', async () => {
    const root = path.join(__dirname, 'site-proposal-templates', 'colsova', '2.4.1');
    const value = await service.validateDirectory(root, true);
    expect(value).toMatchObject({ contentProfile: 'colsova-conversion-v1', format: 'modular', modularPackage: { manifest: { provenance: { sourceTemplateSha256: '395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263', sourceTemplateSize: 2276156 } } } });
  });
  it.each([
    ['manifest missing', () => { const files = basicPackage(); delete files['theme.json']; return files; }],
    ['template missing', () => { const files = basicPackage(); delete files['template.html']; return files; }],
    ['executable file', () => ({ ...basicPackage(), 'payload.js': 'x' })],
    ['non-document file', () => ({ ...basicPackage(), 'asset.bin': 'x' })],
  ])('rejects %s', async (_name, make) => expect(service.validate(await zip(make()))).rejects.toBeInstanceOf(BadRequestException));
  it('rejects a wrong manifest hash', async () => { const files = basicPackage(); const manifest = JSON.parse(String(files['theme.json'])); manifest.templateSha256 = '0'.repeat(64); files['theme.json'] = JSON.stringify(manifest); await expect(service.validate(await zip(files))).rejects.toThrow(/Hash template/); });
  it('rejects a wrong manifest size', async () => { const files = basicPackage(); const manifest = JSON.parse(String(files['theme.json'])); manifest.size += 1; files['theme.json'] = JSON.stringify(manifest); await expect(service.validate(await zip(files))).rejects.toThrow(/Dimensione template/); });
  it('rejects an unknown content profile', async () => { const files = basicPackage(); const manifest = JSON.parse(String(files['theme.json'])); manifest.contentProfile = 'unknown'; files['theme.json'] = JSON.stringify(manifest); await expect(service.validate(await zip(files))).rejects.toThrow(/Content profile/); });
  it('infers a recognized profile when omitted', async () => { const files = basicPackage(); const manifest = JSON.parse(String(files['theme.json'])); delete manifest.contentProfile; files['theme.json'] = JSON.stringify(manifest); const value = await service.validate(await zip(files)); expect(value.warnings[0]).toMatch(/inferito/); });
  it('rejects duplicate template-config nodes', async () => { const files = basicPackage(); const html = String(files['template.html']).replace('</script>', '</script><script id="template-config" type="application/json">{}</script>'); files['template.html'] = html; const manifest = JSON.parse(String(files['theme.json'])); manifest.templateSha256 = sha256(Buffer.from(html)); manifest.size = Buffer.byteLength(html); files['theme.json'] = JSON.stringify(manifest); await expect(service.validate(await zip(files))).rejects.toThrow(/esattamente un template-config/); });
  it.each([
    ['external script', '<script src="https://example.com/x.js"></script>'], ['external CSS', '<link rel="stylesheet" href="https://example.com/x.css">'], ['iframe', '<iframe></iframe>'], ['object', '<object></object>'], ['embed', '<embed>'], ['meta refresh', '<meta http-equiv="refresh" content="1">'], ['base href', '<base href="/">'], ['event handler', '<button onclick="x()">x</button>'], ['eval', '<script>eval("x")</script>'], ['fetch', '<script>fetch("x")</script>'],
  ])('rejects %s', (_name, fragment) => expect(() => (service as any).validateTemplateSecurity(`${String(basicPackage()['template.html'])}${fragment}`)).toThrow(BadRequestException));
  it('rejects an external form action', () => expect(() => (service as any).validateTemplateSecurity(`${String(basicPackage()['template.html'])}<form action="https://example.com"></form>`)).toThrow(/Form action/));
  it('rejects insufficient CSP', () => expect(() => (service as any).validateTemplateSecurity(String(basicPackage()['template.html']).replace("connect-src 'none'", 'connect-src https:'))).toThrow(/CSP insufficiente/));
  it.each([
    ["connect-src 'none' https:", (html: string) => html.replace("connect-src 'none'", "connect-src 'none' https:")],
    ["connect-src https: 'none'", (html: string) => html.replace("connect-src 'none'", "connect-src https: 'none'")],
    ["default-src 'none' https:", (html: string) => html.replace("default-src 'none'", "default-src 'none' https:")],
    ['duplicate directive', (html: string) => html.replace("connect-src 'none';", "connect-src 'none'; connect-src 'none';")],
    ['duplicate CSP meta', (html: string) => html.replace('<script id=', `<meta http-equiv="Content-Security-Policy" content="default-src 'none'"> <script id=`)],
    ['direct sendBeacon', (html: string) => `${html}<script>sendBeacon('/x')</script>`],
    ['bracket sendBeacon', (html: string) => `${html}<script>navigator['sendBeacon']('/x')</script>`],
    ['concatenated sendBeacon', (html: string) => `${html}<script>navigator["send" + "Beacon"]('/x')</script>`],
    ['new EventSource', (html: string) => `${html}<script>new EventSource('/x')</script>`],
    ['window EventSource', (html: string) => `${html}<script>window.EventSource('/x')</script>`],
    ['WebTransport', (html: string) => `${html}<script>new WebTransport('/x')</script>`],
    ['bracket XMLHttpRequest', (html: string) => `${html}<script>new window['XMLHttpRequest']()</script>`],
    ['comment-separated fetch', (html: string) => `${html}<script>fetch /* no */ ('/x')</script>`],
    ['dynamic script', (html: string) => `${html}<script>document.createElement('script')</script>`],
    ['dynamic stylesheet', (html: string) => `${html}<script>document.createElement('link')</script>`],
    ['dynamic iframe', (html: string) => `${html}<script>document.createElement('iframe')</script>`],
    ['CSS import', (html: string) => `${html}<style>@import 'local.css';</style>`],
    ['CSS HTTPS', (html: string) => `${html}<style>.x{background:url(https://example.com/x.png)}</style>`],
    ['CSS protocol-relative', (html: string) => `${html}<style>.x{background:url(//example.com/x.png)}</style>`],
    ['hardcoded HTTPS image', (html: string) => `${html}<img src="https://example.com/x.png">`],
    ['hardcoded HTTPS anchor', (html: string) => `${html}<a href="https://example.com/x">x</a>`],
    ["untrusted img-src self", (html: string) => html.replace('img-src data:', "img-src 'self' data:")],
    ['external form', (html: string) => `${html}<form action="https://example.com"></form>`],
    ['meta refresh', (html: string) => `${html}<meta http-equiv="refresh" content="0;url=/x">`],
    ['base href', (html: string) => `${html}<base href="/">`],
    ['javascript URL', (html: string) => `${html}<a href="javascript:void(0)">x</a>`],
  ])('executes the validator against adversarial case %s', (_name, mutate) => expect(() => (service as any).validateTemplateSecurity(mutate(String(basicPackage()['template.html'])))).toThrow(BadRequestException));
  it.each([
    ['schema future', '3.0', '2.0', 'proposal-basic-v2'],
    ['contract future', '2.0', '3.0', 'proposal-basic-v2'],
    ['unsupported combination', '2.0', '2.0', 'colsova-legacy-v1'],
  ])('rejects unsupported package contract %s', async (_name, schemaVersion, contractVersion, contentProfile) => {
    const files = basicPackage(); const manifest = JSON.parse(String(files['theme.json'])); const config = JSON.parse(/<script[^>]*>([\s\S]*?)<\/script>/.exec(String(files['template.html']))![1]);
    manifest.schemaVersion = schemaVersion; manifest.contractVersion = contractVersion; manifest.contentProfile = contentProfile; config.template.schemaVersion = schemaVersion;
    const html = String(files['template.html']).replace(/(<script[^>]*>)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(config)}$2`); manifest.templateSha256 = sha256(Buffer.from(html)); manifest.size = Buffer.byteLength(html); files['template.html'] = html; files['theme.json'] = JSON.stringify(manifest);
    await expect(service.validate(await zip(files))).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects an excessive individual data URI', () => expect(() => (service as any).validateDataUris(`data:image/webp;base64,${'A'.repeat(1024 * 1024 + 1)}`)).toThrow(/Singola data URI/));
  it('rejects a real case-insensitive duplicate archive entry', async () => await expect(service.validate(await zip({ ...basicPackage(), 'readme.MD': 'duplicate' }))).rejects.toThrow(/duplicato case-insensitive/i));
  it('rejects a real symlink archive entry', async () => await expect(service.validate(await zipWithSymlink())).rejects.toThrow(/Symlink/i));
  it('rejects a real hidden archive entry', async () => await expect(service.validate(await zip({ ...basicPackage(), '.hidden.md': 'hidden' }))).rejects.toThrow(/nascosto/i));
  it('rejects a real archive exceeding the file limit', async () => { const files = basicPackage(); for (let index = 0; index < 24; index++) files[`doc-${index}.md`] = 'x'; await expect(service.validate(await zip(files))).rejects.toThrow(/supera 25 file/i); });
  it('rejects a real highly-compressed oversized archive', async () => await expect(service.validate(await zip({ ...basicPackage(), 'large.md': 'A'.repeat(11 * 1024 * 1024) }))).rejects.toThrow(/ZIP bomb|non compresso/i));
});
