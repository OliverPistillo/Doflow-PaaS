import { BadRequestException, Injectable } from '@nestjs/common';
import * as yauzl from 'yauzl';
import { JsonObject, ProposalContentProfile } from './tenant-site-proposals.types';
import { assertNoPrototypePollution, sha256 } from './tenant-site-proposals-validation';

const MAX_ZIP = 5 * 1024 * 1024;
const MAX_FILES = 25;
const MAX_UNCOMPRESSED = 10 * 1024 * 1024;
const MAX_TEMPLATE = 5 * 1024 * 1024;
const MAX_DOCUMENT = 1024 * 1024;
const SCRIPT_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const REQUIRED_MANIFEST = ['name','slug','version','schemaVersion','contractVersion','entry','templateSha256','size','categories','standalone'] as const;
const EXECUTABLE_EXTENSIONS = /\.(?:exe|dll|com|bat|cmd|ps1|sh|bash|js|mjs|cjs|jar|php|py|rb|pl|cgi|msi|scr|app|deb|rpm)$/i;

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
};

function object(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

@Injectable()
export class TenantSiteProposalsThemePackageService {
  async validate(buffer: Buffer): Promise<ValidatedThemePackage> {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_ZIP) throw new BadRequestException('Il pacchetto ZIP deve essere compreso entro 5 MiB.');
    const entries = await this.readArchive(buffer);
    const normalized = this.stripOptionalRoot(entries);
    const byPath = new Map(normalized.map((entry) => [entry.path.toLowerCase(), entry]));
    const templateEntry = byPath.get('template.html');
    const manifestEntry = byPath.get('theme.json');
    if (!templateEntry) throw new BadRequestException('template.html mancante');
    if (!manifestEntry) throw new BadRequestException('theme.json mancante');
    if (templateEntry.buffer.length > MAX_TEMPLATE) throw new BadRequestException('template.html supera 5 MiB');

    let manifest: JsonObject;
    try { manifest = JSON.parse(manifestEntry.buffer.toString('utf8')) as JsonObject; } catch { throw new BadRequestException('theme.json non contiene JSON valido'); }
    assertNoPrototypePollution(manifest, 'theme.json');
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
    this.validateTemplateSecurity(html);
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
      warnings,
    };
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
          if (uncompressed > MAX_UNCOMPRESSED) return fail(new BadRequestException('Contenuto non compresso oltre 10 MiB'));
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

  private validateTemplateSecurity(html: string) {
    if (!/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex[^"']*nofollow[^"']*noarchive)/i.test(html)) throw new BadRequestException('robots noindex,nofollow,noarchive mancante');
    const cspTag = /<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*>/i.exec(html)?.[0];
    const csp = cspTag ? /\bcontent\s*=\s*(["'])(.*?)\1/i.exec(cspTag)?.[2]?.toLowerCase() : undefined;
    if (!csp) throw new BadRequestException('CSP mancante');
    for (const directive of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'"]) if (!csp.includes(directive)) throw new BadRequestException(`CSP insufficiente: ${directive}`);
    const forbidden: Array<[RegExp, string]> = [
      [/<script\b[^>]*\bsrc\s*=/i, 'script esterno'], [/<link\b[^>]*\brel=["'][^"']*stylesheet/i, 'stylesheet esterno'],
      [/<iframe\b/i, 'iframe'], [/<object\b/i, 'object'], [/<embed\b/i, 'embed'], [/<base\b[^>]*href/i, 'base href'],
      [/<meta\b(?=[^>]*http-equiv=["']refresh)/i, 'meta refresh'], [/\son[a-z]+\s*=/i, 'event handler inline'],
      [/\beval\s*\(/i, 'eval'], [/new\s+Function\b/i, 'new Function'], [/document\.write\s*\(/i, 'document.write'],
      [/\bfetch\s*\(/i, 'fetch'], [/XMLHttpRequest/i, 'XMLHttpRequest'], [/\bWebSocket\b/i, 'WebSocket'],
      [/\blocalStorage\b/i, 'localStorage'], [/\bsessionStorage\b/i, 'sessionStorage'], [/javascript\s*:/i, 'javascript URL'],
    ];
    for (const [pattern, label] of forbidden) if (pattern.test(html)) throw new BadRequestException(`Template non sicuro: ${label}`);
    for (const match of html.matchAll(/<form\b([^>]*)>/gi)) {
      const action = /\baction\s*=\s*["']([^"']*)["']/i.exec(match[1])?.[1] || '';
      if (action && action !== '#') throw new BadRequestException('Form action esterna non consentita');
      if (!/preventDefault\s*\(/.test(html) || !/modalit[aà]\s+demo|demo[^<]{0,80}non invia/i.test(html)) throw new BadRequestException('Form demo non intercettato o dichiarazione demo mancante');
    }
    for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
      if (href && /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(?:https|tel|mailto):/i.test(href)) throw new BadRequestException('Link esterno non HTTPS');
      if (/\btarget\s*=\s*["']_blank["']/i.test(match[1]) && !/\brel\s*=\s*["'][^"']*noopener[^"']*noreferrer/i.test(match[1])) throw new BadRequestException('Link target blank senza noopener noreferrer');
    }
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
