import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  COLSOVA_TEMPLATE,
  ROUTE_REDIRECT_ANCHORS,
  SITE_PROPOSAL_CATEGORY_TAGS,
} from './tenant-site-proposals.constants';
import { JsonObject, RenderedHtml, TemplateManifest } from './tenant-site-proposals.types';
import {
  deepClone,
  forceTemplateContract,
  redirectAnchorFor,
  safeRelativeRoute,
  sha256,
  validateSiteConfig,
} from './tenant-site-proposals-validation';

const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const UNSAFE_JSON_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepEqualJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => deepEqualJson(item, right[index]));
  }
  if (!isJsonObject(left) || !isJsonObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.some((key) => UNSAFE_JSON_KEYS.has(key)) || rightKeys.some((key) => UNSAFE_JSON_KEYS.has(key))) return false;
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqualJson(left[key], right[key]));
}

function sameJsonKeys(left: JsonObject, right: JsonObject): boolean {
  return deepEqualJson(Object.keys(left).sort(), Object.keys(right).sort());
}

@Injectable()
export class TenantSiteProposalsTemplateService {
  private templateCache?: Promise<{ html: string; config: JsonObject; sha256: string; manifest: TemplateManifest }>;

  async listTemplates() {
    const colsova = await this.loadColsova();
    return [{ slug: COLSOVA_TEMPLATE.slug, name: COLSOVA_TEMPLATE.name, version: COLSOVA_TEMPLATE.version, schemaVersion: COLSOVA_TEMPLATE.schemaVersion, manifest: colsova.manifest, isActive: true }];
  }

  async getTemplate(slug: string, version: string = COLSOVA_TEMPLATE.version) {
    if (slug !== COLSOVA_TEMPLATE.slug || version !== COLSOVA_TEMPLATE.version) throw new NotFoundException('Template non trovato');
    const loaded = await this.loadColsova();
    return { slug, version, schemaVersion: COLSOVA_TEMPLATE.schemaVersion, manifest: loaded.manifest };
  }

  async getDefaultConfig(slug: string = COLSOVA_TEMPLATE.slug, version: string = COLSOVA_TEMPLATE.version): Promise<JsonObject> {
    if (slug !== COLSOVA_TEMPLATE.slug || version !== COLSOVA_TEMPLATE.version) throw new NotFoundException('Template non trovato');
    const loaded = await this.loadColsova();
    const config = deepClone(loaded.config);
    forceTemplateContract(config);
    validateSiteConfig(config);
    return config;
  }

  async getManifest(): Promise<TemplateManifest> {
    return (await this.loadColsova()).manifest;
  }

  async renderHtml(siteConfig: JsonObject): Promise<RenderedHtml> {
    const loaded = await this.loadColsova();
    const config = deepClone(siteConfig);
    this.assertProtectedConfig(config, loaded.config);
    forceTemplateContract(config);
    validateSiteConfig(config);
    const matches = [...loaded.html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Nodo template-config mancante o duplicato');
    const match = matches[0];
    const safeJson = this.safeJson(config);
    const payloadOffset = match[0].indexOf(match[1]);
    const payloadStart = match.index! + payloadOffset;
    const payloadEnd = payloadStart + match[1].length;
    const rendered = `${loaded.html.slice(0, payloadStart)}${safeJson}${loaded.html.slice(payloadEnd)}`;
    this.verifyRendered(rendered);
    return { html: rendered, sha256: sha256(rendered), size: Buffer.byteLength(rendered) };
  }

  async buildRedirectFiles(config: JsonObject): Promise<{ path: string; html: string }[]> {
    const routing = (config.routing || {}) as JsonObject;
    const paths = (routing.paths || {}) as JsonObject;
    const business = (config.business || {}) as JsonObject;
    const citySlug = typeof business.citySlug === 'string' ? business.citySlug : '';
    const seen = new Set<string>();
    const files: { path: string; html: string }[] = [];
    for (const [key, value] of Object.entries(paths)) {
      if (typeof value !== 'string' || value.startsWith('#')) continue;
      if (!(key in ROUTE_REDIRECT_ANCHORS)) continue;
      const route = safeRelativeRoute(value.split('{citySlug}').join(citySlug));
      if (!route || seen.has(route.toLowerCase())) continue;
      seen.add(route.toLowerCase());
      const anchor = redirectAnchorFor(key);
      files.push({ path: `${route}/index.html`, html: this.redirectHtml(anchor) });
    }
    return files;
  }

  private async loadColsova() {
    if (!this.templateCache) this.templateCache = this.readColsova();
    return this.templateCache;
  }

  private async readColsova() {
    const templatePath = path.join(__dirname, 'site-proposal-templates', 'colsova', '1.0.0', 'template.html');
    const bytes = await fs.readFile(templatePath);
    const html = bytes.toString('utf8');
    const sourceSha256 = sha256(bytes);
    if (sourceSha256 !== COLSOVA_TEMPLATE.sourceSha256) throw new BadRequestException('Hash sorgente del template Colsova non valido');
    const matches = [...html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Il template Colsova deve contenere esattamente un template-config');
    let config: JsonObject;
    try {
      config = JSON.parse(matches[0][1]) as JsonObject;
    } catch {
      throw new BadRequestException('JSON base del template Colsova non valido');
    }
    validateSiteConfig(config);
    const domCounts = this.countFixed(html);
    if (domCounts.treatmentCards !== 3 || domCounts.productPoints !== 3 || domCounts.reviews !== 6 || domCounts.faqs !== 6) {
      throw new BadRequestException('Struttura fissa del template Colsova non valida');
    }
    const fixedCounts = ((((config.editingContract as JsonObject)?.fixedCounts) || {}) as TemplateManifest['fixedCounts']);
    const manifest: TemplateManifest = {
      name: COLSOVA_TEMPLATE.name,
      slug: COLSOVA_TEMPLATE.slug,
      versione: COLSOVA_TEMPLATE.version,
      version: COLSOVA_TEMPLATE.version,
      schemaVersion: COLSOVA_TEMPLATE.schemaVersion,
      layoutLocked: true,
      fixedCounts,
      textLimits: (config.textLimits || {}) as JsonObject,
      imageSlots: Object.keys((config.images || {}) as JsonObject),
      routes: Object.keys((((config.routing as JsonObject)?.paths as JsonObject) || {})),
      categoryTags: SITE_PROPOSAL_CATEGORY_TAGS,
      updatedAt: new Date().toISOString(),
      sourceSha256,
    };
    return { html, config, sha256: sourceSha256, manifest };
  }

  private safeJson(value: unknown): string {
    return JSON.stringify(value, null, 2)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  private assertProtectedConfig(config: JsonObject, base: JsonObject) {
    for (const key of ['_README', 'editingContract', 'textLimits']) {
      if (!deepEqualJson(config[key], base[key])) throw new BadRequestException(`Chiave protetta modificata: ${key}`);
    }
    const template = (config.template || {}) as JsonObject;
    if (template.schemaVersion !== COLSOVA_TEMPLATE.schemaVersion || template.templateVersion !== COLSOVA_TEMPLATE.version || template.layoutLocked !== true) {
      throw new BadRequestException('Contratto template protetto modificato');
    }
    const routing = (config.routing || {}) as JsonObject;
    const baseRouting = (base.routing || {}) as JsonObject;
    if (routing.localPreviewMode !== true || !deepEqualJson(routing.labels, baseRouting.labels)) {
      throw new BadRequestException('Routing protetto modificato');
    }
    const paths = routing.paths;
    const basePaths = baseRouting.paths;
    if (!isJsonObject(paths) || !isJsonObject(basePaths) || !sameJsonKeys(paths, basePaths)) {
      throw new BadRequestException('Chiavi route protette modificate');
    }

    const palette = config.palette as JsonObject[];
    const basePalette = base.palette as JsonObject[];
    if (!Array.isArray(palette) || palette.length !== basePalette.length || palette.some((entry, index) => entry.variable !== basePalette[index].variable || entry.role !== basePalette[index].role)) {
      throw new BadRequestException('Struttura palette protetta modificata');
    }

    const images = config.images;
    const baseImages = base.images;
    if (!isJsonObject(images) || !isJsonObject(baseImages) || !sameJsonKeys(images, baseImages)) {
      throw new BadRequestException('Slot immagini protetti modificati');
    }
    for (const slot of Object.keys(baseImages)) {
      const image = images[slot] as JsonObject;
      const baseImage = baseImages[slot] as JsonObject;
      for (const key of ['placeholderLabel', 'recommendedSize', 'aspectRatio']) {
        if (!deepEqualJson(image?.[key], baseImage?.[key])) throw new BadRequestException(`Metadato immagine protetto modificato: ${slot}.${key}`);
      }
    }
  }

  private verifyRendered(html: string) {
    if (!html.includes('template-config')) throw new BadRequestException('template-config assente dal render');
    if (!html.includes('Content-Security-Policy')) throw new BadRequestException('CSP assente dal render');
    if (!/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)/i.test(html)) throw new BadRequestException('noindex assente dal render');
    const counts = this.countFixed(html);
    if (counts.treatmentCards !== 3 || counts.productPoints !== 3 || counts.reviews !== 6 || counts.faqs !== 6) {
      throw new BadRequestException('Conteggi fissi alterati dal render');
    }
  }

  private countFixed(html: string) {
    return {
      treatmentCards: this.classCount(html, 'treatment-card'),
      productPoints: this.classCount(html, 'product-point'),
      reviews: this.classCount(html, 'review-card'),
      faqs: this.classCount(html, 'faq-item'),
    };
  }

  private classCount(html: string, className: string): number {
    const re = new RegExp(`class=["'][^"']*\\b${className}\\b`, 'g');
    return (html.match(re) || []).length;
  }

  private redirectHtml(anchor: string): string {
    const target = `../index.html${anchor}`;
    return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta http-equiv="refresh" content="0; url=${target}">
  <title>Anteprima demo</title>
</head>
<body>
  <p><a href="${target}">Apri l'anteprima</a></p>
</body>
</html>
`;
  }
}
