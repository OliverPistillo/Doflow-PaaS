import { TenantSiteProposalsLogoGeneratorService } from './tenant-site-proposals-logo-generator.service';
import { TenantSiteProposalsPreparationCoreService } from './tenant-site-proposals-preparation-core.service';

const input = {
  businessName: 'Centro Aurora Demo', descriptor: 'Benessere professionale',
  palette: { ink: '#172033', gold: '#9b6b35' }, contentProfile: 'beauty-editorial-v1' as const, fingerprint: 'prospect-a',
};

describe('deterministic proposal SVG logo generator', () => {
  const generator = new TenantSiteProposalsLogoGeneratorService();

  it('creates default and light self-contained SVG wordmarks', () => {
    const result = generator.generate(input);
    for (const logo of [result.defaultLogo, result.lightLogo]) {
      expect(logo).toMatchObject({ sourceMethod: 'generated', mime: 'image/svg+xml', width: 960, height: 240, alt: 'Logo Centro Aurora Demo' });
      expect(logo.size).toBe(logo.bytes.length);
      expect(logo.dataUri).toBe(`data:image/svg+xml;base64,${logo.bytes.toString('base64')}`);
      expect(Buffer.from(logo.dataUri.split(',')[1], 'base64').equals(logo.bytes)).toBe(true);
      const svg = logo.bytes.toString('utf8');
      expect(svg).toContain('<svg'); expect(svg).toContain('Centro Aurora Demo'); expect(svg).toContain('CAD');
      expect(svg).not.toMatch(/<script|<foreignObject|\son\w+=|javascript:|<animate|<use\b[^>]+(?:href|xlink:href)=/i);
      expect(svg).not.toMatch(/(?:src|href)=["']https?:/i);
    }
    expect(result.defaultLogo.bytes.equals(result.lightLogo.bytes)).toBe(false);
  });

  it('is byte-identical for identical input and changes with identity', () => {
    const first = generator.generate(input); const second = generator.generate(input);
    expect(second.defaultLogo.bytes.equals(first.defaultLogo.bytes)).toBe(true);
    expect(second.lightLogo.bytes.equals(first.lightLogo.bytes)).toBe(true);
    expect(second.defaultLogo.sha256).toBe(first.defaultLogo.sha256);
    expect(generator.generate({ ...input, businessName: 'Studio Luce' }).defaultLogo.sha256).not.toBe(first.defaultLogo.sha256);
  });

  it.each([
    ['Centro Aurora Demo', 'CAD'], ['Studio Luce', 'SL'], ['Dott.ssa Maria Rossi', 'MR'],
    ["L'Atelier d’Élite", 'LAD'], ['Àccenti & <Segni>', 'AS'],
  ])('normalizes initials and XML-escapes %s', (businessName, expected) => {
    const result = generator.generate({ ...input, businessName }); const svg = result.defaultLogo.bytes.toString('utf8');
    expect(result.metadata.initials).toBe(expected); expect(svg).not.toContain('<Segni>');
  });

  it('caps long text, supports no descriptor, and rejects an empty name', () => {
    const long = generator.generate({ ...input, businessName: 'A'.repeat(120), descriptor: undefined });
    expect(long.defaultLogo.bytes.toString('utf8')).toContain('A'.repeat(80));
    expect(long.defaultLogo.bytes.toString('utf8')).not.toContain('A'.repeat(81));
    expect(() => generator.generate({ ...input, businessName: '\u0000  ' })).toThrow('Nome attività non valido');
  });

  it('ignores invalid palette values and keeps explicit high-contrast colors', () => {
    const result = generator.generate({ ...input, palette: { ink: 'url(https://bad.example)', accent: 'currentColor', unsafe: '#zzzzzz' } });
    const defaultSvg = result.defaultLogo.bytes.toString('utf8'); const lightSvg = result.lightLogo.bytes.toString('utf8');
    expect(defaultSvg).not.toContain('url('); expect(defaultSvg).not.toContain('currentColor');
    expect(defaultSvg).toMatch(/#[0-9A-F]{6}/i); expect(lightSvg).toContain('#FFFFFF');
  });
});

describe('proposal logo priority', () => {
  const canonical: any = { businessName: 'Studio Priorità', descriptor: 'Wellness', services: [], brands: [], extra: {} };
  const base: any = { palette: { ink: '#172033', gold: '#9b6b35' } };
  function core(generate = jest.fn(() => new TenantSiteProposalsLogoGeneratorService().generate({ ...input, businessName: canonical.businessName }))) {
    const empty = {} as any;
    return { service: new TenantSiteProposalsPreparationCoreService(empty, empty, empty, empty, empty, empty, empty, empty, { generate } as any), generate };
  }

  it('preserves a valid manual logo without calling the generator', () => {
    const value = core(); canonical.logoUrl = 'https://assets.example/logo.svg';
    const resolved = (value.service as any).resolveLogoAssets(canonical, {}, { logoDefault: 'https://site.example/extracted.webp' }, base, 'beauty-editorial-v1', []);
    expect(resolved).toMatchObject({ logoDefault: canonical.logoUrl, logoLight: canonical.logoUrl, sourceMethod: 'manual' }); expect(value.generate).not.toHaveBeenCalled();
    delete canonical.logoUrl;
  });

  it('preserves a valid extracted logo without calling the generator', () => {
    const value = core();
    const resolved = (value.service as any).resolveLogoAssets(canonical, {}, { logoDefault: 'data:image/webp;base64,QUJD', logoLight: 'data:image/webp;base64,REVG' }, base, 'beauty-editorial-v1', []);
    expect(resolved).toMatchObject({ sourceMethod: 'extracted', logoDefault: 'data:image/webp;base64,QUJD' }); expect(value.generate).not.toHaveBeenCalled();
  });

  it('generates both variants when no valid logo exists', () => {
    const value = core(); const resolved = (value.service as any).resolveLogoAssets(canonical, {}, {}, base, 'beauty-editorial-v1', []);
    expect(resolved).toMatchObject({ sourceMethod: 'generated', logoSource: 'generated' });
    expect(resolved.logoDefault).toMatch(/^data:image\/svg\+xml;base64,/); expect(resolved.logoLight).toMatch(/^data:image\/svg\+xml;base64,/); expect(value.generate).toHaveBeenCalledTimes(1);
  });

  it('uses a sanitized text fallback when controlled generation fails', () => {
    const warnings: string[] = []; const value = core(jest.fn(() => { throw new Error('controlled'); }));
    const resolved = (value.service as any).resolveLogoAssets(canonical, {}, {}, base, 'beauty-editorial-v1', warnings);
    expect(resolved).toMatchObject({ logoDefault: '', logoLight: '', sourceMethod: 'text-fallback' }); expect(warnings.join(' ')).not.toContain('controlled');
  });
});
