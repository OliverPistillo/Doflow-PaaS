import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  COLSOVA_TEMPLATE,
  ROUTE_REDIRECT_ANCHORS,
  SITE_PROPOSAL_CATEGORY_TAGS,
} from './tenant-site-proposals.constants';
import { CanonicalProposalInput, JsonObject, RowIssue } from './tenant-site-proposals.types';
import { getTemplateRegistration, SiteProposalTemplateRegistration } from './tenant-site-proposals-template-registry';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^(#[0-9a-f]{3,4}([0-9a-f]{3,4})?|rgba?\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)(\s*,\s*(0|1|0?\.\d+))?\s*\))$/i;
const CSS_LENGTH_RE = '(?:0|-?\\d+(?:\\.\\d+)?px)';
const SHADOW_RE = new RegExp(`^${CSS_LENGTH_RE}\\s+${CSS_LENGTH_RE}\\s+${CSS_LENGTH_RE}(?:\\s+${CSS_LENGTH_RE})?\\s+rgba?\\(\\s*(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\s*,\\s*(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\s*,\\s*(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\s*,\\s*(?:0|1|0?\\.\\d+))?\\s*\\)$`, 'i');
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ABSENT_VALUES = new Set(['non trovato', 'n/d', 'nd', 'n.a.', 'null', 'undefined', '-']);
function isJsonObject(value: unknown): value is JsonObject { return !!value && typeof value === 'object' && !Array.isArray(value); }

export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function assertNoPrototypePollution(value: unknown, path = 'body') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrototypePollution(item, `${path}.${index}`));
    return;
  }
  for (const key of Object.keys(value as JsonObject)) {
    if (FORBIDDEN_KEYS.has(key)) throw new BadRequestException(`Chiave non consentita: ${path}.${key}`);
    assertNoPrototypePollution((value as JsonObject)[key], `${path}.${key}`);
  }
}

export function cleanString(value: unknown, max = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!s || ABSENT_VALUES.has(s.toLowerCase())) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

export function normalizeSlug(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function normalizeNameKey(value?: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeWebsite(value?: string): string | undefined {
  const raw = cleanString(value, 500);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeEmail(value?: string): string | undefined {
  const email = cleanString(value, 320)?.toLowerCase();
  return email && EMAIL_RE.test(email) ? email : undefined;
}

export function normalizePhoneHref(value?: string): string {
  const raw = cleanString(value, 80);
  if (!raw) return '';
  const first = raw.split(/[\/;,|]/)[0] || raw;
  let digits = first.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (!digits.startsWith('+') && digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+') && digits.length >= 6) digits = `+39${digits}`;
  return /^\+\d{6,15}$/.test(digits) ? `tel:${digits}` : '';
}

export function validateWebsiteUrl(value?: string): string | undefined {
  return normalizeWebsite(value);
}

export function validateImageUrl(value?: string): string | undefined {
  const raw = cleanString(value, 80_000);
  if (!raw) return undefined;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length <= 80_000) {
    return raw.replace(/\s+/g, '');
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return undefined;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
    if (host === '169.254.169.254') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function validateColor(value: unknown): string | undefined {
  const s = cleanString(value, 80);
  if (!s) return undefined;
  if (/url\s*\(|var\s*\(|expression\s*\(|javascript:/i.test(s)) return undefined;
  return COLOR_RE.test(s) ? s : undefined;
}

export function validatePaletteValue(value: unknown): string | undefined {
  const s = cleanString(value, 120);
  if (!s || /url\s*\(|var\s*\(|expression\s*\(|javascript:|[;{}<>]/i.test(s)) return undefined;
  return COLOR_RE.test(s) || SHADOW_RE.test(s) ? s : undefined;
}

export function wordSafeLimit(path: string, value: string, limit: number, warnings: RowIssue[]): string {
  const s = cleanString(value, limit * 3) || '';
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit + 1);
  const atSpace = cut.lastIndexOf(' ');
  const used = `${(atSpace > Math.floor(limit * 0.55) ? cut.slice(0, atSpace) : cut.slice(0, limit)).trim()}...`;
  warnings.push({ code: 'TEXT_ABBREVIATED', message: 'Testo abbreviato per rispettare il layout.', path, original: s, used, limit });
  return used;
}

export function initialsFor(name: string): string {
  const parts = normalizeNameKey(name).split(' ').filter(Boolean);
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

export function parseJsonObject(value: string | undefined, field: string): JsonObject | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    assertNoPrototypePollution(parsed, field);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    return parsed as JsonObject;
  } catch {
    throw new BadRequestException(`${field} deve contenere JSON valido`);
  }
}

export function fixedArray<T>(value: unknown, count: number, field: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== count) {
    throw new BadRequestException(`${field} deve contenere esattamente ${count} elementi`);
  }
  return value as T[];
}

export function applyAllowedConfigOverrides(config: JsonObject, overrides: JsonObject, warnings: RowIssue[]) {
  assertNoPrototypePollution(overrides, 'configOverrides');
  const blockedRoots = new Set(['_README', 'editingContract', 'fixedCounts', 'textLimits', 'palette', 'layoutLocked', 'localPreviewMode', 'prototype', '__proto__', 'constructor']);
  for (const [path, value] of flattenObject(overrides)) {
    const parts = path.split('.');
    const protectedRouting = parts[0] === 'routing' && parts[1] !== 'paths';
    const protectedImage = parts[0] === 'images' && (parts.length < 3 || !['src', 'alt', 'objectPosition', 'prompt'].includes(parts[2]));
    if (blockedRoots.has(parts[0]) || path.startsWith('template.') || protectedRouting || protectedImage) {
      warnings.push({ code: 'CONFIG_OVERRIDE_BLOCKED', message: 'Override non consentito.', path });
      continue;
    }
    if (!hasPath(config, parts)) {
      warnings.push({ code: 'CONFIG_OVERRIDE_UNKNOWN', message: 'Override ignorato: percorso non esistente.', path });
      continue;
    }
    setPath(config, parts, value);
  }
  forceTemplateContract(config);
}

export function applyPaletteOverrides(config: JsonObject, overrides: JsonObject) {
  assertNoPrototypePollution(overrides, 'paletteOverrides');
  if (!Array.isArray(config.palette)) {
    if (!isJsonObject(config.palette)) throw new BadRequestException('Palette del Tema Colsova non valida');
    for (const [key, rawValue] of Object.entries(overrides)) {
      const normalized = key.startsWith('--') ? key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : key;
      if (!Object.prototype.hasOwnProperty.call(config.palette, normalized)) throw new BadRequestException(`Variabile palette non consentita: ${key}`);
      const value = validateColor(rawValue);
      if (!value) throw new BadRequestException(`Valore palette non sicuro: ${key}`);
      (config.palette as JsonObject)[normalized] = value;
    }
    return;
  }
  const palette = config.palette as JsonObject[];
  const byVariable = new Map(palette.map((entry) => [String(entry.variable), entry]));
  for (const [variable, rawValue] of Object.entries(overrides)) {
    const entry = byVariable.get(variable);
    if (!entry) throw new BadRequestException(`Variabile palette non consentita: ${variable}`);
    const value = validatePaletteValue(rawValue);
    if (!value) throw new BadRequestException(`Valore palette non sicuro: ${variable}`);
    entry.value = value;
  }
}

export function forceTemplateContract(config: JsonObject, selected?: SiteProposalTemplateRegistration) {
  const current = config.template as JsonObject | undefined;
  const registration = selected || getTemplateRegistration(String(current?.slug || COLSOVA_TEMPLATE.slug), current?.templateVersion ? String(current.templateVersion) : undefined);
  config.template = {
    ...(config.template as JsonObject),
    name: registration.name,
    slug: registration.slug,
    schemaVersion: registration.schemaVersion,
    templateVersion: registration.version,
    layoutLocked: true,
  };
  const routing = (config.routing && typeof config.routing === 'object' ? config.routing : {}) as JsonObject;
  routing.localPreviewMode = true;
  config.routing = routing;
}

export function validateSiteConfig(config: JsonObject, selected?: SiteProposalTemplateRegistration): RowIssue[] {
  assertNoPrototypePollution(config, 'siteConfig');
  const warnings: RowIssue[] = [];
  const template = config.template as JsonObject | undefined;
  const registration = selected || getTemplateRegistration(String(template?.slug || COLSOVA_TEMPLATE.slug), String(template?.templateVersion || ''));
  if (registration.contractVersion !== '1.0') return validateSiteConfigV2(config, registration);
  const editingContract = config.editingContract as JsonObject | undefined;
  const fixed = editingContract?.fixedCounts as JsonObject | undefined;
  const content = config.content as JsonObject | undefined;
  if (!template || template.schemaVersion !== COLSOVA_TEMPLATE.schemaVersion || template.templateVersion !== COLSOVA_TEMPLATE.version || template.layoutLocked !== true) {
    throw new BadRequestException('Contratto template del Tema Colsova non valido');
  }
  if (!fixed || Number(fixed.treatmentCards) !== 3 || Number(fixed.productPoints) !== 3 || Number(fixed.reviews) !== 6 || Number(fixed.faqs) !== 6) {
    throw new BadRequestException('Conteggi fissi del Tema Colsova non validi');
  }
  const treatments = (((content?.treatments as JsonObject | undefined)?.cards) || []) as unknown[];
  const points = (((content?.products as JsonObject | undefined)?.points) || []) as unknown[];
  const reviews = (((content?.reviews as JsonObject | undefined)?.items) || []) as unknown[];
  const faqs = (((content?.faq as JsonObject | undefined)?.items) || []) as unknown[];
  if (treatments.length !== 3 || points.length !== 3 || reviews.length !== 6 || faqs.length !== 6) {
    throw new BadRequestException('Il SiteConfig deve mantenere 3 trattamenti, 3 punti prodotto, 6 recensioni e 6 FAQ');
  }
  if (!Array.isArray(config.palette) || !config.palette.length) throw new BadRequestException('Palette del Tema Colsova non valida');
  const paletteVariables = new Set<string>();
  for (const item of config.palette as unknown[]) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new BadRequestException('Palette del Tema Colsova non valida');
    const entry = item as JsonObject;
    const variable = typeof entry.variable === 'string' ? entry.variable : '';
    if (!/^--[a-z][a-z0-9-]*$/i.test(variable) || paletteVariables.has(variable) || typeof entry.role !== 'string' || !validatePaletteValue(entry.value)) {
      throw new BadRequestException('Palette del Tema Colsova non valida');
    }
    paletteVariables.add(variable);
  }
  const images = config.images as JsonObject | undefined;
  for (const slot of ['logo', 'hero', 'consultation', 'products', 'review1', 'review2', 'review3', 'review4', 'review5', 'review6']) {
    if (!images?.[slot] || typeof images[slot] !== 'object' || Array.isArray(images[slot])) throw new BadRequestException(`Slot immagine non valido: ${slot}`);
    const src = (images[slot] as JsonObject).src;
    if (typeof src !== 'string' || !isSafeImageSource(src)) throw new BadRequestException(`Sorgente immagine non valida: ${slot}`);
  }
  const routing = config.routing as JsonObject | undefined;
  const paths = routing?.paths as JsonObject | undefined;
  const labels = routing?.labels as JsonObject | undefined;
  if (!routing || routing.localPreviewMode !== true || !paths || !labels) throw new BadRequestException('Routing del Tema Colsova non valido');
  for (const route of Object.values(paths)) {
    if (typeof route !== 'string') throw new BadRequestException('Route non sicura');
    if (route.startsWith('#')) continue;
    if (/[{}]/.test(route.split('{citySlug}').join(''))) throw new BadRequestException('Route non sicura');
    safeRelativeRoute(route.split('{citySlug}').join('citta'));
  }
  if (!config.textLimits || typeof config.textLimits !== 'object' || Array.isArray(config.textLimits)) throw new BadRequestException('textLimits del Tema Colsova non validi');
  if (Object.values(config.textLimits as JsonObject).some((limit) => !Number.isFinite(Number(limit)) || Number(limit) <= 0)) {
    throw new BadRequestException('textLimits del Tema Colsova non validi');
  }
  return warnings;
}

function validateSiteConfigV2(config: JsonObject, registration: SiteProposalTemplateRegistration): RowIssue[] {
  const template = config.template as JsonObject;
  if (template.schemaVersion !== registration.schemaVersion || template.layoutLocked !== true) throw new BadRequestException('Contratto template del Tema Colsova 2.0 non valido');
  if (registration.contentProfile === 'colsova-conversion-v1') return validateColsovaConversionConfig(config, registration);
  if (registration.contentProfile === 'beauty-editorial-v1' || registration.contentProfile === 'beauty-conversion-v1') {
    return validatePendingBeautyConfig(config, registration);
  }
  const editing = config.editingContract as JsonObject | undefined;
  const fixed = editing?.fixedCounts as JsonObject | undefined;
  const content = config.content as JsonObject | undefined;
  if (editing?.contractVersion !== '2.0' || Number(fixed?.services) !== 3 || Number(fixed?.trustItems) !== 6 || Number(fixed?.faqs) !== 6) throw new BadRequestException('Conteggi fissi del Tema Colsova 2.0 non validi');
  if (!Array.isArray(content?.services) || content.services.length !== 3 || !Array.isArray(content?.trustItems) || content.trustItems.length !== 6 || !Array.isArray(content?.faq) || content.faq.length !== 6) throw new BadRequestException('Il SiteConfig V2 deve mantenere 3 servizi, 6 punti di fiducia e 6 FAQ');
  const images = config.images as JsonObject | undefined;
  for (const slot of ['logoDefault', 'logoLight', 'hero', 'consultation', 'feature']) {
    if (!isJsonObject(images?.[slot])) throw new BadRequestException(`Slot immagine non valido: ${slot}`);
    const src = String((images![slot] as JsonObject).src || '');
    if (['hero', 'consultation', 'feature'].includes(slot) && !src) throw new BadRequestException(`Slot fotografico vuoto: ${slot}`);
    if (src && !isSafeImageSource(src)) throw new BadRequestException(`Sorgente immagine non valida: ${slot}`);
    if (['hero', 'consultation', 'feature'].includes(slot)) {
      const method = String((images![slot] as JsonObject).sourceMethod || '');
      if (method && !['website', 'catalog', 'catalog_fallback', 'manual', 'stock_local'].includes(method)) throw new BadRequestException(`Metodo immagine non valido: ${slot}`);
    }
  }
  if (!isJsonObject(config.palette)) throw new BadRequestException('Palette del Tema Colsova 2.0 non valida');
  for (const key of ['primary','secondary','accent','dark','light','primaryHover','muted','textOnPrimary']) if (!validateColor((config.palette as JsonObject)[key])) throw new BadRequestException(`Colore palette non valido: ${key}`);
  const business = config.business as JsonObject | undefined;
  for (const key of ['socialLinkedIn','socialInstagram','socialFacebook']) {
    const value = business?.[key];
    if (value && (typeof value !== 'string' || !/^https:\/\//i.test(value) || !validateWebsiteUrl(value))) throw new BadRequestException(`Social non sicuro: ${key}`);
  }
  const routing = config.routing as JsonObject | undefined;
  if (routing?.localPreviewMode !== true || !isJsonObject(routing.paths)) throw new BadRequestException('Routing del Tema Colsova 2.0 non valido');
  for (const value of Object.values(routing.paths as JsonObject)) {
    if (typeof value !== 'string') throw new BadRequestException('Route non sicura');
    if (!value.startsWith('#')) safeRelativeRoute(value);
  }
  if (!isJsonObject(config.textLimits) || Object.values(config.textLimits).some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0)) throw new BadRequestException('textLimits del Tema Colsova 2.0 non validi');
  const serialized = JSON.stringify(content).toLowerCase();
  if (/sostituire|immagine hero|prodotti \/ studio|\bplaceholder\b|recensione di/.test(serialized)) throw new BadRequestException('Il SiteConfig V2 contiene placeholder tecnici');
  return [];
}

const BEAUTY_PROFILE_COUNTS: Readonly<Record<'beauty-editorial-v1' | 'beauty-conversion-v1', Readonly<Record<string, number>>>> = {
  'beauty-editorial-v1': { services: 4, results: 3, trustItems: 4 },
  'beauty-conversion-v1': { services: 5, results: 3, reviews: 3, trustItems: 5, ctaItems: 4 },
};

function validatePendingBeautyConfig(config: JsonObject, registration: SiteProposalTemplateRegistration): RowIssue[] {
  const profile = registration.contentProfile as keyof typeof BEAUTY_PROFILE_COUNTS;
  const editing = requireObject(config.editingContract, 'editingContract');
  if (editing.contractVersion !== '2.0') throw new BadRequestException('Contratto editoriale del tema beauty non valido');
  const fixed = requireObject(editing.fixedCounts, 'editingContract.fixedCounts');
  for (const [key, count] of Object.entries(BEAUTY_PROFILE_COUNTS[profile])) {
    if (Number(fixed[key]) !== count) throw new BadRequestException(`Conteggio fisso non valido: ${key}`);
  }
  const content = requireObject(config.content, 'content');
  const collections: ReadonlyArray<[unknown, number, string]> = profile === 'beauty-editorial-v1'
    ? [[content.services, 4, 'content.services'], [(content.results as JsonObject)?.items, 3, 'content.results.items'], [content.trust, 4, 'content.trust']]
    : [[content.services, 5, 'content.services'], [(content.reviews as JsonObject)?.items, 3, 'content.reviews.items'], [content.trust, 5, 'content.trust'], [(content.cta as JsonObject)?.items, 4, 'content.cta.items']];
  collections.forEach(([value, count, field]) => requireArray(value, count, field));
  const images = requireObject(config.images, 'images');
  if (profile === 'beauty-conversion-v1') requireArray(images.results, 3, 'images.results');
  const brand = requireObject(config.brand, 'brand');
  for (const slot of ['logoDefault', 'logoLight', 'hero', 'consultation', 'feature']) {
    if (slot.startsWith('logo')) {
      const src = String(brand[slot] || '');
      if (!src || !isSafeImageSource(src)) throw new BadRequestException(`Sorgente immagine non valida: brand.${slot}`);
      continue;
    }
    const image = requireObject(images[slot], `images.${slot}`);
    const src = String(image.src || '');
    if (src && !isSafeImageSource(src)) throw new BadRequestException(`Sorgente immagine non valida: ${slot}`);
  }
  const palette = requireObject(config.palette, 'palette');
  if (!Object.keys(palette).length || Object.values(palette).some((value) => !validateColor(value))) throw new BadRequestException('Palette del tema beauty non valida');
  const routing = requireObject(config.routing, 'routing');
  if (routing.localPreviewMode !== true || !isJsonObject(routing.labels) || !Array.isArray(routing.treatments)) throw new BadRequestException('Routing del tema beauty non valido');
  if (routing.paths !== undefined) {
    if (!isJsonObject(routing.paths)) throw new BadRequestException('Routing del tema beauty non valido');
    for (const value of Object.values(routing.paths as JsonObject)) {
      if (typeof value !== 'string') throw new BadRequestException('Route non sicura');
      if (!value.startsWith('#')) safeRelativeRoute(value);
    }
  }
  return [];
}

const COLSOVA_CONVERSION_PALETTE = ['ink','inkSoft','muted','ivory','cream','sand','sandSoft','gold','goldDeep','white'] as const;
const COLSOVA_CONVERSION_CONTENT = ['hero','consultation','servicesIntro','services','feature','reviewsIntro','reviews','faqIntro','faq','footer','headerCta','trust','process','contact'] as const;

function requireObject(value: unknown, path: string): JsonObject {
  if (!isJsonObject(value)) throw new BadRequestException(`Campo obbligatorio non valido: ${path}`);
  return value;
}

function requireText(parent: JsonObject, key: string, path: string) {
  if (typeof parent[key] !== 'string' || !String(parent[key]).trim()) throw new BadRequestException(`Testo obbligatorio mancante: ${path}.${key}`);
}

function requireTextFields(value: unknown, fields: readonly string[], path: string) {
  const object = requireObject(value, path);
  fields.forEach((field) => requireText(object, field, path));
  return object;
}

function requireArray(value: unknown, count: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length !== count) throw new BadRequestException(`${path} deve contenere esattamente ${count} elementi`);
  return value;
}

function validateColsovaConversionConfig(config: JsonObject, registration: SiteProposalTemplateRegistration): RowIssue[] {
  const editing = requireObject(config.editingContract, 'editingContract');
  const fixed = requireObject(editing.fixedCounts, 'editingContract.fixedCounts');
  const expected: Record<string, number> = { services: 3, reviews: 6, faqs: 6, trustItems: 4, consultationHighlights: 3, processSteps: 3 };
  if (editing.contractVersion !== '2.0' || Object.entries(expected).some(([key, count]) => Number(fixed[key]) !== count)) throw new BadRequestException('Conteggi fissi del Tema Colsova 2.4.1 non validi');
  const imageSlots = editing.imageSlots;
  if (!Array.isArray(imageSlots) || imageSlots.join('|') !== 'logoDefault|logoLight|hero|consultation|feature') throw new BadRequestException('Slot immagini del Tema Colsova 2.4.1 non validi');

  const content = requireObject(config.content, 'content');
  if (COLSOVA_CONVERSION_CONTENT.some((key) => !Object.prototype.hasOwnProperty.call(content, key))) throw new BadRequestException('Contenuto obbligatorio del Tema Colsova 2.4.1 incompleto');
  requireTextFields(content.hero, ['eyebrow','title','titleAccent','description','primaryCta','secondaryCta','stampText'], 'content.hero');
  requireArray((content.hero as JsonObject).proofs, 3, 'content.hero.proofs').forEach((value) => { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Proof hero non valida'); });
  const consultation = requireTextFields(content.consultation, ['eyebrow','title','titleAccent','cta'], 'content.consultation');
  requireArray(consultation.paragraphs, 2, 'content.consultation.paragraphs').forEach((value) => { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Paragrafo consultation non valido'); });
  requireArray(consultation.highlights, 3, 'content.consultation.highlights').forEach((value) => { if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Highlight consultation non valido'); });
  requireTextFields(content.servicesIntro, ['eyebrow','title','titleAccent','description'], 'content.servicesIntro');
  requireArray(content.services, 3, 'content.services').forEach((item, index) => requireTextFields(item, ['number','title','description','cta'], `content.services.${index}`));
  requireTextFields(content.feature, ['eyebrow','title','titleAccent','description','cta'], 'content.feature');
  const reviewsIntro = requireTextFields(content.reviewsIntro, ['eyebrow','title','titleAccent','description','cta','disclaimer'], 'content.reviewsIntro');
  const reviews = requireArray(content.reviews, 6, 'content.reviews');
  reviews.forEach((item, index) => requireTextFields(item, ['name','date','title','text'], `content.reviews.${index}`));
  requireTextFields(content.faqIntro, ['eyebrow','title','description'], 'content.faqIntro');
  requireArray(content.faq, 6, 'content.faq').forEach((item, index) => requireTextFields(item, ['question','answer'], `content.faq.${index}`));
  requireTextFields(content.footer, ['description','studioTitle','servicesTitle','contactTitle','phoneLabel','emailLabel','cta','copyright','privacyLabel','cookieLabel'], 'content.footer');
  requireText(content, 'headerCta', 'content');
  const trust = requireObject(content.trust, 'content.trust');
  requireArray(trust.items, 4, 'content.trust.items').forEach((item, index) => requireTextFields(item, ['title','description'], `content.trust.items.${index}`));
  const process = requireTextFields(content.process, ['eyebrow','title','titleAccent','description','cta'], 'content.process');
  requireArray(process.steps, 3, 'content.process.steps').forEach((item, index) => requireTextFields(item, ['number','title','description'], `content.process.steps.${index}`));
  requireTextFields(content.contact, ['eyebrow','title','titleAccent','description','phoneLabel','emailLabel','addressLabel','hoursLabel','formTitle','formDescription','demoNotice','submit','success'], 'content.contact');

  const features = requireObject(config.features, 'features');
  for (const key of ['showProducts','showAccount','showCart','showReviews','showFaq','showContactForm','showMobileCta']) if (typeof features[key] !== 'boolean') throw new BadRequestException(`Feature non valida: ${key}`);
  if (!['demo','real'].includes(String(features.reviewsMode))) throw new BadRequestException('reviewsMode non valido');
  if (features.reviewsMode === 'demo') {
    if (!/recensioni dimostrative/i.test(String(reviewsIntro.disclaimer))) throw new BadRequestException('Disclaimer recensioni dimostrative mancante');
  } else if ((config.personalization as JsonObject | undefined)?.reviewsVerified !== true) {
    throw new BadRequestException('Le recensioni reali richiedono dati manuali verificati');
  }

  const personalization = requireObject(config.personalization, 'personalization');
  if (!['homepage','landing'].includes(String(personalization.pageMode))) throw new BadRequestException('pageMode non valido');
  const palette = requireObject(config.palette, 'palette');
  if (Object.keys(palette).sort().join('|') !== [...COLSOVA_CONVERSION_PALETTE].sort().join('|')) throw new BadRequestException('Palette del Tema Colsova 2.4.1 non valida');
  COLSOVA_CONVERSION_PALETTE.forEach((key) => { if (!validateColor(palette[key])) throw new BadRequestException(`Colore palette non valido: ${key}`); });

  const images = requireObject(config.images, 'images');
  let encodedDataTotal = 0;
  for (const slot of ['logoDefault','logoLight','hero','consultation','feature']) {
    const image = requireObject(images[slot], `images.${slot}`);
    const src = String(image.src || '');
    if (['hero','consultation','feature'].includes(slot) && !src) throw new BadRequestException(`Slot fotografico vuoto: ${slot}`);
    const encoded = validateVersionedThemeImageSource(src);
    if (!encoded.safe) throw new BadRequestException(`Sorgente immagine non valida: ${slot}`);
    encodedDataTotal += encoded.encodedLength;
  }
  if (encodedDataTotal > 3 * 1024 * 1024) throw new BadRequestException('Data URI totali del tema oltre il limite');
  const business = requireObject(config.business, 'business');
  if (business.developerUrl !== 'https://doflow.it/') throw new BadRequestException('Developer URL protetto non valido');
  const template = requireObject(config.template, 'template');
  if (template.templateVersion !== registration.version || template.slug !== registration.slug) throw new BadRequestException('Versione template non coerente');
  if (!isJsonObject(config.textLimits) || Object.values(config.textLimits).some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0)) throw new BadRequestException('textLimits del Tema Colsova 2.4.1 non validi');
  return [];
}

function validateVersionedThemeImageSource(value: string): { safe: boolean; encodedLength: number } {
  if (!value) return { safe: true, encodedLength: 0 };
  const match = /^data:(image\/(?:webp|png|jpeg|svg\+xml));base64,([a-z0-9+/=]+)$/i.exec(value);
  if (match) return { safe: match[2].length <= 1024 * 1024, encodedLength: match[2].length };
  return { safe: isSafeImageSource(value), encodedLength: 0 };
}

export function buildCommercialAnalysis(input: CanonicalProposalInput): JsonObject {
  const strengths: JsonObject[] = [];
  if (input.websiteUrl) strengths.push({ label: 'Sito web presente', source: 'csv_website', verified: true });
  if (input.email || input.phone) strengths.push({ label: 'Contatti disponibili', source: 'csv_contacts', verified: true });
  if (input.address) strengths.push({ label: 'Indirizzo dichiarato', source: 'csv_address', verified: true });
  if (input.services.length) strengths.push({ label: 'Servizi dichiarati nel CSV', source: 'csv_services', verified: true });
  if (input.city) strengths.push({ label: 'Citta indicata', source: 'csv_city', verified: true });
  if (input.socialFacebook || input.socialInstagram || input.socialTikTok || input.socialYouTube) strengths.push({ label: 'Canali social indicati', source: 'csv_social', verified: true });
  if (input.descriptor || input.category || input.professionalTitle) strengths.push({ label: 'Identita o specializzazione dichiarata', source: 'csv_identity', verified: true });

  const improvementAreas: JsonObject[] = [];
  if (input.notes) {
    improvementAreas.push({ label: 'Indicazione da verificare prima dell invio', note: input.notes, source: 'csv_notes', verified: false });
  }

  return {
    mode: 'csv_only',
    status: 'draft',
    strengths,
    improvementAreas,
    benefits: [
      'gerarchia visiva chiara',
      'CTA piu visibili',
      'contatti accessibili',
      'navigazione semplificata',
      'struttura responsive',
      'esperienza fluida',
      'predisposizione mobile-first',
      'contenuti facilmente aggiornabili tramite SiteConfig',
    ],
    desktopExperience: ['qualita visiva', 'gerarchia', 'leggibilita', 'uso dello spazio', 'coerenza delle sezioni'],
    mobileFirstExperience: ['leggibilita da smartphone', 'CTA facilmente raggiungibili', 'navigazione semplice', 'scroll fluido', 'riduzione dell attrito', 'percorso che non intimorisce il potenziale cliente', 'facilita nel contattare l attivita'],
    rationale: ['La proposta usa un tema strutturato e invariabile, aggiornato solo tramite SiteConfig validato.', 'Le scelte sono orientate a chiarezza, contatto e valutazione mobile-first senza screditare il sito precedente.'],
    evidence: strengths,
    requiresManualReview: true,
  };
}

export function buildEmail(input: CanonicalProposalInput) {
  const name = input.businessName;
  return {
    subject: `Una proposta mobile-first per ${name}`,
    body: `Buongiorno,\n\nho preparato una proposta dimostrativa non pubblica per ${name}.\n\nL'obiettivo non e stravolgere l'identita dell'attivita, ma mostrare come contenuti, servizi e contatti possano essere presentati in modo piu chiaro, fluido e orientato al contatto.\n\nLa demo e stata progettata per offrire una buona esperienza da desktop, ma soprattutto da smartphone: navigazione semplice, testi leggibili, call to action visibili e un percorso che invita a scorrere senza creare confusione o attrito.\n\nLink alla demo:\n[LINK_DEMO]\n\nLe consiglio di valutarla sia da computer sia dal telefono, perche e soprattutto sul mobile che il potenziale cliente forma la sua prima impressione e decide se continuare la visita o abbandonarla.\n\nSe questa direzione le sembra interessante, puo rispondere a questa email e possiamo confrontarci in modo piu mirato su obiettivi, contenuti e possibili sviluppi.\n\nOliver\ndoFlow\nMobile first.`,
  };
}

export function buildFingerprint(input: CanonicalProposalInput): string {
  return normalizeWebsite(input.websiteUrl) || normalizeEmail(input.email) || normalizeNameKey(`${input.businessName} ${input.city || ''}`);
}

export function templateCategoryWarnings(category?: string): RowIssue[] {
  const normalized = normalizeNameKey(category);
  if (!normalized) return [];
  if (SITE_PROPOSAL_CATEGORY_TAGS.some((tag) => normalized.includes(normalizeNameKey(tag)))) return [];
  return [{ code: 'TEMPLATE_CATEGORY_MISMATCH', message: 'Categoria non perfettamente allineata al Tema Colsova; import consentito con contenuti prudenti.' }];
}

export function allowedStatusTransition(current: string, next: string): boolean {
  if (current === next) return true;
  if (current === 'archived') return next === 'archived';
  return ['draft', 'ready', 'generated', 'error', 'archived'].includes(next);
}

function flattenObject(obj: JsonObject, prefix = ''): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...flattenObject(value as JsonObject, path));
    else out.push([path, value]);
  }
  return out;
}

function hasPath(obj: JsonObject, parts: string[]): boolean {
  let cursor: unknown = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || !(part in (cursor as JsonObject))) return false;
    cursor = (cursor as JsonObject)[part];
  }
  return true;
}

function setPath(obj: JsonObject, parts: string[], value: unknown) {
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]] as JsonObject;
  cursor[parts[parts.length - 1]] = value;
}

export function safeRelativeRoute(route: string): string {
  let value = cleanString(route, 160) || '';
  if (!value || value.startsWith('#')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes('\\') || value.includes('\0') || value.includes('?') || value.includes('..') || value.startsWith('/')) {
    throw new BadRequestException('Route non sicura');
  }
  if (value.startsWith('./')) value = value.slice(2);
  const parts = value.split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => !/^[a-z0-9][a-z0-9_-]*$/i.test(p) || ['con', 'prn', 'aux', 'nul'].includes(p.toLowerCase()))) {
    throw new BadRequestException('Route non sicura');
  }
  return parts.join('/');
}

function isSafeImageSource(value: string): boolean {
  if (!value) return true;
  if (validateImageUrl(value)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value)
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.includes('\0')
    && !value.includes('..')
    && !/[<>"']/.test(value);
}

export function redirectAnchorFor(key: string): string {
  return ROUTE_REDIRECT_ANCHORS[key] || '#home';
}
