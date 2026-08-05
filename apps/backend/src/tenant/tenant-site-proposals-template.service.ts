import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { ROUTE_REDIRECT_ANCHORS } from './tenant-site-proposals.constants';
import { getTemplateRegistration, SITE_PROPOSAL_TEMPLATE_REGISTRY, SiteProposalTemplateRegistration } from './tenant-site-proposals-template-registry';
import { JsonObject, RenderedHtml, TemplateManifest } from './tenant-site-proposals.types';
import { deepClone, forceTemplateContract, redirectAnchorFor, safeRelativeRoute, sha256, validateSiteConfig } from './tenant-site-proposals-validation';
import { ModularThemeManifest } from './tenant-site-proposals-theme-package.types';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { getProposalContentProfileAdapter, hasProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';

const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const UNSAFE_JSON_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const RENDER_COMPILER_VERSION = 'proposal-renderer-v2';
type ThemeManifest = TemplateManifest | ModularThemeManifest;
type LoadedTemplate = { html: string; config: JsonObject; sha256: string; manifest: ThemeManifest; registration: SiteProposalTemplateRegistration };
export type SiteProposalTemplateContext = { schema: string; dataSource: DataSource };
type DynamicRegistration = SiteProposalTemplateRegistration & { manifest?: ThemeManifest; defaultConfig?: JsonObject; compiledSha256?: string; compiledSize?: number };

function object(value: unknown): value is JsonObject { return !!value && typeof value === 'object' && !Array.isArray(value); }
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, i) => equal(item, right[i]));
  if (!object(left) || !object(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length || keys.some((key) => UNSAFE_JSON_KEYS.has(key))) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key]));
}

@Injectable()
export class TenantSiteProposalsTemplateService {
  private readonly cache = new Map<string, { expiresAt: number; pending: Promise<LoadedTemplate> }>();
  private readonly renderCache = new Map<string, { expiresAt: number; value: RenderedHtml }>();
  constructor(
    @Optional() private readonly fileStorage?: FileStorageService,
    @Optional() private readonly compiler?: TenantSiteProposalsThemeCompilerService,
    @Optional() private readonly packageService?: TenantSiteProposalsThemePackageService,
  ) {}

  async listTemplates() {
    const active = SITE_PROPOSAL_TEMPLATE_REGISTRY.filter((item) => item.isActive);
    const families = [...new Set(active.map((item) => item.slug))];
    return Promise.all(families.map(async (slug) => {
      const versions = active.filter((item) => item.slug === slug);
      const latest = versions.find((item) => item.isLatest)!;
      const loaded = await this.load(latest);
      return {
        slug, name: latest.name, version: latest.version, latestVersion: latest.version,
        versions: versions.map((item) => item.version), schemaVersion: latest.schemaVersion,
        manifest: loaded.manifest, categoryTags: latest.categoryTags, isActive: true,
      };
    }));
  }

  async getTemplate(slug: string, version?: string, context?: SiteProposalTemplateContext) {
    const registration = await this.resolveRegistration(slug, version, context, true);
    const loaded = await this.load(registration, context);
    return { slug, version: registration.version, schemaVersion: registration.schemaVersion, manifest: loaded.manifest };
  }

  async getRegistration(slug: string, version: string | undefined, context: SiteProposalTemplateContext, allowDraft = false, allowPending = false): Promise<SiteProposalTemplateRegistration> {
    return this.resolveRegistration(slug, version, context, allowDraft, allowPending);
  }

  async getDefaultConfig(slug = 'colsova', version?: string, context?: SiteProposalTemplateContext): Promise<JsonObject> {
    const registration = await this.resolveRegistration(slug, version, context, true);
    const loaded = await this.load(registration, context);
    const config = deepClone(loaded.config);
    forceTemplateContract(config, registration);
    validateSiteConfig(config, registration);
    return config;
  }

  async getManifest(slug = 'colsova', version?: string, context?: SiteProposalTemplateContext): Promise<TemplateManifest> {
    const registration = await this.resolveRegistration(slug, version, context, true);
    return (await this.load(registration, context)).manifest as TemplateManifest;
  }

  async getAllManifests() {
    return Promise.all(SITE_PROPOSAL_TEMPLATE_REGISTRY.filter((item) => item.isActive).map(async (registration) => ({ registration, manifest: (await this.load(registration)).manifest })));
  }

  async renderHtml(siteConfig: JsonObject, context?: SiteProposalTemplateContext, allowDraft = false): Promise<RenderedHtml> {
    const template = siteConfig.template as JsonObject | undefined;
    const registration = await this.resolveRegistration(String(template?.slug || ''), String(template?.templateVersion || ''), context, allowDraft, allowDraft);
    const loaded = await this.load(registration, context);
    const config = deepClone(siteConfig);
    this.assertProtectedConfig(config, loaded.config, registration);
    forceTemplateContract(config, registration);
    validateSiteConfig(config, registration);
    const serializedConfig = this.safeJson(config);
    const cacheKey = `${loaded.sha256}:${sha256(serializedConfig)}:${RENDER_COMPILER_VERSION}`;
    const cached = this.renderCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value };
    const matches = [...loaded.html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Nodo template-config mancante o duplicato');
    const match = matches[0];
    const payloadOffset = match[0].indexOf(match[1]);
    const payloadStart = match.index! + payloadOffset;
    const rendered = `${loaded.html.slice(0, payloadStart)}${serializedConfig}${loaded.html.slice(payloadStart + match[1].length)}`;
    this.verifyRendered(rendered, registration);
    const value = { html: rendered, sha256: sha256(rendered), size: Buffer.byteLength(rendered) };
    if (this.renderCache.size >= 100) this.renderCache.delete(this.renderCache.keys().next().value!);
    this.renderCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, value });
    return { ...value };
  }

  async buildRedirectFiles(config: JsonObject): Promise<{ path: string; html: string }[]> {
    const paths = ((((config.routing as JsonObject)?.paths) || {}) as JsonObject);
    const citySlug = String(((config.business as JsonObject)?.citySlug) || '');
    const seen = new Set<string>();
    const files: { path: string; html: string }[] = [];
    for (const [key, value] of Object.entries(paths)) {
      if (typeof value !== 'string' || value.startsWith('#') || !(key in ROUTE_REDIRECT_ANCHORS)) continue;
      const route = safeRelativeRoute(value.split('{citySlug}').join(citySlug));
      if (!route || seen.has(route.toLowerCase())) continue;
      seen.add(route.toLowerCase());
      files.push({ path: `${route}/index.html`, html: this.redirectHtml(redirectAnchorFor(key)) });
    }
    return files;
  }

  invalidate(schema?: string, slug?: string, version?: string) {
    for (const key of this.cache.keys()) if ((!schema || key.startsWith(`${schema}:`)) && (!slug || key.includes(`${slug}@`)) && (!version || key.endsWith(`:${version}`) || key.includes(`@${version}:`))) this.cache.delete(key);
    this.renderCache.clear();
  }

  private load(registration: DynamicRegistration, context?: SiteProposalTemplateContext) {
    const integrity = `${registration.format}:${registration.sourceSha256}:${registration.compiledSha256 || 'source'}`;
    const key = registration.isBuiltin ? `builtin:${registration.slug}@${registration.version}:${integrity}` : `${this.context(context).schema}:${registration.slug}@${registration.version}:${integrity}`;
    let cached = this.cache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      cached = { expiresAt: Date.now() + 5 * 60_000, pending: this.read(registration, context) };
      this.cache.set(key, cached);
    }
    return cached.pending;
  }

  private async read(registration: DynamicRegistration, context?: SiteProposalTemplateContext): Promise<LoadedTemplate> {
    if (registration.isBuiltin && registration.format === 'modular') return this.readBuiltinModular(registration);
    if (!registration.isBuiltin && registration.format === 'modular') return this.readUploadedModular(registration, context);
    const bytes = registration.isBuiltin
      ? await fs.readFile(path.join(__dirname, 'site-proposal-templates', ...registration.directory.split('/'), 'template.html'))
      : await this.readUploaded(registration, context);
    if (bytes.length !== registration.templateSize) throw new BadRequestException(`Dimensione sorgente del template ${registration.slug} ${registration.version} non valida`);
    const html = bytes.toString('utf8');
    const sourceSha256 = sha256(bytes);
    if (sourceSha256 !== registration.sourceSha256) throw new BadRequestException(`Hash sorgente del template ${registration.slug} ${registration.version} non valido`);
    const matches = [...html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Il template deve contenere esattamente un template-config');
    let config: JsonObject;
    try { config = JSON.parse(matches[0][1]) as JsonObject; } catch { throw new BadRequestException('JSON base del template non valido'); }
    if (!registration.isBuiltin && registration.defaultConfig && !equal(config, registration.defaultConfig)) throw new BadRequestException('Config storage diverso dal record tema');
    validateSiteConfig(config, registration);
    this.verifyRendered(html, registration);
    const fixedCounts = ((((config.editingContract as JsonObject)?.fixedCounts) || {}) as TemplateManifest['fixedCounts']);
    const manifest: ThemeManifest = registration.manifest || {
      name: registration.name, slug: registration.slug, versione: registration.version, version: registration.version,
      schemaVersion: registration.schemaVersion, layoutLocked: true, fixedCounts,
      textLimits: (config.textLimits || {}) as JsonObject, imageSlots: Object.keys((config.images || {}) as JsonObject),
      routes: Object.keys(((((config.routing as JsonObject)?.paths) || {}) as JsonObject)),
      categoryTags: [...registration.categoryTags], updatedAt: new Date().toISOString(), sourceSha256,
    };
    return { html, config, sha256: sourceSha256, manifest, registration };
  }

  private async readUploadedModular(registration: DynamicRegistration, context?: SiteProposalTemplateContext): Promise<LoadedTemplate> {
    const bytes = await this.readUploaded(registration, context);
    if (!registration.compiledSha256 || !registration.compiledSize || bytes.length !== registration.compiledSize || sha256(bytes) !== registration.compiledSha256) {
      throw new BadRequestException(`Artifact compilato del tema ${registration.slug} ${registration.version} non valido`);
    }
    if (!registration.defaultConfig || !registration.manifest) throw new BadRequestException('Metadata package modulare mancanti');
    const html = bytes.toString('utf8');
    const config = this.configFromHtml(html);
    config.textLimits = deepClone(registration.manifest.textLimits as JsonObject);
    forceTemplateContract(config, registration);
    validateSiteConfig(config, registration);
    this.verifyRendered(html, registration);
    return { html, config, sha256: registration.compiledSha256, manifest: registration.manifest, registration };
  }

  private async readBuiltinModular(registration: DynamicRegistration): Promise<LoadedTemplate> {
    const root = path.join(__dirname, 'site-proposal-templates', ...registration.directory.split('/'));
    const validator = this.packageService || new TenantSiteProposalsThemePackageService();
    const validated = await validator.validateDirectory(root, true);
    if (!validated.modularPackage) throw new BadRequestException('Package modulare built-in non valido');
    const modular = validated.modularPackage;
    if (modular.manifest.provenance.sourceTemplateSha256 !== registration.sourceSha256 || modular.manifest.provenance.sourceTemplateSize !== registration.templateSize) {
      throw new BadRequestException(`Provenienza del tema ${registration.slug} ${registration.version} non valida`);
    }
    const compiler = this.compiler || new TenantSiteProposalsThemeCompilerService(validator);
    const compiled = compiler.compileValidated(validated, undefined, true);
    const config = this.configFromHtml(compiled.html);
    config.textLimits = deepClone(modular.manifest.textLimits as JsonObject);
    forceTemplateContract(config, registration);
    validateSiteConfig(config, registration);
    this.verifyRendered(compiled.html, registration);
    return { html: compiled.html, config, sha256: compiled.sha256, manifest: modular.manifest, registration };
  }

  private async readUploaded(registration: DynamicRegistration, context?: SiteProposalTemplateContext): Promise<Buffer> {
    this.context(context);
    if (!this.fileStorage) throw new NotFoundException('Storage temi non disponibile');
    return registration.format === 'modular'
      ? this.fileStorage.readThemeCompiled(registration.slug, registration.version)
      : this.fileStorage.readThemeTemplate(registration.slug, registration.version);
  }

  private context(context?: SiteProposalTemplateContext): SiteProposalTemplateContext {
    if (!context?.schema || !context.dataSource) throw new ForbiddenException('Contesto tenant tema obbligatorio');
    const schema = safeSchema(context.schema, 'site proposal template context');
    if (schema !== SITE_PROPOSALS_TENANT) throw new ForbiddenException('Funzione disponibile solo per doflow');
    return { schema, dataSource: context.dataSource };
  }

  private async resolveRegistration(slug: string, version: string | undefined, context: SiteProposalTemplateContext | undefined, allowDraft: boolean, allowPending = true): Promise<DynamicRegistration> {
    try {
      const builtin = getTemplateRegistration(slug, version);
      this.assertRuntimeAdapter(builtin, allowPending);
      return builtin;
    } catch (error) { if (!(error instanceof NotFoundException)) throw error; }
    const safe = this.context(context);
    const params: unknown[] = [slug];
    let versionWhere = 'v.version=t.default_version';
    if (version) { params.push(version); versionWhere = `v.version=$${params.length}`; }
    const statuses = allowDraft ? "('active','draft')" : "('active')";
    const rows = await safe.dataSource.query(`SELECT t.slug,t.name,t.categories,t.default_version,v.version,v.schema_version,v.contract_version,v.content_profile,v.status,v.template_sha256,v.template_size,v.manifest,v.default_config,v.source_format,v.format_version,v.compiled_sha256,v.compiled_size,v.runtime_adapter_status FROM "${safe.schema}".site_proposal_themes t JOIN "${safe.schema}".site_proposal_theme_versions v ON v.theme_id=t.id WHERE t.slug=$1 AND ${versionWhere} AND t.is_active=true AND v.status IN ${statuses} LIMIT 1`, params);
    const row = rows[0];
    if (!row) throw new NotFoundException('Template non trovato');
    const registration = {
      slug: row.slug, name: row.name, version: row.version, schemaVersion: row.schema_version, sourceSha256: row.template_sha256,
      directory: '', isActive: row.status === 'active', isLatest: row.default_version === row.version, categoryTags: Array.isArray(row.categories) ? row.categories : [],
      contractVersion: row.contract_version, contentProfile: row.content_profile, templateSize: Number(row.template_size), isBuiltin: false,
      format: row.source_format === 'modular' ? 'modular' : 'standalone', formatVersion: row.format_version || undefined,
      runtimeAdapterStatus: row.runtime_adapter_status === 'ready' ? 'ready' : 'pending',
      selectableForProposal: row.runtime_adapter_status === 'ready', selectableForImport: row.runtime_adapter_status === 'ready',
      visible: true, preview: true, download: true, defaultCandidate: row.runtime_adapter_status === 'ready', recommendationTags: [],
      manifest: row.manifest, defaultConfig: row.default_config, compiledSha256: row.compiled_sha256 || undefined, compiledSize: row.compiled_size ? Number(row.compiled_size) : undefined,
    } as DynamicRegistration;
    this.assertRuntimeAdapter(registration, allowPending);
    return registration;
  }

  private assertRuntimeAdapter(registration: SiteProposalTemplateRegistration, allowPending: boolean) {
    const adapterAvailable = registration.contentProfile === 'colsova-legacy-v1' || hasProposalContentProfileAdapter(registration.contentProfile);
    if (!allowPending && (registration.runtimeAdapterStatus !== 'ready' || !registration.selectableForProposal || !adapterAvailable)) {
      throw new BadRequestException('Tema disponibile in anteprima, adattatore di generazione non ancora attivo.');
    }
  }

  private assertProtectedConfig(config: JsonObject, base: JsonObject, registration: SiteProposalTemplateRegistration) {
    for (const key of ['editingContract', 'textLimits']) if (!equal(config[key], base[key])) throw new BadRequestException(`Chiave protetta modificata: ${key}`);
    if (registration.contractVersion === '1.0' && !equal(config._README, base._README)) throw new BadRequestException('Chiave protetta modificata: _README');
    const template = (config.template || {}) as JsonObject;
    if (template.slug !== registration.slug || template.schemaVersion !== registration.schemaVersion || template.templateVersion !== registration.version || template.layoutLocked !== true) throw new BadRequestException('Contratto template protetto modificato');
    const routing = (config.routing || {}) as JsonObject;
    const baseRouting = (base.routing || {}) as JsonObject;
    if (registration.contentProfile === 'beauty-editorial-v1' || registration.contentProfile === 'beauty-conversion-v1') {
      if (!equal(routing, baseRouting)) throw new BadRequestException('Routing protetto modificato');
    } else if (routing.localPreviewMode !== true || !object(routing.paths) || !object(baseRouting.paths) || Object.keys(routing.paths).sort().join('|') !== Object.keys(baseRouting.paths).sort().join('|')) {
      throw new BadRequestException('Routing protetto modificato');
    }
    if (registration.contractVersion === '1.0' && !equal(routing.labels, baseRouting.labels)) throw new BadRequestException('Etichette routing protette modificate');
    const images = config.images;
    if (!object(images) || !object(base.images) || Object.keys(images).sort().join('|') !== Object.keys(base.images).sort().join('|')) throw new BadRequestException('Slot immagini protetti modificati');
    if (registration.contractVersion === '1.0') {
      for (const slot of Object.keys(base.images)) {
        const image = images[slot] as JsonObject; const baseImage = base.images[slot] as JsonObject;
        for (const key of ['placeholderLabel','recommendedSize','aspectRatio']) if (!equal(image?.[key],baseImage?.[key])) throw new BadRequestException(`Metadato immagine protetto modificato: ${slot}.${key}`);
      }
      const palette = config.palette as JsonObject[];
      const basePalette = base.palette as JsonObject[];
      if (!Array.isArray(palette) || !Array.isArray(basePalette) || palette.length !== basePalette.length || palette.some((entry, index) => entry.variable !== basePalette[index].variable || entry.role !== basePalette[index].role)) throw new BadRequestException('Struttura palette protetta modificata');
    } else if (!object(config.palette) || !object(base.palette) || Object.keys(config.palette).sort().join('|') !== Object.keys(base.palette).sort().join('|')) throw new BadRequestException('Struttura palette protetta modificata');
    if (registration.contentProfile === 'colsova-conversion-v1') {
      if (!equal(config.assets, base.assets)) throw new BadRequestException('Asset credits protetti modificati');
      const business = config.business as JsonObject; const baseBusiness = base.business as JsonObject;
      if (business?.developerUrl !== baseBusiness?.developerUrl || business?.developerCredit !== baseBusiness?.developerCredit) throw new BadRequestException('Developer credit protetto modificato');
      const content = config.content as JsonObject; const baseContent = base.content as JsonObject;
      const features = config.features as JsonObject;
      if (features?.reviewsMode === 'demo' && (!equal(content?.reviews, baseContent?.reviews) || !equal((content?.reviewsIntro as JsonObject)?.disclaimer, (baseContent?.reviewsIntro as JsonObject)?.disclaimer))) throw new BadRequestException('Recensioni dimostrative protette modificate');
    }
    if (hasProposalContentProfileAdapter(registration.contentProfile)) {
      const adapter = getProposalContentProfileAdapter(registration.contentProfile);
      const content = (config.content || {}) as JsonObject;
      const baseContent = (base.content || {}) as JsonObject;
      for (const key of adapter.protectedContentPaths) {
        if (!equal(content[key], baseContent[key])) throw new BadRequestException(`Contenuto protetto modificato: ${key}`);
      }
    }
  }

  private verifyRendered(html: string, registration: SiteProposalTemplateRegistration) {
    if (!html.includes('template-config') || !html.includes('Content-Security-Policy') || !/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)/i.test(html)) throw new BadRequestException('Requisiti di sicurezza del template mancanti');
    const classCount = (name: string) => (html.match(new RegExp(`class=["'][^"']*\\b${name}\\b`, 'g')) || []).length;
    if (registration.contractVersion === '1.0') {
      if (classCount('treatment-card') !== 3 || classCount('product-point') !== 3 || classCount('review-card') !== 6 || classCount('faq-item') !== 6) throw new BadRequestException('Struttura fissa del template Colsova 1.0 non valida');
    } else if (registration.contentProfile === 'colsova-conversion-v1') {
      if (classCount('review-card') !== 6 || classCount('faq-item') !== 6 || !html.includes('id="trattamenti"') || !html.includes('id="contatti"') || !html.includes('id="come-funziona"')) throw new BadRequestException('Struttura del template Colsova 2.4.1 non valida');
    } else if (registration.contentProfile === 'beauty-editorial-v1' || registration.contentProfile === 'beauty-conversion-v1') {
      if (!html.includes('data-doflow-slot') || !html.includes('scripts/theme.js') && !html.includes('data-doflow-entry="scripts/theme.js"')) throw new BadRequestException('Struttura del tema beauty non valida');
    } else if (classCount('faq-item') !== 1 || !html.includes('id="services"') || !html.includes('id="trust"')) throw new BadRequestException('Struttura del template Colsova 2.0 non valida');
  }

  private safeJson(value: unknown) { return JSON.stringify(value, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
  private configFromHtml(html: string): JsonObject {
    const matches = [...html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Il template deve contenere esattamente un template-config');
    try { return JSON.parse(matches[0][1]) as JsonObject; } catch { throw new BadRequestException('JSON base del template non valido'); }
  }
  private redirectHtml(anchor: string) { const target = `../index.html${anchor}`; return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0; url=${target}"><title>Anteprima demo</title></head><body><p><a href="${target}">Apri l'anteprima</a></p></body></html>`; }
}
