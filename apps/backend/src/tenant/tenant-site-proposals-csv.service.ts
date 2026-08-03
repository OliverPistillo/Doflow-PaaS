import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ALLOWED_CSV_MIME_TYPES,
  COLSOVA_TEMPLATE,
  CSV_LIMITS,
} from './tenant-site-proposals.constants';
import { CanonicalProposalInput, JsonObject, PreviewRow, RowIssue } from './tenant-site-proposals.types';
import {
  applyAllowedConfigOverrides,
  applyPaletteOverrides,
  assertNoPrototypePollution,
  buildFingerprint,
  cleanString,
  deepClone,
  forceTemplateContract,
  initialsFor,
  normalizeEmail,
  normalizePhoneHref,
  normalizeSlug,
  normalizeWebsite,
  sha256,
  templateCategoryWarnings,
  validateColor,
  validateImageUrl,
  validateSiteConfig,
  validateWebsiteUrl,
  wordSafeLimit,
} from './tenant-site-proposals-validation';

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
};

const ALIASES: Record<string, keyof CanonicalProposalInput> = {
  business_name: 'businessName',
  businessname: 'businessName',
  nome_attivita: 'businessName',
  nome_attività: 'businessName',
  nome_studio: 'businessName',
  studio_name: 'businessName',
  name: 'businessName',
  professional_title: 'professionalTitle',
  qualifica: 'professionalTitle',
  titolo_professionale: 'professionalTitle',
  descriptor: 'descriptor',
  descrittore: 'descriptor',
  specializzazione: 'descriptor',
  category: 'category',
  categoria: 'category',
  settore: 'category',
  city: 'city',
  citta: 'city',
  città: 'city',
  website_url: 'websiteUrl',
  website: 'websiteUrl',
  sito: 'websiteUrl',
  sito_web: 'websiteUrl',
  email: 'email',
  mail: 'email',
  phone: 'phone',
  telefono: 'phone',
  cellulare: 'phone',
  address: 'address',
  indirizzo: 'address',
  opening_hours: 'openingHours',
  orari: 'openingHours',
  orari_apertura: 'openingHours',
  services: 'services',
  servizi: 'services',
  trattamenti: 'services',
  brands: 'brands',
  brand: 'brands',
  marchi: 'brands',
  social_facebook: 'socialFacebook',
  facebook: 'socialFacebook',
  social_instagram: 'socialInstagram',
  instagram: 'socialInstagram',
  social_tiktok: 'socialTikTok',
  tiktok: 'socialTikTok',
  social_youtube: 'socialYouTube',
  youtube: 'socialYouTube',
  notes: 'notes',
  note: 'notes',
  lead_priority: 'leadPriority',
  priorita: 'leadPriority',
  priorità: 'leadPriority',
  overview: 'overview',
  panoramica: 'overview',
  descrizione_generale: 'overview',
  target_audience: 'targetAudience',
  pubblico: 'targetAudience',
  target: 'targetAudience',
  primary_goal: 'primaryGoal',
  obiettivo: 'primaryGoal',
  obiettivo_principale: 'primaryGoal',
  tone_of_voice: 'toneOfVoice',
  tono_voce: 'toneOfVoice',
  tono: 'toneOfVoice',
  logo_url: 'logoUrl',
  hero_image_url: 'heroImageUrl',
  consultation_image_url: 'consultationImageUrl',
  products_image_url: 'productsImageUrl',
};

const PALETTE_MAP: Record<string, string> = {
  primary_color: '--gold',
  secondary_color: '--ink',
  accent_color: '--gold-deep',
  background_color: '--ivory',
  color_ink: '--ink',
  color_ink_soft: '--ink-soft',
  color_muted: '--muted',
  color_ivory: '--ivory',
  color_cream: '--cream',
  color_sand: '--sand',
  color_sand_soft: '--sand-soft',
  color_gold: '--gold',
  color_gold_deep: '--gold-deep',
  color_white: '--white',
};

@Injectable()
export class TenantSiteProposalsCsvService {
  parseCsvFile(file: Express.Multer.File): ParsedCsv {
    if (!file) throw new BadRequestException('File CSV richiesto');
    if (!String(file.originalname || '').toLowerCase().endsWith('.csv')) throw new BadRequestException('Sono ammessi solo file .csv');
    if (!ALLOWED_CSV_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) throw new BadRequestException('MIME CSV non ammesso');
    if (!file.buffer?.length) throw new BadRequestException('CSV vuoto');
    if (file.buffer.length > CSV_LIMITS.maxBytes) throw new BadRequestException('CSV oltre il limite di 2 MiB');
    return this.parseCsvText(file.buffer.toString('utf8'));
  }

  parseCsvText(text: string): ParsedCsv {
    const input = text.replace(/^\uFEFF/, '');
    if (!input.trim()) throw new BadRequestException('CSV vuoto');
    const firstLine = this.firstSignificantLine(input);
    if (!firstLine) throw new BadRequestException('CSV senza intestazione');
    const delimiter = this.detectDelimiter(firstLine);
    const matrix = this.parseMatrix(input, delimiter);
    while (matrix.length && matrix[matrix.length - 1].every((cell) => !cell.trim())) matrix.pop();
    if (matrix.length < 1) throw new BadRequestException('CSV senza intestazione');
    const rawHeaders = matrix[0];
    if (rawHeaders.length > CSV_LIMITS.maxColumns) throw new BadRequestException('Troppe colonne');
    if (rawHeaders.every((h) => !h.trim())) throw new BadRequestException('Intestazione completamente vuota');
    const headers = this.normalizeHeaders(rawHeaders);
    const rows = matrix.slice(1).filter((row) => row.some((cell) => cell.trim()));
    if (rows.length > CSV_LIMITS.maxRows) throw new BadRequestException('Troppe righe dati');
    return {
      headers,
      delimiter,
      rows: rows.map((row) => {
        const obj = Object.create(null) as Record<string, string>;
        headers.forEach((header, index) => {
          if (['__proto__', 'prototype', 'constructor'].includes(header)) throw new BadRequestException('Header non consentito');
          obj[header] = row[index] ?? '';
        });
        return obj;
      }),
    };
  }

  buildPreviewRows(rows: Record<string, string>[], defaultConfig: JsonObject): PreviewRow[] {
    const seen = new Set<string>();
    return rows.map((row, index) => {
      const errors: RowIssue[] = [];
      const warnings: RowIssue[] = [];
      try {
        const canonical = this.normalizeRow(row, warnings);
        const sourceRowHash = sha256(JSON.stringify(canonical));
        const fingerprint = buildFingerprint(canonical);
        if (seen.has(sourceRowHash)) {
          errors.push({ code: 'DUPLICATE_ROW', message: 'Riga duplicata nello stesso batch.' });
        }
        seen.add(sourceRowHash);
        warnings.push(...templateCategoryWarnings(canonical.category));
        const siteConfig = this.buildSiteConfig(defaultConfig, canonical, warnings);
        return {
          rowIndex: index + 1,
          valid: errors.length === 0,
          errors,
          warnings,
          canonical,
          sourceRowHash,
          fingerprint,
          siteConfig,
          displayName: canonical.businessName,
        };
      } catch (error) {
        errors.push({ code: 'ROW_INVALID', message: error instanceof Error ? error.message : 'Riga non valida' });
        return { rowIndex: index + 1, valid: false, errors, warnings };
      }
    });
  }

  normalizeRow(row: Record<string, string>, warnings: RowIssue[] = []): CanonicalProposalInput {
    const canonical: CanonicalProposalInput = { businessName: '', services: [], brands: [], extra: Object.create(null) };
    const configOverrides: JsonObject = {};
    const paletteOverrides: JsonObject = {};

    for (const [rawKey, rawValue] of Object.entries(row)) {
      const key = this.canonicalHeader(rawKey);
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new BadRequestException('Header non consentito');
      const value = cleanString(rawValue, CSV_LIMITS.maxCellChars);
      if (!value) continue;

      if (key.startsWith('config.')) {
        this.assignNested(configOverrides, key.slice('config.'.length), value);
        continue;
      }
      if (PALETTE_MAP[key]) {
        const color = validateColor(value);
        if (color) paletteOverrides[PALETTE_MAP[key]] = color;
        else warnings.push({ code: 'INVALID_COLOR', message: 'Colore ignorato per formato non ammesso.', path: key });
        continue;
      }

      const alias = ALIASES[key];
      if (alias) {
        if (alias === 'services' || alias === 'brands') (canonical[alias] as string[]) = this.parseArray(value);
        else (canonical as any)[alias] = value;
      } else if (key === 'palette_json') {
        Object.assign(paletteOverrides, this.parseJson(value, key));
      } else if (['images_json', 'reviews_json', 'faqs_json', 'treatment_cards_json', 'product_points_json', 'routes_json'].includes(key)) {
        this.assignJsonShortcut(configOverrides, key, value);
      } else {
        canonical.extra[key] = value;
      }
    }

    canonical.businessName = cleanString(canonical.businessName, 200) || '';
    if (!canonical.businessName) throw new BadRequestException('businessName obbligatorio');
    canonical.websiteUrl = validateWebsiteUrl(canonical.websiteUrl);
    canonical.email = normalizeEmail(canonical.email);
    canonical.logoUrl = validateImageUrl(canonical.logoUrl);
    canonical.heroImageUrl = validateImageUrl(canonical.heroImageUrl);
    canonical.consultationImageUrl = validateImageUrl(canonical.consultationImageUrl);
    canonical.productsImageUrl = validateImageUrl(canonical.productsImageUrl);
    canonical.services = canonical.services.map((s) => cleanString(s, 160)).filter(Boolean) as string[];
    canonical.brands = canonical.brands.map((s) => cleanString(s, 100)).filter(Boolean) as string[];
    canonical.paletteOverrides = paletteOverrides;
    canonical.configOverrides = configOverrides;
    return canonical;
  }

  buildSiteConfig(defaultConfig: JsonObject, input: CanonicalProposalInput, warnings: RowIssue[] = []): JsonObject {
    const config = deepClone(defaultConfig);
    const year = String(new Date().getFullYear());
    const category = input.category || 'Studio professionale';
    const city = input.city || 'Citta';
    const displayName = wordSafeLimit('brand.name', input.businessName, this.limit(config, 'brand.name', 34), warnings);
    const services = [...input.services];
    for (const warning of templateCategoryWarnings(input.category)) {
      if (!warnings.some((existing) => existing.code === warning.code)) warnings.push(warning);
    }
    while (services.length < 3) services.push(['Consulenza personalizzata', 'Percorsi su misura', 'Informazioni e assistenza'][services.length]);
    const firstThree = services.slice(0, 3);

    config.sourceWebsite = {
      url: input.websiteUrl || '',
      overview: input.overview || `Informazioni disponibili per ${input.businessName}${input.city ? ` a ${input.city}` : ''}.`,
      targetAudience: input.targetAudience || `Persone interessate ai servizi di ${category}.`,
      primaryGoal: input.primaryGoal || 'Richiesta di informazioni o prenotazione',
      toneOfVoice: input.toneOfVoice || 'Professionale, rassicurante, chiaro e concreto',
      notes: input.notes || '',
    };
    config.brand = {
      professionalTitle: input.professionalTitle || '',
      name: displayName,
      descriptor: wordSafeLimit('brand.descriptor', input.descriptor || category, this.limit(config, 'brand.descriptor', 42), warnings),
      initials: initialsFor(input.businessName),
    };
    config.business = {
      city,
      citySlug: normalizeSlug(city),
      address: input.address || 'Indirizzo da inserire',
      phoneDisplay: input.phone || 'Telefono da inserire',
      phoneHref: normalizePhoneHref(input.phone),
      email: input.email || 'Email da inserire',
      mapUrl: input.address && input.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${input.address} ${input.city}`)}` : '',
      copyrightYear: year,
      developerCredit: 'Proposta dimostrativa realizzata da doFlow',
    };
    config.seo = {
      title: wordSafeLimit('seo.title', `${input.businessName} - ${category}${input.city ? ` a ${input.city}` : ''}`, this.limit(config, 'seo.title', 70), warnings),
      description: wordSafeLimit('seo.description', `Proposta dimostrativa non pubblica per presentare contenuti, servizi e contatti di ${input.businessName} in modo chiaro e mobile-first.`, this.limit(config, 'seo.description', 160), warnings),
    };
    config.images = {
      ...((config.images || {}) as JsonObject),
      logo: { ...((((config.images as JsonObject)?.logo) || {}) as JsonObject), src: input.logoUrl || '', alt: input.businessName },
      hero: { ...((((config.images as JsonObject)?.hero) || {}) as JsonObject), src: input.heroImageUrl || '', alt: `${input.businessName} - immagine principale` },
      consultation: { ...((((config.images as JsonObject)?.consultation) || {}) as JsonObject), src: input.consultationImageUrl || '', alt: `${input.businessName} - consulenza` },
      products: { ...((((config.images as JsonObject)?.products) || {}) as JsonObject), src: input.productsImageUrl || '', alt: `${input.businessName} - servizi` },
    };
    config.content = this.buildContent(config, input, firstThree, warnings);
    if (input.paletteOverrides) applyPaletteOverrides(config, input.paletteOverrides);
    if (input.configOverrides) applyAllowedConfigOverrides(config, input.configOverrides, warnings);
    forceTemplateContract(config);
    validateSiteConfig(config);
    return config;
  }

  private buildContent(config: JsonObject, input: CanonicalProposalInput, services: string[], warnings: RowIssue[]) {
    const content = deepClone((config.content || {}) as JsonObject);
    content.hero = {
      eyebrow: wordSafeLimit('content.hero.eyebrow', input.professionalTitle || input.category || 'Proposta dimostrativa', this.limit(config, 'content.hero.eyebrow', 52), warnings),
      titleLine: wordSafeLimit('content.hero.titleLine', input.businessName, this.limit(config, 'content.hero.titleLine', 42), warnings),
      titleEmphasis: wordSafeLimit('content.hero.titleEmphasis', input.descriptor || input.category || 'mobile-first', this.limit(config, 'content.hero.titleEmphasis', 34), warnings),
      description: wordSafeLimit('content.hero.description', input.overview || `Una proposta non pubblica per mostrare contenuti, servizi e contatti in modo piu chiaro e orientato allo smartphone.`, this.limit(config, 'content.hero.description', 280), warnings),
    };
    content.treatments = {
      ...((content.treatments || {}) as JsonObject),
      cards: services.map((service, index) => ({
        ...((((content.treatments as JsonObject)?.cards as JsonObject[])?.[index] || {}) as JsonObject),
        title: wordSafeLimit(`content.treatments.cards.${index}.title`, service, this.limit(config, 'content.treatments.cards.title', 34), warnings),
        description: wordSafeLimit(`content.treatments.cards.${index}.description`, input.services[index] ? `Sezione dedicata a ${service}, con informazioni da verificare e aggiornare prima dell'invio.` : 'Sezione dichiarativa da completare con informazioni verificate.', this.limit(config, 'content.treatments.cards.description', 170), warnings),
      })),
    };
    content.products = {
      ...((content.products || {}) as JsonObject),
      points: ['Chiarezza visiva', 'Contatti accessibili', 'Esperienza mobile-first'],
    };
    content.reviews = {
      ...((content.reviews || {}) as JsonObject),
      items: this.placeholderReviews(),
    };
    content.faq = {
      ...((content.faq || {}) as JsonObject),
      items: this.genericFaqs(input.category),
    };
    return content;
  }

  private parseMatrix(input: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else quoted = false;
        } else cell += ch;
        continue;
      }
      if (ch === '"') {
        if (cell.length === 0) quoted = true;
        else cell += ch;
      } else if (ch === delimiter) {
        this.checkCell(cell);
        row.push(cell);
        cell = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        this.checkCell(cell);
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (quoted) throw new BadRequestException('CSV con virgolette non chiuse');
    this.checkCell(cell);
    row.push(cell);
    rows.push(row);
    return rows;
  }

  private detectDelimiter(line: string): string {
    const candidates = [',', ';', '\t'];
    return candidates.map((d) => ({ d, count: this.parseMatrix(`${line}\n`, d)[0]?.length || 0 })).sort((a, b) => b.count - a.count)[0].d;
  }

  private firstSignificantLine(input: string): string {
    let quoted = false;
    let line = '';
    for (const ch of input) {
      if (ch === '"') quoted = !quoted;
      if (!quoted && (ch === '\n' || ch === '\r')) {
        if (line.trim()) return line;
        line = '';
      } else line += ch;
    }
    return line.trim() ? line : '';
  }

  private normalizeHeaders(headers: string[]): string[] {
    const counts = new Map<string, number>();
    return headers.map((header, index) => {
      const base = this.canonicalHeader(header) || `column_${index + 1}`;
      if (['__proto__', 'prototype', 'constructor'].includes(base)) throw new BadRequestException('Header non consentito');
      const count = counts.get(base) || 0;
      counts.set(base, count + 1);
      return count ? `${base}_${count + 1}` : base;
    });
  }

  private canonicalHeader(header: string): string {
    return String(header || '').trim().replace(/^\uFEFF/, '').toLowerCase().replace(/\s+/g, '_');
  }

  private checkCell(cell: string) {
    if (cell.length > CSV_LIMITS.maxCellChars) throw new BadRequestException('Cella oltre il limite consentito');
  }

  private parseArray(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) throw new BadRequestException('Array JSON non valido');
      return parsed.map((item) => cleanString(item, 160)).filter(Boolean) as string[];
    }
    return trimmed.split(/[\n;|]+/).map((item) => cleanString(item, 160)).filter(Boolean) as string[];
  }

  private parseJson(value: string, field: string): JsonObject {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
      assertNoPrototypePollution(parsed, field);
      return parsed as JsonObject;
    } catch {
      throw new BadRequestException(`${field} deve contenere JSON valido`);
    }
  }

  private assignNested(target: JsonObject, path: string, value: unknown) {
    const parts = path.split('.').filter(Boolean);
    if (!parts.length || parts.some((p) => ['__proto__', 'prototype', 'constructor'].includes(p))) throw new BadRequestException('Percorso config non consentito');
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = (cursor[part] ||= Object.create(null)) as JsonObject;
    cursor[parts[parts.length - 1]] = value;
  }

  private assignJsonShortcut(target: JsonObject, key: string, value: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
      assertNoPrototypePollution(parsed, key);
    } catch {
      throw new BadRequestException(`${key} deve contenere JSON valido`);
    }
    const map: Record<string, string> = {
      images_json: 'images',
      reviews_json: 'content.reviews.items',
      faqs_json: 'content.faq.items',
      treatment_cards_json: 'content.treatments.cards',
      product_points_json: 'content.products.points',
      routes_json: 'routing.paths',
    };
    const fixedCounts: Record<string, number> = {
      reviews_json: 6,
      faqs_json: 6,
      treatment_cards_json: 3,
      product_points_json: 3,
    };
    if (fixedCounts[key] && (!Array.isArray(parsed) || parsed.length !== fixedCounts[key])) {
      throw new BadRequestException(`${key} deve contenere esattamente ${fixedCounts[key]} elementi`);
    }
    if (!fixedCounts[key] && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new BadRequestException(`${key} deve contenere un oggetto JSON`);
    }
    this.assignNested(target, map[key], parsed);
  }

  private limit(config: JsonObject, key: string, fallback: number): number {
    const textLimits = (config.textLimits || {}) as JsonObject;
    return Number(textLimits[key] || fallback);
  }

  private placeholderReviews() {
    return Array.from({ length: 6 }, (_, index) => ({
      name: 'Recensione verificata',
      date: 'Da inserire',
      title: 'Spazio recensione',
      text: 'Qui verra mostrata una recensione reale e verificata dello studio.',
      rating: 5,
      imageKey: `review${index + 1}`,
    }));
  }

  private genericFaqs(category?: string) {
    const compatible = templateCategoryWarnings(category).length === 0;
    if (compatible) {
      return [
        { question: 'Come posso richiedere informazioni?', answer: 'Puoi usare i recapiti presenti nella pagina per chiedere informazioni o fissare un appuntamento.' },
        { question: 'Serve una consulenza prima del trattamento?', answer: 'La consulenza consente di raccogliere informazioni e valutare il percorso piu adatto. Ogni indicazione deve essere confermata dallo studio.' },
        { question: 'I contenuti sono definitivi?', answer: 'No, testi, immagini e recensioni devono essere verificati prima di qualsiasi pubblicazione.' },
        { question: 'La pagina funziona da smartphone?', answer: 'Il tema e predisposto per una consultazione mobile-first con sezioni leggibili e CTA visibili.' },
        { question: 'Come vengono aggiornate le informazioni?', answer: 'Le informazioni vengono aggiornate tramite SiteConfig validato, senza riscrivere HTML o CSS.' },
        { question: 'Form e pagamenti sono attivi?', answer: 'No, form, account, carrello e pagamenti restano disattivati nella demo.' },
      ];
    }
    return [
      { question: 'Come posso contattare l attivita?', answer: 'Puoi usare telefono, email o altri recapiti indicati nella pagina, se forniti nel CSV.' },
      { question: 'La demo e pubblica?', answer: 'No, questa proposta e una demo non pubblica destinata alla valutazione grafica e commerciale.' },
      { question: 'I servizi sono verificati?', answer: 'Sono riportati solo i servizi dichiarati nei dati forniti e devono essere verificati prima dell invio.' },
      { question: 'Posso richiedere un appuntamento?', answer: 'La demo mostra un percorso orientato al contatto; disponibilita e modalita devono essere confermate dall attivita.' },
      { question: 'La pagina e pensata per mobile?', answer: 'Si, la struttura privilegia leggibilita, CTA raggiungibili e navigazione semplice da smartphone.' },
      { question: 'Cosa resta da completare?', answer: 'Testi definitivi, immagini, recensioni e dettagli operativi devono essere controllati manualmente.' },
    ];
  }
}

export { ParsedCsv };
