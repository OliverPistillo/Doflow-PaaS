import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';

const SOURCE = path.join(__dirname, 'site-proposal-templates', 'aurea', '1.2.0');

describe('modular theme package negative validation', () => {
  const validator = new TenantSiteProposalsThemePackageService();

  async function rejected(mutate: (root: string) => void) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doflow-modular-negative-'));
    fs.cpSync(SOURCE, root, { recursive: true });
    try {
      mutate(root);
      await expect(validator.validateDirectory(root, false)).rejects.toBeDefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  const readManifest = (root: string) => JSON.parse(fs.readFileSync(path.join(root, 'theme.json'), 'utf8'));
  const writeManifest = (root: string, manifest: unknown) => fs.writeFileSync(path.join(root, 'theme.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const replace = (root: string, file: string, pattern: string | RegExp, value: string) => {
    const absolute = path.join(root, ...file.split('/'));
    fs.writeFileSync(absolute, fs.readFileSync(absolute, 'utf8').replace(pattern, value));
  };

  it('rejects a missing manifest', () => rejected((root) => fs.unlinkSync(path.join(root, 'theme.json'))));
  it('rejects invalid manifest JSON', () => rejected((root) => fs.writeFileSync(path.join(root, 'theme.json'), '{')));
  it('rejects prototype-pollution keys', () => rejected((root) => replace(root, 'theme.json', /^\{/, '{"__proto__":{"polluted":true},')));
  it('rejects traversal entry paths', () => rejected((root) => { const manifest=readManifest(root); manifest.entry='../template.html'; writeManifest(root,manifest); }));
  it('rejects a missing CSS entry', () => rejected((root) => fs.unlinkSync(path.join(root, 'styles', 'theme.css'))));
  it('rejects a missing JavaScript entry', () => rejected((root) => fs.unlinkSync(path.join(root, 'scripts', 'theme.js'))));
  it('rejects a missing declared asset', () => rejected((root) => { const manifest=readManifest(root); const asset=Object.values(manifest.assetMap)[0] as any; fs.unlinkSync(path.join(root,...asset.path.split('/'))); }));
  it('rejects an asset hash mismatch', () => rejected((root) => { const manifest=readManifest(root); (Object.values(manifest.assetMap)[0] as any).sha256='0'.repeat(64); writeManifest(root,manifest); }));
  it('rejects an asset MIME mismatch', () => rejected((root) => { const manifest=readManifest(root); (Object.values(manifest.assetMap)[0] as any).mime='image/png'; writeManifest(root,manifest); }));
  it('rejects an empty asset', () => rejected((root) => { const manifest=readManifest(root); const asset=Object.values(manifest.assetMap)[0] as any; fs.writeFileSync(path.join(root,...asset.path.split('/')),Buffer.alloc(0)); }));
  it('rejects CSS imports', () => rejected((root) => replace(root,'styles/theme.css',/^/,'@import "local.css";\n')));
  it('rejects remote CSS URLs', () => rejected((root) => replace(root,'styles/theme.css',/^/,'body{background:url(https://example.invalid/a.png)}\n')));
  it.each(['fetch("/x")','navigator.sendBeacon("/x","")','new EventSource("/x")'])('rejects network JavaScript: %s', (primitive) => rejected((root) => replace(root,'scripts/theme.js',/^/,`${primitive};\n`)));
  it('rejects an open CSP', () => rejected((root) => replace(root,'template.html',"connect-src 'none'","connect-src 'none' https:")));
  it('rejects inline event handlers', () => rejected((root) => replace(root,'template.html','<body','<body onclick="void 0"')));
  it('rejects external form actions', () => rejected((root) => replace(root,'template.html','<body','<body><form action="https://example.invalid">')));
  it('rejects an unknown content profile', () => rejected((root) => { const manifest=readManifest(root); manifest.contentProfile='future-profile'; writeManifest(root,manifest); }));
  it('does not trust an uploaded runtime-ready declaration', () => rejected((root) => { const manifest=readManifest(root); manifest.runtimeAdapterStatus='ready'; writeManifest(root,manifest); }));
});
