import { BadRequestException } from '@nestjs/common';
import { TenantSiteProposalsCsvService } from './tenant-site-proposals-csv.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

describe('TenantSiteProposalsCsvService', () => {
  let service: TenantSiteProposalsCsvService;
  let defaultConfig: any;

  beforeEach(async () => {
    service = new TenantSiteProposalsCsvService();
    defaultConfig = await new TenantSiteProposalsTemplateService().getDefaultConfig();
  });

  it('parses UTF-8 BOM and comma CSV', () => {
    const parsed = service.parseCsvText('\uFEFFbusiness_name,city\nStudio Demo,Roma\n');
    expect(parsed.rows[0].business_name).toBe('Studio Demo');
  });

  it('autodetects semicolon and tab delimiters', () => {
    expect(service.parseCsvText('business_name;city\nStudio;Roma').delimiter).toBe(';');
    expect(service.parseCsvText('business_name\tcity\nStudio\tRoma').delimiter).toBe('\t');
  });

  it('supports quoted commas, escaped quotes, multiline fields and CRLF', () => {
    const parsed = service.parseCsvText('business_name,notes\r\n"Studio, Demo","riga ""uno""\nseconda"\r\n');
    expect(parsed.rows[0].business_name).toBe('Studio, Demo');
    expect(parsed.rows[0].notes).toContain('"uno"');
    expect(parsed.rows[0].notes).toContain('seconda');
  });

  it('ignores blank rows and suffixes duplicate headers', () => {
    const parsed = service.parseCsvText('business_name,business_name\nStudio,Altro\n\n');
    expect(parsed.headers).toEqual(['business_name', 'business_name_2']);
    expect(parsed.rows).toHaveLength(1);
  });

  it('rejects malformed CSV and limits', () => {
    expect(() => service.parseCsvText('business_name\n"Studio')).toThrow(BadRequestException);
    expect(() => service.parseCsvText(`business_name\n${'a'.repeat(20_001)}`)).toThrow(BadRequestException);
    const rows = Array.from({ length: 51 }, (_, i) => `Studio ${i}`).join('\n');
    expect(() => service.parseCsvText(`business_name\n${rows}`)).toThrow(BadRequestException);
  });

  it('normalizes Italian aliases and preserves unknown columns', () => {
    const row = service.normalizeRow({ nome_attivita: 'Studio Demo', città: 'Roma', settore: 'wellness', sconosciuta: 'valore' });
    expect(row.businessName).toBe('Studio Demo');
    expect(row.city).toBe('Roma');
    expect(row.category).toBe('wellness');
    expect(row.extra.sconosciuta).toBe('valore');
  });

  it('parses services with semicolon, pipe, newline and JSON array without splitting commas', () => {
    expect(service.normalizeRow({ business_name: 'A', services: 'Uno;Due|Tre\nQuattro' }).services).toEqual(['Uno', 'Due', 'Tre', 'Quattro']);
    expect(service.normalizeRow({ business_name: 'A', services: '["Uno, descrizione","Due"]' }).services).toEqual(['Uno, descrizione', 'Due']);
  });

  it('rejects prototype pollution headers', () => {
    expect(() => service.parseCsvText('__proto__,business_name\nx,A')).toThrow(BadRequestException);
  });

  it('marks duplicate rows inside a batch', () => {
    const parsed = service.parseCsvText('business_name,email\nStudio,info@example.it\nStudio,info@example.it');
    const preview = service.buildPreviewRows(parsed.rows, defaultConfig);
    expect(preview[0].valid).toBe(true);
    expect(preview[1].valid).toBe(false);
    expect(preview[1].errors[0].code).toBe('DUPLICATE_ROW');
  });

  it('builds a valid SiteConfig with warnings and fixed counts', () => {
    const row = service.normalizeRow({ business_name: 'Nome Molto Lungo Per Layout', category: 'concessionaria moto', services: 'Servizio 1;Servizio 2' });
    const warnings: any[] = [];
    const config = service.buildSiteConfig(defaultConfig, row, warnings);
    expect((config.content as any).treatments.cards).toHaveLength(3);
    expect((config.content as any).products.points).toHaveLength(3);
    expect((config.content as any).reviews.items).toHaveLength(6);
    expect((config.content as any).faq.items).toHaveLength(6);
    expect((config.images as any).review6.placeholderLabel).toBe('CLIENTE 06');
    expect((config.template as any).name).toBe('Tema Colsova');
    expect(warnings.some((w) => w.code === 'TEXT_ABBREVIATED')).toBe(true);
    expect(warnings.some((w) => w.code === 'TEMPLATE_CATEGORY_MISMATCH')).toBe(true);
  });

  it('updates a real palette array without changing order or roles', () => {
    const row = service.normalizeRow({ business_name: 'Studio Demo', primary_color: '#123456' });
    const original = defaultConfig.palette.map((entry: any) => ({ variable: entry.variable, role: entry.role }));
    const config = service.buildSiteConfig(defaultConfig, row);
    expect((config.palette as any[]).find((entry: any) => entry.variable === '--gold').value).toBe('#123456');
    expect((config.palette as any[]).map((entry: any) => ({ variable: entry.variable, role: entry.role }))).toEqual(original);
    expect(defaultConfig.palette.find((entry: any) => entry.variable === '--gold').value).toBe('#AD8147');
  });

  it('rejects unknown palette variables and dangerous CSS values', () => {
    const unknown = service.normalizeRow({ business_name: 'Studio Demo', palette_json: '{"--unknown":"#fff"}' });
    expect(() => service.buildSiteConfig(defaultConfig, unknown)).toThrow(BadRequestException);
    const dangerous = service.normalizeRow({ business_name: 'Studio Demo', palette_json: '{"--gold":"url(javascript:alert(1))"}' });
    expect(() => service.buildSiteConfig(defaultConfig, dangerous)).toThrow(BadRequestException);
  });

  it.each([
    ['treatment_cards_json', 4],
    ['product_points_json', 2],
    ['reviews_json', 5],
    ['faqs_json', 7],
  ])('rejects invalid fixed count in %s', (field, count) => {
    expect(() => {
      const row = service.normalizeRow({ business_name: 'Studio Demo', [field]: JSON.stringify(Array.from({ length: count }, () => ({}))) });
      service.buildSiteConfig(defaultConfig, row);
    }).toThrow(BadRequestException);
  });
});
