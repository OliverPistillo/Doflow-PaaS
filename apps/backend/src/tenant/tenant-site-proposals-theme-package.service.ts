import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yauzl from 'yauzl';
import { JsonObject, ProposalContentProfile } from './tenant-site-proposals.types';
import { assertNoPrototypePollution, sha256 } from './tenant-site-proposals-validation';
import { ModularThemeAsset, ModularThemeFileInventory, ModularThemeManifest, ModularThemePackage, ThemePackageFormat } from './tenant-site-proposals-theme-package.types';

const MAX_ZIP = 10 * 1024 * 1024;
const MAX_FILES = 80;
const MAX_UNCOMPRESSED = 25 * 1024 * 1024;
const MAX_STANDALONE_FILES = 25;
const MAX_TEMPLATE = 5 * 1024 * 1024;
const MAX_DOCUMENT = 1024 * 1024;
const TRUSTED_BUILTIN_SOURCE_HASHES = new Set([
  'cdc959eaa870485134fc2e93bade901eebf20e0af54d2d8d4113c904790da5a6',
  '9f990c78514508cfe832a69e8a5caec21271085bed8eb977ff9dfce9ce6bd2c2',
  '395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263',
]);
const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const REQUIRED_MANIFEST = ['name','slug','version','schemaVersion','contractVersion','entry','templateSha256','size','categories','standalone'] as const;
const EXECUTABLE_EXTENSIONS = /\.(?:exe|dll|com|bat|cmd|ps1|sh|bash|mjs|cjs|jar|php|py|rb|pl|cgi|msi|scr|app|deb|rpm)$/i;
const SUPPORTED_PACKAGE_CONTRACTS = new Set([
  '2.0|2.0|proposal-basic-v2',
  '2.0|2.0|colsova-conversion-v1',
  '2.0|2.1|colsova-conversion-v1',
  '2.0|2.1|beauty-editorial-v1',
  '2.0|2.1|beauty-conversion-v1',
]);
const CSP_NONE_DIRECTIVES = ['default-src', 'connect-src', 'object-src', 'frame-src', 'form-action', 'base-uri'] as const;
const CSP_HASH = /^'sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}'$/;
const TRUSTED_SELF_IMAGE_TEMPLATE_SHA256 = new Set(['395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263']);

type PackageEntry = { path: string; buffer: Buffer };
export type ValidatedThemePackage = {
  manifest: JsonObject;
  contentProfile: ProposalContentProfile;
  template: Buffer;
  manifestBuffer: Buffer;
  documentation: Record<string, Buffer>;
  defaultConfig: JsonObject;
  templateSha256: string;
  templateSize: number;
  zipSha256: string;
  zipSize: number;
  validationReport: JsonObject;
  warnings: string[];
  format: ThemePackageFormat;
  files: Record<string, Buffer>;
  modularPackage?: ModularThemePackage;
  sourcePackageSha256?: string;
};

function object(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

@Injectable()
export class TenantSiteProposalsThemePackageService {
  validateCompiledHtml(html: string, trustedDeveloperCredit = false, allowDemoForms = false): void {
    const $ = cheerio.load(html);
    const applicationJs = $('script').toArray().filter((element) => $(element).attr('id') !== 'template-config').map((element) => $(element).html() || '').join('\n');
    this.validateTemplateSecurity(html, false, { styleEntries: [], scriptEntries: [], applicationJs, trustedDeveloperCredit, allowDemoForms });
    if (/<link\b[^>]*\brel\s*=\s*["'][^"']*stylesheet/i.test(html) || /<script\b[^>]*\bsrc\s*=/i.test(html)) throw new BadRequestException('HTML compilato contiene entry locali residue');
    if (/(?:src|poster|href)\s*=\s*["'](?:styles|scripts|assets)\//i.test(html) || /url\s*\(\s*["']?(?:\.\.\/)?assets\//i.test(html)) throw new BadRequestException('HTML compilato contiene asset locali residui');
  }

  async validate(buffer: Buffer): Promise<ValidatedThemePackage> {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ZIP) throw new BadRequestException('Il pacchetto ZIP deve essere compreso entro 10 MiB.');
    const entries = await this.readArchive(buffer);
    const normalized = this.stripOptionalRoot(entries);
    const byPath = new Map(normalized.map((entry) => [entry.path.toLowerCase(), entry]));
    const manifestEntry = byPath.get('theme.json');
    if (!manifestEntry) throw new BadRequestException('theme.json mancante');
    let manifest: JsonObject;
    try { manifest = JSON.parse(manifestEntry.buffer.toString('utf8')) as JsonObject; } catch { throw new BadRequestException('theme.json non contiene JSON valido'); }
    assertNoPrototypePollution(manifest, 'theme.json');
    if (manifest.format === 'modular') return this.validateModular(normalized, manifest, buffer, false);
    return this.validateStandalone(normalized, manifest, buffer);
  }

  async validateDirectory(rootPath: string, trustedBuiltin = true): Promise<ValidatedThemePackage> {
    const absolute = path.resolve(rootPath);
    if (!path.isAbsolute(absolute)) throw new BadRequestException('Directory package non assoluta');
    const entries: PackageEntry[] = [];
    const visit = async (directory: string, relative = ''): Promise<void> => {
      const children = await fs.readdir(directory, { withFileTypes: true });
      for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
        if (child.name.startsWith('.')) throw new BadRequestException(`File nascosto non consentito: ${child.name}`);
        const childRelative = relative ? `${relative}/${child.name}` : child.name;
        const childAbsolute = path.join(directory, child.name);
        const stat = await fs.lstat(childAbsolute);
        if (stat.isSymbolicLink()) throw new BadRequestException(`Symlink non consentito: ${childRelative}`);
        if (stat.isDirectory()) await visit(childAbsolute, childRelative);
        else if (stat.isFile()) entries.push({ path: childRelative.replace(/\\/g, '/'), buffer: await fs.readFile(childAbsolute) });
      }
    };
    await visit(absolute);
    if (!entries.length || entries.length > MAX_FILES) throw new BadRequestException(`Il package deve contenere da 1 a ${MAX_FILES} file`);
    const manifestEntry = entries.find((entry) => entry.path.toLowerCase() === 'theme.json');
    if (!manifestEntry) throw new BadRequestException('theme.json mancante');
    let manifest: JsonObject;
    try { manifest = JSON.parse(manifestEntry.buffer.toString('utf8')) as JsonObject; } catch { throw new BadRequestException('theme.json non contiene JSON valido'); }
    assertNoPrototypePollution(manifest, 'theme.json');
    if (manifest.format !== 'modular') throw new BadRequestException('La directory built-in deve essere un package modulare');
    return this.validateModular(entries, manifest, undefined, trustedBuiltin);
  }

  private validateStandalone(normalized: PackageEntry[], manifest: JsonObject, buffer: Buffer): ValidatedThemePackage {
    if (normalized.length > MAX_STANDALONE_FILES) throw new BadRequestException(`Il pacchetto standalone supera ${MAX_STANDALONE_FILES} file`);
    const byPath = new Map(normalized.map((entry) => [entry.path.toLowerCase(), entry]));
    const templateEntry = byPath.get('template.html');
    const manifestEntry = byPath.get('theme.json')!;
    if (!templateEntry) throw new BadRequestException('template.html mancante');
    if (templateEntry.buffer.length > MAX_TEMPLATE) throw new BadRequestException('template.html supera 5 MiB');
    for (const key of REQUIRED_MANIFEST) if (!Object.prototype.hasOwnProperty.call(manifest, key)) throw new BadRequestException(`Campo manifest mancante: ${key}`);
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) throw new BadRequestException('Nome tema non valido');
    if (typeof manifest.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.slug)) throw new BadRequestException('Slug tema non sicuro');
    if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) throw new BadRequestException('Versione tema non semver');
    if (manifest.entry !== 'template.html' || manifest.standalone !== true) throw new BadRequestException('Il tema deve essere standalone con entry template.html');
    if (!Array.isArray(manifest.categories) || !manifest.categories.length || manifest.categories.some((item) => typeof item !== 'string' || !item.trim())) throw new BadRequestException('Categorie tema non valide');
    const templateSha256 = sha256(templateEntry.buffer);
    if (String(manifest.templateSha256).toLowerCase() !== templateSha256) throw new BadRequestException('Hash template diverso dal manifest');
    if (Number(manifest.size) !== templateEntry.buffer.length) throw new BadRequestException('Dimensione template diversa dal manifest');

    const html = templateEntry.buffer.toString('utf8');
    const matches = [...html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Il template deve contenere esattamente un template-config');
    let defaultConfig: JsonObject;
    try { defaultConfig = JSON.parse(matches[0][1]) as JsonObject; } catch { throw new BadRequestException('template-config non contiene JSON valido'); }
    assertNoPrototypePollution(defaultConfig, 'template-config');
    const templateMetadata = object(defaultConfig.template) ? defaultConfig.template : {};
    if (templateMetadata.slug !== manifest.slug || templateMetadata.templateVersion !== manifest.version || templateMetadata.schemaVersion !== manifest.schemaVersion) throw new BadRequestException('Metadata template non coerenti con il manifest');
    const contentProfile = this.contentProfile(manifest, defaultConfig);
    const contractKey = `${String(manifest.schemaVersion)}|${String(manifest.contractVersion)}|${contentProfile}`;
    if (!SUPPORTED_PACKAGE_CONTRACTS.has(contractKey)) throw new BadRequestException('Combinazione schemaVersion, contractVersion e contentProfile non supportata');
    this.validateTemplateSecurity(html, TRUSTED_SELF_IMAGE_TEMPLATE_SHA256.has(templateSha256));
    this.validateDataUris(html);
    this.validateProfile(defaultConfig, contentProfile);

    const documentation: Record<string, Buffer> = {};
    for (const entry of normalized) {
      if (['template.html','theme.json'].includes(entry.path.toLowerCase())) continue;
      if (!/\.(?:md|txt)$/i.test(entry.path) || entry.path.includes('/')) throw new BadRequestException(`File non documentale non consentito: ${entry.path}`);
      if (entry.buffer.length > MAX_DOCUMENT) throw new BadRequestException(`Documento oltre 1 MiB: ${entry.path}`);
      documentation[entry.path] = entry.buffer;
    }
    const warnings = contentProfile === manifest.contentProfile ? [] : [`contentProfile inferito prudentemente: ${contentProfile}`];
    return {
      manifest, contentProfile, template: templateEntry.buffer, manifestBuffer: manifestEntry.buffer, documentation, defaultConfig,
      templateSha256, templateSize: templateEntry.buffer.length, zipSha256: sha256(buffer), zipSize: buffer.length,
      validationReport: { valid: true, contentProfile, inferredContentProfile: manifest.contentProfile ? null : contentProfile, checks: { zipSlip: true, symlink: true, zipBomb: true, csp: true, standalone: true, dataUris: true, profile: true } },
      warnings, format: 'standalone', files: Object.fromEntries(normalized.map((entry) => [entry.path, entry.buffer])),
    };
  }

  private validateModular(entries: PackageEntry[], rawManifest: JsonObject, zipBuffer: Buffer | undefined, trustedBuiltin: boolean): ValidatedThemePackage {
    const required = ['name','slug','version','schemaVersion','contractVersion','formatVersion','format','entry','styleEntries','scriptEntries','assetRoot','contentProfile','runtimeAdapterStatus','categories','recommendationTags','collections','fixedCounts','features','paletteKeys','imageSlots','socialSlots','editablePaths','protectedPaths','textLimits','assetMap','security','provenance'];
    for (const key of required) if (!Object.prototype.hasOwnProperty.call(rawManifest, key)) throw new BadRequestException(`Campo manifest modulare mancante: ${key}`);
    if (typeof rawManifest.name !== 'string' || !rawManifest.name.trim()) throw new BadRequestException('Nome tema non valido');
    if (typeof rawManifest.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawManifest.slug)) throw new BadRequestException('Slug tema non sicuro');
    if (typeof rawManifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(rawManifest.version)) throw new BadRequestException('Versione tema non semver');
    if (rawManifest.schemaVersion !== '2.0' || rawManifest.contractVersion !== '2.1' || rawManifest.formatVersion !== '1.0' || rawManifest.format !== 'modular') throw new BadRequestException('Combinazione schema/contract/format modulare non supportata');
    if (rawManifest.entry !== 'template.html' || rawManifest.assetRoot !== 'assets') throw new BadRequestException('Entry o assetRoot modulare non supportati');
    const styleEntries = this.stringArray(rawManifest.styleEntries, 'styleEntries', 1, 3).map((entry) => this.safePackagePath(entry, 'styles/', '.css'));
    const scriptEntries = this.stringArray(rawManifest.scriptEntries, 'scriptEntries', 1, 3).map((entry) => this.safePackagePath(entry, 'scripts/', '.js'));
    const categories = this.stringArray(rawManifest.categories, 'categories', 1, 30);
    this.stringArray(rawManifest.recommendationTags, 'recommendationTags', 0, 30);
    const contentProfile = String(rawManifest.contentProfile) as ProposalContentProfile;
    const contractKey = `${rawManifest.schemaVersion}|${rawManifest.contractVersion}|${contentProfile}`;
    if (!SUPPORTED_PACKAGE_CONTRACTS.has(contractKey)) throw new BadRequestException('Combinazione schemaVersion, contractVersion e contentProfile non supportata');
    if (!trustedBuiltin && rawManifest.runtimeAdapterStatus !== 'pending') throw new BadRequestException('Un package caricato non può autoassegnarsi runtimeAdapterStatus ready');
    if (!['ready','pending'].includes(String(rawManifest.runtimeAdapterStatus))) throw new BadRequestException('runtimeAdapterStatus non valido');
    if (!object(rawManifest.security) || rawManifest.security.networkAccess !== false || rawManifest.security.allowExternalHttpsLinks !== false || typeof rawManifest.security.allowDemoForms !== 'boolean') throw new BadRequestException('Dichiarazione security modulare non valida');
    if (!object(rawManifest.provenance) || rawManifest.provenance.sourceType !== 'user-supplied-standalone' || !/^[a-f0-9]{64}$/i.test(String(rawManifest.provenance.sourceTemplateSha256 || '')) || !Number.isSafeInteger(rawManifest.provenance.sourceTemplateSize) || Number(rawManifest.provenance.sourceTemplateSize) <= 0 || !Array.isArray(rawManifest.provenance.normalizations)) throw new BadRequestException('Provenienza modulare non valida');

    const lower = new Set<string>();
    const byPath = new Map<string, Buffer>();
    let total = 0;
    for (const entry of entries.sort((left, right) => left.path.localeCompare(right.path))) {
      const safe = this.safePackagePath(entry.path);
      const canonical = safe.toLowerCase();
      if (lower.has(canonical)) throw new BadRequestException(`Nome duplicato case-insensitive: ${safe}`);
      lower.add(canonical); byPath.set(safe, entry.buffer); total += entry.buffer.length;
    }
    if (entries.length > MAX_FILES) throw new BadRequestException(`Il package modulare supera ${MAX_FILES} file`);
    if (total > MAX_UNCOMPRESSED) throw new BadRequestException('Contenuto non compresso oltre 25 MiB');
    const template = byPath.get('template.html');
    const manifestBuffer = byPath.get('theme.json');
    if (!template) throw new BadRequestException('template.html mancante');
    if (!manifestBuffer) throw new BadRequestException('theme.json mancante');
    if (template.length > MAX_TEMPLATE) throw new BadRequestException('template.html supera 5 MiB');
    for (const entry of styleEntries) {
      const value = byPath.get(entry); if (!value) throw new BadRequestException(`CSS mancante: ${entry}`);
      if (!value.length || value.length > 1024 * 1024) throw new BadRequestException(`CSS vuoto o oltre 1 MiB: ${entry}`);
    }
    for (const entry of scriptEntries) {
      const value = byPath.get(entry); if (!value) throw new BadRequestException(`JavaScript mancante: ${entry}`);
      if (!value.length || value.length > 1024 * 1024) throw new BadRequestException(`JavaScript vuoto o oltre 1 MiB: ${entry}`);
    }

    const html = template.toString('utf8');
    const matches = [...html.matchAll(SCRIPT_RE)];
    if (matches.length !== 1) throw new BadRequestException('Il template deve contenere esattamente un template-config');
    let defaultConfig: JsonObject;
    try { defaultConfig = JSON.parse(matches[0][1]) as JsonObject; } catch { throw new BadRequestException('template-config non contiene JSON valido'); }
    assertNoPrototypePollution(defaultConfig, 'template-config');
    const templateMetadata = object(defaultConfig.template) ? defaultConfig.template : {};
    if (templateMetadata.slug !== rawManifest.slug || templateMetadata.templateVersion !== rawManifest.version || templateMetadata.schemaVersion !== rawManifest.schemaVersion) throw new BadRequestException('Metadata template non coerenti con il manifest');

    const cssSources = styleEntries.map((entry) => byPath.get(entry)!.toString('utf8'));
    const jsSources = scriptEntries.map((entry) => byPath.get(entry)!.toString('utf8'));
    const trustedSelf = trustedBuiltin && TRUSTED_BUILTIN_SOURCE_HASHES.has(String(rawManifest.provenance.sourceTemplateSha256).toLowerCase());
    this.validateTemplateSecurity(html, trustedSelf, { styleEntries, scriptEntries, applicationJs: jsSources.join('\n'), trustedDeveloperCredit: trustedSelf, allowDemoForms: (rawManifest.security as JsonObject).allowDemoForms === true });
    styleEntries.forEach((entry, index) => this.validateCss(cssSources[index], entry, byPath));
    jsSources.forEach((source) => this.validateApplicationJavascript(source));
    this.validateDataUris([html, ...cssSources, ...jsSources].join('\n'));

    const assetMapRaw = rawManifest.assetMap;
    if (!object(assetMapRaw) || !Object.keys(assetMapRaw).length) throw new BadRequestException('assetMap mancante o vuota');
    const assetInventoryByPath = new Map<string, ModularThemeAsset>();
    const hashes = new Map<string, string>();
    for (const [role, declarationRaw] of Object.entries(assetMapRaw)) {
      if (!role.trim() || !object(declarationRaw)) throw new BadRequestException('Dichiarazione assetMap non valida');
      const assetPath = this.safePackagePath(String(declarationRaw.path || ''), 'assets/');
      const mime = String(declarationRaw.mime || '') as ModularThemeAsset['mime'];
      if (!['image/webp','image/png','image/jpeg','image/svg+xml'].includes(mime)) throw new BadRequestException(`MIME asset non supportato: ${assetPath}`);
      const bytes = byPath.get(assetPath);
      if (!bytes || !bytes.length) throw new BadRequestException(`Asset mancante o vuoto: ${assetPath}`);
      if (bytes.length > 6 * 1024 * 1024) throw new BadRequestException(`Asset oltre 6 MiB: ${assetPath}`);
      const digest = sha256(bytes);
      if (String(declarationRaw.sha256 || '').toLowerCase() !== digest || Number(declarationRaw.size) !== bytes.length) throw new BadRequestException(`Hash o dimensione asset incoerente: ${assetPath}`);
      this.validateAssetMagic(mime, bytes, assetPath);
      const duplicatePath = hashes.get(digest);
      if (duplicatePath && duplicatePath !== assetPath) throw new BadRequestException(`Asset duplicato non deduplicato: ${assetPath}`);
      hashes.set(digest, assetPath);
      assetInventoryByPath.set(assetPath, { path: assetPath, mime, sha256: digest, size: bytes.length });
    }
    const actualAssets = [...byPath.keys()].filter((entry) => entry.startsWith('assets/'));
    for (const assetPath of actualAssets) if (!assetInventoryByPath.has(assetPath)) throw new BadRequestException(`Asset orfano o non dichiarato: ${assetPath}`);
    const referencedSource = [html, ...cssSources, ...jsSources].join('\n');
    for (const asset of assetInventoryByPath.values()) if (!referencedSource.includes(asset.path) && !styleEntries.some((entry) => referencedSource.includes(path.posix.relative(path.posix.dirname(entry), asset.path)))) throw new BadRequestException(`Asset dichiarato ma non referenziato: ${asset.path}`);

    this.validateManifestContract(rawManifest, defaultConfig);
    const allowed = new Set(['theme.json','template.html', ...styleEntries, ...scriptEntries, ...actualAssets]);
    const documentation: Record<string, Buffer> = {};
    for (const [entryPath, bytes] of byPath) {
      if (allowed.has(entryPath)) continue;
      if (entryPath.includes('/') || !/^(?:README|ASSET-CREDITS|NOTE-REVISIONE)\.md$/i.test(entryPath) || bytes.length > MAX_DOCUMENT) throw new BadRequestException(`File non dichiarato non consentito: ${entryPath}`);
      documentation[entryPath] = bytes;
    }
    const files = Object.fromEntries([...byPath.entries()].sort(([left], [right]) => left.localeCompare(right)));
    const sourcePackageSha256 = this.packageSha256(files);
    const fileInventory: ModularThemeFileInventory[] = Object.entries(files).map(([entryPath, bytes]) => ({
      path: entryPath, size: bytes.length, sha256: sha256(bytes),
      kind: entryPath === 'theme.json' ? 'manifest' : entryPath === 'template.html' ? 'entry' : styleEntries.includes(entryPath) ? 'style' : scriptEntries.includes(entryPath) ? 'script' : entryPath.startsWith('assets/') ? 'asset' : 'documentation',
    }));
    const manifest = rawManifest as unknown as ModularThemeManifest;
    const modularPackage: ModularThemePackage = { manifest, files, defaultConfig, fileInventory, assetInventory: [...assetInventoryByPath.values()].sort((left, right) => left.path.localeCompare(right.path)), sourcePackageSha256 };
    return {
      manifest, contentProfile, template, manifestBuffer, documentation, defaultConfig,
      templateSha256: sha256(template), templateSize: template.length,
      zipSha256: zipBuffer ? sha256(zipBuffer) : sourcePackageSha256, zipSize: zipBuffer?.length || 0,
      validationReport: { valid: true, format: 'modular', contentProfile, checks: { zipSlip: true, symlink: true, zipBomb: true, csp: true, html: true, css: true, javascript: true, assets: true, manifest: true, profile: true } },
      warnings: [], format: 'modular', files, modularPackage, sourcePackageSha256,
    };
  }

  private validateManifestContract(manifest: JsonObject, config: JsonObject) {
    const collections = manifest.collections;
    const fixedCounts = manifest.fixedCounts;
    const features = manifest.features;
    if (!object(collections) || !object(fixedCounts) || !object(features)) throw new BadRequestException('Collections, fixedCounts o features non validi');
    for (const [name, declaration] of Object.entries(collections)) {
      if (!name.trim() || !object(declaration) || typeof declaration.path !== 'string' || !/^content(?:\.[A-Za-z0-9_-]+)+$/.test(declaration.path) || !Number.isInteger(declaration.count) || Number(declaration.count) < 0) throw new BadRequestException(`Collection non valida: ${name}`);
      const value = this.valueAt(config, declaration.path);
      if (!Array.isArray(value) || value.length !== declaration.count) throw new BadRequestException(`Collection incoerente: ${declaration.path}`);
    }
    const editingFixed = object((config.editingContract as JsonObject)?.fixedCounts) ? ((config.editingContract as JsonObject).fixedCounts as JsonObject) : {};
    for (const [name, count] of Object.entries(fixedCounts)) if (!Number.isInteger(count) || Number(count) < 0 || Number(editingFixed[name]) !== Number(count)) throw new BadRequestException(`fixedCounts incoerente: ${name}`);
    const configFeatures = object(config.features) ? config.features : {};
    for (const [name, value] of Object.entries(features)) if (!Object.prototype.hasOwnProperty.call(configFeatures, name) || JSON.stringify(configFeatures[name]) !== JSON.stringify(value)) throw new BadRequestException(`Feature incoerente: ${name}`);
    const palette = object(config.palette) ? config.palette : {};
    for (const key of this.stringArray(manifest.paletteKeys, 'paletteKeys', 1, 30)) if (!Object.prototype.hasOwnProperty.call(palette, key)) throw new BadRequestException(`Palette key inesistente: ${key}`);
    const editing = object(config.editingContract) ? config.editingContract : {};
    const imageSlots = this.stringArray(manifest.imageSlots, 'imageSlots', 1, 30);
    const declaredImageSlots = Array.isArray(editing.imageSlots) ? editing.imageSlots.map(String) : [];
    const images = object(config.images) ? config.images : {}; const brand = object(config.brand) ? config.brand : {};
    for (const slot of imageSlots) if (!declaredImageSlots.includes(slot) || (!Object.prototype.hasOwnProperty.call(images, slot) && !Object.prototype.hasOwnProperty.call(brand, slot))) throw new BadRequestException(`Image slot inesistente: ${slot}`);
    const socialSlots = this.stringArray(manifest.socialSlots, 'socialSlots', 0, 30);
    const declaredSocialSlots = Array.isArray(editing.socialSlots) ? editing.socialSlots.map(String) : [];
    const business = object(config.business) ? config.business : {};
    for (const slot of socialSlots) if (!declaredSocialSlots.includes(slot) || !Object.prototype.hasOwnProperty.call(business, slot)) throw new BadRequestException(`Social slot inesistente: ${slot}`);
    for (const field of ['editablePaths','protectedPaths']) for (const value of this.stringArray(manifest[field], field, 1, 100)) if (!this.pathExists(config, value.split('.'))) throw new BadRequestException(`Path protetto/editabile inesistente: ${value}`);
    if (!object(manifest.textLimits) || Object.values(manifest.textLimits).some((value) => !Number.isInteger(value) || Number(value) <= 0)) throw new BadRequestException('textLimits non validi');
  }

  private validateCss(source: string, entry: string, files: Map<string, Buffer>) {
    const forbidden: Array<[RegExp, string]> = [
      [/@import\b/i, '@import'], [/expression\s*\(/i, 'expression'], [/(?:^|[;{])\s*behavior\s*:/i, 'behavior'], [/javascript\s*:/i, 'javascript'], [/file\s*:/i, 'file URL'],
      [/url\s*\(\s*["']?https?:\/\//i, 'URL HTTP'], [/url\s*\(\s*["']?\/\//i, 'URL protocol-relative'], [/url\s*\(\s*["']?\//i, 'path assoluto'],
    ];
    for (const [pattern, label] of forbidden) if (pattern.test(source)) throw new BadRequestException(`CSS non sicuro (${label}): ${entry}`);
    for (const match of source.matchAll(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const reference = match[1].trim();
      if (reference.startsWith('data:')) { this.validateDataUris(reference); continue; }
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entry), reference));
      if (!resolved.startsWith('assets/') || reference.includes('..') && !reference.startsWith('../assets/') || !files.has(resolved)) throw new BadRequestException(`Riferimento CSS non valido o mancante: ${reference}`);
    }
  }

  private validateAssetMagic(mime: string, bytes: Buffer, assetPath: string) {
    const valid = mime === 'image/webp' ? bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
      : mime === 'image/png' ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mime === 'image/svg+xml' ? /<svg\b/i.test(bytes.toString('utf8')) : false;
    if (!valid) throw new BadRequestException(`MIME non coerente coi magic byte: ${assetPath}`);
    if (mime === 'image/svg+xml' && /<script|foreignObject|\son\w+\s*=|javascript:|(?:href|xlink:href)\s*=\s*["'](?:https?:)?\/\//i.test(bytes.toString('utf8'))) throw new BadRequestException(`SVG non sicuro: ${assetPath}`);
  }

  private safePackagePath(value: string, prefix?: string, extension?: string): string {
    if (!value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new BadRequestException(`Path package non sicuro: ${value}`);
    if (prefix && !value.startsWith(prefix)) throw new BadRequestException(`Path package fuori da ${prefix}: ${value}`);
    if (extension && !value.toLowerCase().endsWith(extension)) throw new BadRequestException(`Estensione package non valida: ${value}`);
    return value;
  }

  private stringArray(value: unknown, name: string, minimum: number, maximum: number): string[] {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some((item) => typeof item !== 'string' || !item.trim())) throw new BadRequestException(`${name} non valido`);
    if (new Set(value.map((item) => item.toLowerCase())).size !== value.length) throw new BadRequestException(`${name} contiene duplicati`);
    return value;
  }

  private valueAt(root: unknown, dottedPath: string): unknown {
    let value: unknown = root;
    for (const key of dottedPath.split('.')) {
      if (Array.isArray(value)) value = /^\d+$/.test(key) ? value[Number(key)] : undefined;
      else if (object(value)) value = value[key];
      else return undefined;
    }
    return value;
  }

  private pathExists(value: unknown, parts: string[]): boolean {
    if (!parts.length) return value !== undefined;
    const [head, ...tail] = parts;
    if (head === '*') {
      const children = Array.isArray(value) ? value : object(value) ? Object.values(value) : [];
      return children.length > 0 && children.every((child) => this.pathExists(child, tail));
    }
    if (Array.isArray(value)) return /^\d+$/.test(head) && this.pathExists(value[Number(head)], tail);
    return object(value) && Object.prototype.hasOwnProperty.call(value, head) && this.pathExists(value[head], tail);
  }

  private packageSha256(files: Record<string, Buffer>): string {
    const chunks: Buffer[] = [];
    for (const entry of Object.keys(files).sort()) chunks.push(Buffer.from(entry, 'utf8'), Buffer.from([0]), files[entry], Buffer.from([0]));
    return sha256(Buffer.concat(chunks));
  }

  private readArchive(buffer: Buffer): Promise<PackageEntry[]> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (openError, zip) => {
        if (openError || !zip) return reject(new BadRequestException('ZIP non valido'));
        const files: PackageEntry[] = [];
        const seen = new Set<string>();
        let uncompressed = 0;
        const fail = (error: unknown) => { zip.close(); reject(error); };
        zip.on('error', () => fail(new BadRequestException('ZIP corrotto')));
        zip.on('entry', (entry) => {
          const name = entry.fileName.replace(/\\/g, '/');
          if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.includes('\0')) return fail(new BadRequestException(`Path ZIP non valido: ${name}`));
          const parts = name.split('/').filter(Boolean);
          if (parts.some((part: string) => part === '.' || part === '..' || part.startsWith('.'))) return fail(new BadRequestException(`Path nascosto o traversal non consentito: ${name}`));
          const lower = name.toLowerCase();
          if (seen.has(lower)) return fail(new BadRequestException(`Nome duplicato case-insensitive: ${name}`));
          seen.add(lower);
          const unixType = ((entry.externalFileAttributes >>> 16) & 0xf000);
          if (unixType === 0xa000) return fail(new BadRequestException(`Symlink non consentito: ${name}`));
          if (name.endsWith('/')) { zip.readEntry(); return; }
          if (EXECUTABLE_EXTENSIONS.test(name)) return fail(new BadRequestException(`File eseguibile non consentito: ${name}`));
          if (files.length + 1 > MAX_FILES) return fail(new BadRequestException(`Il pacchetto supera ${MAX_FILES} file`));
          uncompressed += entry.uncompressedSize;
          if (uncompressed > MAX_UNCOMPRESSED) return fail(new BadRequestException('Contenuto non compresso oltre 25 MiB'));
          if (entry.uncompressedSize > 1024 * 1024 && entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > 200) return fail(new BadRequestException('Possibile ZIP bomb rilevata'));
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) return fail(new BadRequestException(`Entry ZIP non leggibile: ${name}`));
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= entry.uncompressedSize) chunks.push(chunk); });
            stream.on('error', () => fail(new BadRequestException(`Entry ZIP corrotta: ${name}`)));
            stream.on('end', () => {
              if (size !== entry.uncompressedSize) return fail(new BadRequestException(`Dimensione entry non valida: ${name}`));
              files.push({ path: name, buffer: Buffer.concat(chunks) });
              zip.readEntry();
            });
          });
        });
        zip.on('end', () => resolve(files));
        zip.readEntry();
      });
    });
  }

  private stripOptionalRoot(entries: PackageEntry[]): PackageEntry[] {
    if (!entries.length) throw new BadRequestException('ZIP vuoto');
    const split = entries.map((entry) => entry.path.split('/'));
    const hasRoot = split.every((parts) => parts.length > 1 && parts[0].toLowerCase() === split[0][0].toLowerCase());
    const normalized = entries.map((entry) => ({ ...entry, path: hasRoot ? entry.path.split('/').slice(1).join('/') : entry.path }));
    if (normalized.some((entry) => !entry.path || entry.path.includes('/../'))) throw new BadRequestException('Root folder ZIP non valida');
    return normalized;
  }

  private contentProfile(manifest: JsonObject, config: JsonObject): ProposalContentProfile {
    const declared = manifest.contentProfile;
    if (declared !== undefined) {
      if (!['proposal-basic-v2','colsova-conversion-v1'].includes(String(declared))) throw new BadRequestException('Content profile non supportato');
      return declared as ProposalContentProfile;
    }
    const content = object(config.content) ? config.content : {};
    if (content.approach && content.benefits && content.trustItems) return 'proposal-basic-v2';
    if (content.consultation && content.servicesIntro && content.process) return 'colsova-conversion-v1';
    throw new BadRequestException('Struttura tema non riconosciuta: contentProfile obbligatorio');
  }

  private validateTemplateSecurity(html: string, allowTrustedSelfImages = false, modular?: { styleEntries: string[]; scriptEntries: string[]; applicationJs: string; trustedDeveloperCredit?: boolean; allowDemoForms?: boolean }) {
    const $ = cheerio.load(html);
    const robots = $('meta').filter((_, element) => String($(element).attr('name') || '').toLowerCase() === 'robots');
    if (robots.length !== 1) throw new BadRequestException('robots noindex,nofollow,noarchive mancante o duplicato');
    const robotTokens = new Set(String(robots.attr('content') || '').toLowerCase().split(',').map((token) => token.trim()));
    if (!['noindex', 'nofollow', 'noarchive'].every((token) => robotTokens.has(token))) throw new BadRequestException('robots noindex,nofollow,noarchive mancante');

    const cspMetas = $('meta').filter((_, element) => String($(element).attr('http-equiv') || '').toLowerCase() === 'content-security-policy');
    if (cspMetas.length !== 1) throw new BadRequestException('La meta CSP deve essere unica');
    this.parseAndValidateCsp(String(cspMetas.attr('content') || ''), allowTrustedSelfImages);

    for (const selector of ['iframe', 'object', 'embed', 'base[href]']) if ($(selector).length) throw new BadRequestException(`Template non sicuro: ${selector}`);
    if ($('meta').filter((_, element) => String($(element).attr('http-equiv') || '').toLowerCase() === 'refresh').length) throw new BadRequestException('Template non sicuro: meta refresh');
    const scriptSources = $('script[src]').map((_, element) => String($(element).attr('src') || '')).get();
    const stylesheetLinks = $('link[rel]').filter((_, element) => String($(element).attr('rel') || '').toLowerCase().split(/\s+/).includes('stylesheet')).map((_, element) => String($(element).attr('href') || '')).get();
    if (!modular && scriptSources.length) throw new BadRequestException('Template non sicuro: script esterno');
    if (!modular && stylesheetLinks.length) throw new BadRequestException('Template non sicuro: stylesheet esterno');
    if (modular && (JSON.stringify(scriptSources) !== JSON.stringify(modular.scriptEntries) || JSON.stringify(stylesheetLinks) !== JSON.stringify(modular.styleEntries))) throw new BadRequestException('Entry CSS o JavaScript HTML diverse dal manifest');
    $('*').each((_, element) => {
      const attributes = element.type === 'tag' ? element.attribs || {} : {};
      for (const [name, value] of Object.entries(attributes)) {
        if (/^on/i.test(name)) throw new BadRequestException('Template non sicuro: event handler inline');
        if (/javascript\s*:/i.test(value)) throw new BadRequestException('Template non sicuro: javascript URL');
        if (['src', 'poster'].includes(name.toLowerCase()) && /^(?:https?:)?\/\//i.test(value.trim())) throw new BadRequestException('Template base con risorsa esterna hardcoded');
        if (name.toLowerCase() === 'srcset' && /(?:https?:\/\/|(?:^|[\s,])\/\/)/i.test(value)) throw new BadRequestException('Template base con risorsa esterna hardcoded');
        if (name.toLowerCase() === 'href' && /^(?:https?:)?\/\//i.test(value.trim()) && !((allowTrustedSelfImages || modular?.trustedDeveloperCredit) && value.trim().toLowerCase() === 'https://doflow.it/')) throw new BadRequestException('Template base con collegamento esterno hardcoded');
        if (name.toLowerCase() === 'style' && /(?:url\s*\(\s*["']?(?:https?:)?\/\/|@import)/i.test(value)) throw new BadRequestException('Template base con CSS esterno hardcoded');
        if (['src','href','poster','srcset'].includes(name.toLowerCase()) && (value.includes('\\') || value.split(/[\s,]+/).some((part) => part.split('/').includes('..')) || /^file:/i.test(value))) throw new BadRequestException('Template base con path non sicuro');
      }
    });

    const css = $('style').map((_, element) => $(element).html() || '').get().join('\n');
    const cssChecks: Array<[RegExp, string]> = [
      [/@import\b/i, 'CSS @import'], [/url\(\s*["']?https?:\/\//i, 'CSS URL esterno'], [/url\(\s*["']?\/\//i, 'CSS URL protocol-relative'],
      [/(?:^|[;{])\s*expression\s*\(/i, 'CSS expression'], [/(?:^|[;{])\s*behavior\s*:/i, 'CSS behavior'], [/javascript\s*:/i, 'CSS javascript URL'],
    ];
    for (const [pattern, label] of cssChecks) if (pattern.test(css)) throw new BadRequestException(`Template non sicuro: ${label}`);

    const applicationJs = [$('script').filter((_, element) => $(element).attr('id') !== 'template-config' && !$(element).attr('src')).map((_, element) => $(element).html() || '').get().join('\n'), modular?.applicationJs || ''].join('\n');
    this.validateApplicationJavascript(applicationJs);
    for (const match of html.matchAll(/<form\b([^>]*)>/gi)) {
      const action = /\baction\s*=\s*["']([^"']*)["']/i.exec(match[1])?.[1] || '';
      if (action && action !== '#') throw new BadRequestException('Form action esterna non consentita');
      if (!/preventDefault\s*\(/.test(applicationJs) || (!modular?.allowDemoForms && !/modalit[aà]\s+demo|demo[^<]{0,80}non invia/i.test(`${html}\n${applicationJs}`))) throw new BadRequestException('Form demo non intercettato o dichiarazione demo mancante');
    }
    for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
      if (href && /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(?:https|tel|mailto):/i.test(href)) throw new BadRequestException('Link esterno non HTTPS');
      if (/\btarget\s*=\s*["']_blank["']/i.test(match[1]) && !/\brel\s*=\s*["'][^"']*noopener[^"']*noreferrer/i.test(match[1])) throw new BadRequestException('Link target blank senza noopener noreferrer');
    }
  }

  private parseAndValidateCsp(raw: string, allowTrustedSelfImages = false): Map<string, string[]> {
    if (!raw.trim() || /[\r\n\t]/.test(raw)) throw new BadRequestException('CSP mancante o con whitespace ambiguo');
    const directives = new Map<string, string[]>();
    for (const fragment of raw.split(';')) {
      const trimmed = fragment.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/ +/);
      const name = parts.shift() || '';
      if (!/^[a-z][a-z0-9-]*$/.test(name) || parts.length === 0 || parts.some((token) => !token || /\s/.test(token))) throw new BadRequestException('Direttiva CSP non valida o ambigua');
      if (directives.has(name)) throw new BadRequestException(`Direttiva CSP duplicata: ${name}`);
      const tokens = parts.map((token) => {
        if (!CSP_HASH.test(token) && token !== token.toLowerCase()) throw new BadRequestException('Token CSP con casing ambiguo');
        return token;
      });
      if (new Set(tokens).size !== tokens.length) throw new BadRequestException(`Token CSP duplicato in ${name}`);
      if (tokens.includes("'none'") && tokens.length !== 1) throw new BadRequestException(`CSP non valida: 'none' combinato in ${name}`);
      directives.set(name, tokens);
    }
    for (const name of CSP_NONE_DIRECTIVES) {
      const tokens = directives.get(name);
      if (!tokens || tokens.length !== 1 || tokens[0] !== "'none'") throw new BadRequestException(`CSP insufficiente: ${name} deve contenere soltanto 'none'`);
    }
    for (const name of ['script-src', 'style-src']) {
      const tokens = directives.get(name);
      if (!tokens?.length || tokens.some((token) => token !== "'unsafe-inline'" && !CSP_HASH.test(token))) throw new BadRequestException(`CSP ${name} contiene sorgenti non supportate`);
    }
    const imageTokens = directives.get('img-src');
    const allowedImages = allowTrustedSelfImages ? ['data:', 'https:', "'self'"] : ['data:', 'https:'];
    if (!imageTokens?.length || imageTokens.some((token) => !allowedImages.includes(token))) throw new BadRequestException(`CSP img-src contiene sorgenti non supportate: ${(imageTokens || []).join(' ')}`);
    return directives;
  }

  private validateApplicationJavascript(source: string) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const canonical = withoutComments.toLowerCase().replace(/[\s?.'"`\[\]+]/g, '');
    const forbidden: Array<[RegExp, string]> = [
      [/eval\(/, 'eval'], [/newfunction/, 'new Function'], [/documentwrite\(/, 'document.write'], [/fetch\(/, 'fetch'],
      [/xmlhttprequest/, 'XMLHttpRequest'], [/websocket/, 'WebSocket'], [/eventsource/, 'EventSource'], [/sendbeacon/, 'sendBeacon'],
      [/webtransport/, 'WebTransport'], [/importscripts/, 'importScripts'], [/serviceworker/, 'serviceWorker'], [/rtcpeerconnection/, 'RTCPeerConnection'],
      [/locationassign\(/, 'location.assign'], [/locationreplace\(/, 'location.replace'], [/windowopen\(/, 'window.open'],
      [/formsubmit\(/, 'form.submit'], [/requestsubmit\(/, 'requestSubmit'], [/new(?:window)?image\(/, 'Image constructor'],
      [/createelement\(/, 'creazione dinamica di elementi'],
      [/localstorage/, 'localStorage'], [/sessionstorage/, 'sessionStorage'], [/indexeddb/, 'indexedDB'], [/javascript:/, 'javascript URL'],
    ];
    for (const [pattern, label] of forbidden) if (pattern.test(canonical)) throw new BadRequestException(`Template non sicuro: ${label}`);
    const withoutProtectedDeveloperCredit = source.replace(/https:\/\/doflow\.it\//gi, '');
    if (/https?:\/\//i.test(withoutProtectedDeveloperCredit) || /["'`]\/\//.test(withoutProtectedDeveloperCredit)) throw new BadRequestException('JavaScript con URL esterno hardcoded');
  }

  private validateDataUris(html: string) {
    let total = 0;
    for (const match of html.matchAll(/data:(image\/(?:webp|png|jpeg|svg\+xml));base64,([a-z0-9+/=]+)/gi)) {
      const mime = match[1].toLowerCase(); const encoded = match[2]; total += encoded.length;
      if (encoded.length > 1024 * 1024) throw new BadRequestException('Singola data URI oltre 1 MiB codificato');
      if (mime === 'image/svg+xml') {
        const svg = Buffer.from(encoded, 'base64').toString('utf8');
        if (!/<svg\b/i.test(svg) || /<script|foreignObject|\son\w+\s*=|javascript:/i.test(svg) || /(?:href|xlink:href)\s*=\s*["']https?:/i.test(svg)) throw new BadRequestException('SVG data URI non sanitizzata');
      }
    }
    if (total > 3 * 1024 * 1024) throw new BadRequestException('Data URI totali oltre 3 MiB');
  }

  private validateProfile(config: JsonObject, profile: ProposalContentProfile) {
    const editing = object(config.editingContract) ? config.editingContract : {};
    const fixed = object(editing.fixedCounts) ? editing.fixedCounts : {};
    const content = object(config.content) ? config.content : {};
    const images = object(config.images) ? config.images : {};
    if (profile === 'proposal-basic-v2') {
      if (Number(fixed.services) !== 3 || Number(fixed.trustItems) !== 6 || Number(fixed.faqs) !== 6 || !Array.isArray(content.services) || content.services.length !== 3 || !Array.isArray(content.trustItems) || content.trustItems.length !== 6 || !Array.isArray(content.faq) || content.faq.length !== 6) throw new BadRequestException('Contratto proposal-basic-v2 non valido');
    } else {
      const expected: Record<string, number> = { services: 3, reviews: 6, faqs: 6, trustItems: 4, consultationHighlights: 3, processSteps: 3 };
      if (Object.entries(expected).some(([key, count]) => Number(fixed[key]) !== count)) throw new BadRequestException('Conteggi colsova-conversion-v1 non validi');
      if (!Array.isArray(content.services) || content.services.length !== 3 || !Array.isArray(content.reviews) || content.reviews.length !== 6 || !Array.isArray(content.faq) || content.faq.length !== 6 || !Array.isArray((content.trust as JsonObject)?.items) || ((content.trust as JsonObject).items as unknown[]).length !== 4 || !Array.isArray((content.consultation as JsonObject)?.highlights) || ((content.consultation as JsonObject).highlights as unknown[]).length !== 3 || !Array.isArray((content.process as JsonObject)?.steps) || ((content.process as JsonObject).steps as unknown[]).length !== 3) throw new BadRequestException('Struttura colsova-conversion-v1 non valida');
      if ((config.features as JsonObject)?.reviewsMode !== 'demo' || !/recensioni dimostrative/i.test(String((content.reviewsIntro as JsonObject)?.disclaimer || ''))) throw new BadRequestException('Recensioni demo non dichiarate');
    }
    for (const slot of ['logoDefault','logoLight','hero','consultation','feature']) if (!object(images[slot])) throw new BadRequestException(`Image slot mancante: ${slot}`);
  }
}
