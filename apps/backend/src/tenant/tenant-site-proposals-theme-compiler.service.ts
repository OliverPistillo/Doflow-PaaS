import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import * as path from 'path';
import { JsonObject, GeneratedZip } from './tenant-site-proposals.types';
import { sha256 } from './tenant-site-proposals-validation';
import { CompiledThemeArtifact, ModularThemePackage, ThemeCompilationAssetReport } from './tenant-site-proposals-theme-package.types';
import { TenantSiteProposalsThemePackageService, ValidatedThemePackage } from './tenant-site-proposals-theme-package.service';

const TEMPLATE_CONFIG_RE = /<script\s+id=["']template-config["']\s+type=["']application\/json["']\s*>([\s\S]*?)<\/script>/gi;
const COMPILED_CSP = "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const FIXED_ZIP_DATE = new Date('1980-01-01T00:00:00.000Z');
const COMPILER_VERSION = 'modular-compiler-v2';

@Injectable()
export class TenantSiteProposalsThemeCompilerService {
  constructor(@Optional() private readonly validator?: TenantSiteProposalsThemePackageService) {}

  async compileDirectory(rootPath: string, config?: JsonObject): Promise<CompiledThemeArtifact> {
    const validated = await this.packageValidator().validateDirectory(rootPath, true);
    return this.compileValidated(validated, config, true);
  }

  compileValidated(validated: ValidatedThemePackage, config?: JsonObject, trustedBuiltin = false): CompiledThemeArtifact {
    if (validated.format !== 'modular' || !validated.modularPackage) throw new BadRequestException('Il compiler richiede un package modulare validato');
    return this.compilePackage(validated.modularPackage, config, trustedBuiltin);
  }

  compilePackage(source: ModularThemePackage, config?: JsonObject, trustedBuiltin = false): CompiledThemeArtifact {
    const { manifest, files } = source;
    let html = this.text(files, manifest.entry);
    const configMatches = [...html.matchAll(TEMPLATE_CONFIG_RE)];
    if (configMatches.length !== 1) throw new BadRequestException('template-config mancante o duplicato durante la compilazione');
    if (config) {
      const match = configMatches[0];
      const offset = match[0].indexOf(match[1]);
      const start = match.index! + offset;
      html = `${html.slice(0, start)}${this.safeJson(config)}${html.slice(start + match[1].length)}`;
    }

    const styleTags = [...html.matchAll(/<link\b[^>]*\brel\s*=\s*["'][^"']*stylesheet[^"']*["'][^>]*>/gi)];
    const styleHrefs = styleTags.map((match) => /\bhref\s*=\s*["']([^"']+)["']/i.exec(match[0])?.[1] || '');
    if (JSON.stringify(styleHrefs) !== JSON.stringify(manifest.styleEntries)) throw new BadRequestException('Link CSS diversi dal manifest durante la compilazione');
    for (let index = styleTags.length - 1; index >= 0; index--) {
      const match = styleTags[index]; const entry = manifest.styleEntries[index];
      const css = this.text(files, entry);
      html = `${html.slice(0, match.index!)}<style data-doflow-entry="${entry}">${css}</style>${html.slice(match.index! + match[0].length)}`;
    }

    const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi)];
    const scriptSources = scriptTags.map((match) => /\bsrc\s*=\s*["']([^"']+)["']/i.exec(match[0])?.[1] || '');
    if (JSON.stringify(scriptSources) !== JSON.stringify(manifest.scriptEntries)) throw new BadRequestException('Script diversi dal manifest durante la compilazione');
    for (let index = scriptTags.length - 1; index >= 0; index--) {
      const match = scriptTags[index]; const entry = manifest.scriptEntries[index];
      const javascript = this.text(files, entry).replace(/<\/script/gi, '<\\/script');
      html = `${html.slice(0, match.index!)}<script data-doflow-entry="${entry}">${javascript}</script>${html.slice(match.index! + match[0].length)}`;
    }

    const assetReport: ThemeCompilationAssetReport[] = [];
    const assets = new Map(source.assetInventory.map((asset) => [asset.path, asset]));
    for (const assetPath of [...assets.keys()].sort()) {
      const asset = assets.get(assetPath)!; const bytes = files[assetPath];
      if (!bytes) throw new BadRequestException(`Asset non disponibile durante la compilazione: ${assetPath}`);
      const dataUri = `data:${asset.mime};base64,${bytes.toString('base64')}`;
      const aliases = new Set<string>([assetPath]);
      for (const entry of manifest.styleEntries) aliases.add(path.posix.relative(path.posix.dirname(entry), assetPath));
      for (const entry of manifest.scriptEntries) aliases.add(path.posix.relative(path.posix.dirname(entry), assetPath));
      let referencesReplaced = 0;
      for (const alias of [...aliases].sort((left, right) => right.length - left.length)) {
        const parts = html.split(alias);
        if (parts.length > 1) { referencesReplaced += parts.length - 1; html = parts.join(dataUri); }
      }
      if (!referencesReplaced && !config) throw new BadRequestException(`Asset non referenziato durante la compilazione: ${assetPath}`);
      assetReport.push({ ...asset, dataUriSize: Buffer.byteLength(dataUri), referencesReplaced });
    }

    html = this.replaceCsp(html);
    this.packageValidator().validateCompiledHtml(html, trustedBuiltin, manifest.security.allowDemoForms);
    const matchesAfter = [...html.matchAll(TEMPLATE_CONFIG_RE)];
    if (matchesAfter.length !== 1) throw new BadRequestException('template-config alterato durante la compilazione');
    const size = Buffer.byteLength(html);
    const compilationReport = {
      format: 'standalone' as const,
      styleEntries: [...manifest.styleEntries], scriptEntries: [...manifest.scriptEntries], assets: assetReport,
      sourceFileCount: Object.keys(files).length, deterministic: true as const, compilerVersion: COMPILER_VERSION,
      configSha256: sha256(this.safeJson(config || JSON.parse(configMatches[0][1]))),
    };
    return { html, sha256: sha256(html), size, sourcePackageSha256: source.sourcePackageSha256, assetReport, compilationReport };
  }

  async buildDirectoryZip(rootPath: string): Promise<GeneratedZip> {
    const validated = await this.packageValidator().validateDirectory(rootPath, true);
    if (!validated.modularPackage) throw new BadRequestException('Package modulare non valido');
    return this.buildSourceZip(validated.modularPackage.files);
  }

  async buildSourceZip(files: Readonly<Record<string, Buffer>>): Promise<GeneratedZip> {
    const output = new PassThrough(); const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => { output.on('end', () => resolve(Buffer.concat(chunks))); output.on('error', reject); });
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => output.destroy(error)); archive.pipe(output);
    const entries = Object.keys(files).sort();
    for (const entry of entries) archive.append(files[entry], { name: entry, date: FIXED_ZIP_DATE, mode: 0o100644 });
    await archive.finalize();
    const buffer = await done;
    return { buffer, sha256: sha256(buffer), size: buffer.length, entries };
  }

  private replaceCsp(html: string): string {
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].filter((match) => /\bhttp-equiv\s*=\s*["']content-security-policy["']/i.test(match[0]));
    if (metas.length !== 1) throw new BadRequestException('Meta CSP mancante o duplicata durante la compilazione');
    const match = metas[0];
    if (!/\bcontent\s*=\s*["'][^"']*["']/i.test(match[0])) throw new BadRequestException('Contenuto CSP mancante');
    const replacement = match[0].replace(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i, `content="${COMPILED_CSP}"`);
    return `${html.slice(0, match.index!)}${replacement}${html.slice(match.index! + match[0].length)}`;
  }

  private text(files: Readonly<Record<string, Buffer>>, entry: string): string {
    const value = files[entry];
    if (!value) throw new BadRequestException(`File package mancante: ${entry}`);
    return value.toString('utf8');
  }

  private safeJson(value: unknown): string {
    return JSON.stringify(value, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  private packageValidator(): TenantSiteProposalsThemePackageService {
    return this.validator || new TenantSiteProposalsThemePackageService();
  }
}
