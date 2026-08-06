import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { Readable } from 'stream';
import { FileStorageService, ThemePackageUploadError } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { TenantSiteProposalsThemeStorageCleanupService } from './tenant-site-proposals-theme-storage-cleanup.service';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { getTemplateRegistration } from './tenant-site-proposals-template-registry';
import { AuthUserRef, JsonObject } from './tenant-site-proposals.types';
import { assertNoPrototypePollution, UUID_RE } from './tenant-site-proposals-validation';
import { hasProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';

@Injectable()
export class TenantSiteProposalsThemeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly packages: TenantSiteProposalsThemePackageService,
    private readonly storage: FileStorageService,
    private readonly templates: TenantSiteProposalsTemplateService,
    private readonly cleanup: TenantSiteProposalsThemeStorageCleanupService,
    @Inject(REQUEST) private readonly request: any,
    @Optional() private readonly compiler?: TenantSiteProposalsThemeCompilerService,
  ) {}

  async list(filter = 'all') {
    this.access(false); await this.ensure(); const s = this.schema();
    const filters: Record<string, string> = { active: `v.deleted_at IS NULL AND v.status IN ('active','draft')`, disabled: `v.deleted_at IS NULL AND v.status='disabled'`, deleted: `v.deleted_at IS NOT NULL`, all: 'true' };
    if (!filters[filter]) throw new BadRequestException('Filtro temi non valido');
    const rows = await this.ds().query(`
      SELECT t.id,t.slug,t.name,t.description,t.source_kind,t.is_active,t.default_version,t.categories,t.created_at,t.updated_at,
        v.id version_id,v.version,v.schema_version,v.contract_version,v.content_profile,v.status,v.is_builtin,v.is_immutable,
        v.template_sha256,v.template_size,v.zip_sha256,v.zip_size,v.validation_report,v.created_at version_created_at,
        v.source_format,v.format_version,v.compiled_sha256,v.compiled_size,v.runtime_adapter_status,v.manifest,v.deleted_at,
        CASE WHEN t.source_kind='uploaded' THEN 'theme' ELSE 'hybrid' END default_image_mode,
        (SELECT count(*)::int FROM "${s}".site_proposals p WHERE p.template_slug=t.slug AND p.template_version=v.version) usages,
        (SELECT count(*)::int FROM "${s}".site_proposal_generations g WHERE g.template_slug=t.slug AND g.template_version=v.version) historical_usages
      FROM "${s}".site_proposal_themes t JOIN "${s}".site_proposal_theme_versions v ON v.theme_id=t.id
      WHERE ${filters[filter]}
      ORDER BY t.name,v.created_at DESC
    `);
    return rows.map((row: any) => this.publicTheme(row));
  }

  async get(slug: string, version: string) {
    this.access(false); this.identity(slug, version); await this.ensure();
    const row = await this.row(slug, version);
    if (!row) throw new NotFoundException('Tema non trovato');
    const { template_storage_key: _templateKey, zip_storage_key: _zipKey, default_config: _defaultConfig, ...publicRow } = row;
    return this.publicTheme(publicRow);
  }

  async upload(file?: Express.Multer.File) {
    const user = this.access(true);
    if (!file?.buffer) throw new BadRequestException('Seleziona un file ZIP');
    const validated = await this.packages.validate(file.buffer);
    const slug = String(validated.manifest.slug); const version = String(validated.manifest.version);
    const compiled = validated.format === 'modular' ? this.themeCompiler().compileValidated(validated, undefined, false) : undefined;
    await this.ensure();
    if (await this.row(slug, version)) throw new ConflictException('Questa versione del tema esiste già ed è immutabile');
    const runner = this.ds().createQueryRunner(); let storedPrefix: string | undefined; let original: unknown;
    try {
      await runner.connect(); await runner.startTransaction();
      const themes = await runner.query(`INSERT INTO "${this.schema()}".site_proposal_themes (slug,name,description,source_kind,is_active,categories,created_by) VALUES ($1,$2,$3,'uploaded',true,$4::jsonb,$5) ON CONFLICT(slug) DO UPDATE SET updated_at=now() RETURNING id,source_kind`, [slug, validated.manifest.name, validated.manifest.description || null, JSON.stringify(validated.manifest.categories), this.userId(user)]);
      if (themes[0]?.source_kind === 'builtin') throw new ConflictException('Lo slug di un tema built-in non può essere riutilizzato');
      const keys = await this.storage.uploadThemePackage(slug, version, {
        zip: file.buffer, template: validated.template, manifest: validated.manifestBuffer, documentation: validated.documentation,
        packageFiles: validated.format === 'modular' ? validated.files : undefined,
        compiled: compiled ? Buffer.from(compiled.html, 'utf8') : undefined,
      });
      storedPrefix = keys.prefix;
      const runtimeAdapterStatus = hasProposalContentProfileAdapter(validated.contentProfile) ? 'ready' : 'pending';
      const versions = await runner.query(`
        INSERT INTO "${this.schema()}".site_proposal_theme_versions
          (theme_id,version,schema_version,contract_version,content_profile,status,is_builtin,is_immutable,template_sha256,template_size,zip_sha256,zip_size,manifest,default_config,template_storage_key,zip_storage_key,validation_report,created_by,source_format,format_version,compiled_sha256,compiled_size,runtime_adapter_status)
        VALUES ($1,$2,$3,$4,$5,'draft',false,true,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20) RETURNING *
      `, [themes[0].id, version, validated.manifest.schemaVersion, validated.manifest.contractVersion, validated.contentProfile, validated.templateSha256, validated.templateSize, validated.zipSha256, validated.zipSize, JSON.stringify(validated.manifest), JSON.stringify(validated.defaultConfig), keys.templateKey, keys.zipKey, JSON.stringify(validated.validationReport), this.userId(user), validated.format, validated.format === 'modular' ? '1.0' : null, compiled?.sha256 || null, compiled?.size || null, runtimeAdapterStatus]);
      await this.activity(runner, themes[0].id, versions[0].id, 'THEME_UPLOADED', user, { version, contentProfile: validated.contentProfile });
      await runner.commitTransaction();
      this.templates.invalidate(this.schema(), slug, version);
      return { manifest: validated.manifest, format: validated.format, runtimeAdapterStatus, hash: { template: validated.templateSha256, zip: validated.zipSha256, compiled: compiled?.sha256 }, sizes: { template: validated.templateSize, zip: validated.zipSize, compiled: compiled?.size }, contentProfile: validated.contentProfile, validationReport: validated.validationReport, warnings: validated.warnings, status: 'draft', previewUrl: `/tenant/commercial/site-proposals/themes/${slug}/${version}/preview` };
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      const cleanupPrefix = storedPrefix || (error instanceof ThemePackageUploadError && error.cleanupRequired ? error.storagePrefix : undefined);
      if (cleanupPrefix) {
        const cleanupId = await this.cleanup.record(cleanupPrefix).catch(() => undefined);
        if (cleanupId) await this.cleanup.process(cleanupId).catch(() => undefined);
      }
      throw error;
    } finally { await runner.release().catch((error) => { if (!original) throw error; }); }
  }

  async preview(slug: string, version: string) {
    this.access(false); this.identity(slug, version); await this.ensure();
    const config = await this.templates.getDefaultConfig(slug, version, this.context());
    return this.templates.renderHtml(config, this.context(), true);
  }

  async download(slug: string, version: string) {
    this.access(false); this.identity(slug, version); await this.ensure();
    const row = await this.row(slug, version);
    if (!row) throw new NotFoundException('Tema non trovato');
    if (row.source_kind === 'builtin') {
      const registration = getTemplateRegistration(slug, version);
      if (registration.format !== 'modular' || !registration.download) throw new NotFoundException('Il pacchetto sorgente del tema built-in non è disponibile per il download');
      const root = path.join(__dirname, 'site-proposal-templates', ...registration.directory.split('/'));
      const zip = await this.themeCompiler().buildDirectoryZip(root);
      return { stream: Readable.from(zip.buffer), contentType: 'application/zip', contentLength: zip.size };
    }
    return this.storage.downloadThemePackage(slug, version);
  }

  activate(slug: string, version: string) { return this.setStatus(slug, version, 'active'); }
  disable(slug: string, version: string) { return this.setStatus(slug, version, 'disabled'); }

  async setDefault(slug: string, version: string) {
    const user = this.access(true); this.identity(slug, version); await this.ensure();
    const runner = this.ds().createQueryRunner(); let original: unknown;
    try {
      await runner.connect(); await runner.startTransaction();
      await runner.query(`SELECT id FROM "${this.schema()}".site_proposal_themes FOR UPDATE`);
      const row = (await runner.query(`SELECT v.*,t.id theme_id,t.is_active theme_active FROM "${this.schema()}".site_proposal_themes t JOIN "${this.schema()}".site_proposal_theme_versions v ON v.theme_id=t.id WHERE t.slug=$1 AND v.version=$2`, [slug, version]))[0];
      if (!row) throw new NotFoundException('Tema non trovato');
      if (row.deleted_at || row.runtime_adapter_status !== 'ready') throw new ConflictException('Tema disponibile in anteprima, adattatore di generazione non ancora attivo.');
      if (row.status !== 'active' || row.theme_active !== true || !['2.0'].includes(String(row.schema_version)) || !['2.0','2.1'].includes(String(row.contract_version)) || !hasProposalContentProfileAdapter(String(row.content_profile))) throw new ConflictException('Solo una versione attiva e compatibile può diventare predefinita');
      await runner.query(`UPDATE "${this.schema()}".site_proposal_themes SET default_version=NULL,updated_at=CASE WHEN default_version IS NOT NULL THEN now() ELSE updated_at END WHERE default_version IS NOT NULL`);
      await runner.query(`UPDATE "${this.schema()}".site_proposal_themes SET default_version=$1,updated_at=now() WHERE id=$2`, [version, row.theme_id]);
      await this.activity(runner, row.theme_id, row.id, 'THEME_DEFAULT_SET', user, { version });
      await runner.commitTransaction();
    } catch (error) { original = error; if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined); throw error; }
    finally { await runner.release().catch((error) => { if (!original) throw error; }); }
    this.templates.invalidate(this.schema());
    return this.get(slug, version);
  }

  async delete(slug: string, version: string) {
    const user = this.access(true); this.identity(slug, version); await this.ensure();
    const runner = this.ds().createQueryRunner(); let original: unknown;
    try {
      await runner.connect(); await runner.startTransaction();
      const rows = await runner.query(`SELECT v.*,t.slug,t.default_version,t.source_kind FROM "${this.schema()}".site_proposal_theme_versions v JOIN "${this.schema()}".site_proposal_themes t ON t.id=v.theme_id WHERE t.slug=$1 AND v.version=$2 FOR UPDATE`, [slug, version]);
      const row = rows[0];
      if (!row) {
        const cleanup = (await runner.query(`SELECT status FROM "${this.schema()}".site_proposal_theme_storage_cleanup WHERE storage_prefix=$1 ORDER BY created_at DESC LIMIT 1`, [this.storage.proposalThemePrefix(slug, version)]))[0];
        if (cleanup) { await runner.commitTransaction(); return { deleted: true, deletionMode: 'purged', fallbackDefault: null, affectedProposals: 0, storageCleanupStatus: cleanup.status }; }
        throw new NotFoundException('Tema non trovato');
      }
      if (row.source_kind === 'builtin') throw new ConflictException('I temi built-in non possono essere eliminati');
      const usage = (await runner.query(`SELECT count(*)::int count FROM "${this.schema()}".site_proposals WHERE template_slug=$1 AND template_version=$2`, [slug, version]))[0];
      const affectedProposals = Number(usage?.count || 0);
      const historical = (await runner.query(`SELECT count(*)::int count FROM "${this.schema()}".site_proposal_generations g JOIN "${this.schema()}".site_proposals p ON p.id=g.proposal_id WHERE g.template_slug=$1 AND g.template_version=$2`, [slug, version]))[0];
      const referenced = affectedProposals > 0 || Number(historical?.count || 0) > 0;
      const fallbackDefault = row.default_version === version ? await this.assignFallbackDefault(runner, row.id) : null;
      if (referenced) {
        if (!row.deleted_at) {
          await runner.query(`UPDATE "${this.schema()}".site_proposal_theme_versions SET status='disabled',deleted_at=now() WHERE id=$1`, [row.id]);
          await this.activity(runner, row.theme_id, row.id, 'THEME_RETIRED', user, { version, affectedProposals });
        }
        await runner.commitTransaction(); this.templates.invalidate(this.schema(), slug, version);
        return { deleted: true, deletionMode: 'retired', fallbackDefault, affectedProposals, storageCleanupStatus: 'preserved' };
      }
      const cleanupId = await this.cleanup.record(this.storage.proposalThemePrefix(slug, version), runner);
      await this.activity(runner, row.theme_id, row.id, 'THEME_DELETED', user, { version });
      await runner.query(`DELETE FROM "${this.schema()}".site_proposal_theme_versions WHERE id=$1`, [row.id]);
      await runner.query(`DELETE FROM "${this.schema()}".site_proposal_themes t WHERE t.id=$1 AND t.source_kind='uploaded' AND NOT EXISTS (SELECT 1 FROM "${this.schema()}".site_proposal_theme_versions v WHERE v.theme_id=t.id)`, [row.theme_id]);
      await runner.commitTransaction(); this.templates.invalidate(this.schema(), slug, version);
      const cleanupStatus = await this.cleanup.process(cleanupId);
      return { deleted: true, deletionMode: 'purged', fallbackDefault, affectedProposals, storageCleanupStatus: cleanupStatus, cleanupPending: cleanupStatus !== 'completed' };
    } catch (error) { original = error; if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined); throw error; }
    finally { await runner.release().catch((error) => { if (!original) throw error; }); }
  }

  private async setStatus(slug: string, version: string, status: 'active'|'disabled') {
    const user = this.access(true); this.identity(slug, version); await this.ensure(); const row = await this.row(slug, version);
    if (!row) throw new NotFoundException('Tema non trovato');
    if (row.deleted_at) throw new ConflictException('Il tema è stato eliminato dalla Libreria');
    if (status === 'disabled' && row.default_version === version) throw new ConflictException('Il tema predefinito non può essere disattivato');
    if (status === 'disabled' && row.source_kind === 'builtin') throw new ConflictException('I temi built-in non possono essere disattivati');
    await this.ds().query(`UPDATE "${this.schema()}".site_proposal_theme_versions SET status=$1,activated_at=CASE WHEN $1='active' THEN now() ELSE activated_at END WHERE id=$2`, [status, row.id]);
    await this.activity(this.ds(), row.theme_id, row.id, status === 'active' ? 'THEME_ACTIVATED' : 'THEME_DISABLED', user, { version });
    this.templates.invalidate(this.schema(), slug, version);
    return this.get(slug, version);
  }

  private async row(slug: string, version: string) {
    return (await this.ds().query(`SELECT v.*,t.id theme_id,t.slug,t.name,t.source_kind,t.default_version,t.categories,t.is_active theme_active FROM "${this.schema()}".site_proposal_themes t JOIN "${this.schema()}".site_proposal_theme_versions v ON v.theme_id=t.id WHERE t.slug=$1 AND v.version=$2 LIMIT 1`, [slug, version]))[0];
  }
  private publicTheme(row: any) {
    const builtIn = row.source_kind === 'builtin';
    const usageCount = Number(row.usages || 0);
    const historicalUsageCount = Number(row.historical_usages || 0);
    const retired = Boolean(row.deleted_at);
    const deletionMode = builtIn ? null : usageCount > 0 || historicalUsageCount > 0 ? 'retire' : 'purge';
    return {
      ...row,
      status: retired ? 'retired' : row.status,
      is_builtin: builtIn,
      builtIn,
      sourceType: row.source_kind,
      active: Boolean(row.is_active ?? row.theme_active) && row.status === 'active' && !retired,
      isDefault: row.default_version === row.version,
      usageCount,
      historicalUsageCount,
      canDelete: !builtIn,
      deletionMode,
      deleteReason: builtIn
        ? 'I temi built-in sono protetti.'
        : deletionMode === 'retire'
          ? 'Il tema verrà ritirato; package e generazioni storiche saranno preservati.'
          : 'Il tema verrà eliminato definitivamente con cleanup storage DB-first.',
    };
  }
  private async assignFallbackDefault(runner: { query: (...args: any[]) => Promise<any> }, excludedVersionId: string) {
    const fallback = (await runner.query(`SELECT t.id,t.slug,v.version FROM "${this.schema()}".site_proposal_themes t JOIN "${this.schema()}".site_proposal_theme_versions v ON v.theme_id=t.id WHERE v.id<>$1 AND t.is_active=true AND v.status='active' AND v.deleted_at IS NULL AND v.runtime_adapter_status='ready' ORDER BY CASE WHEN t.slug='colsova' AND v.version='2.4.1' THEN 0 ELSE 1 END,t.updated_at DESC LIMIT 1`, [excludedVersionId]))[0];
    if (!fallback) throw new ConflictException('Impossibile eliminare il tema predefinito: nessun fallback pronto');
    await runner.query(`UPDATE "${this.schema()}".site_proposal_themes SET default_version=NULL,updated_at=now() WHERE default_version IS NOT NULL`);
    await runner.query(`UPDATE "${this.schema()}".site_proposal_themes SET default_version=$1,updated_at=now() WHERE id=$2`, [fallback.version, fallback.id]);
    return { slug: fallback.slug, version: fallback.version };
  }
  private identity(slug: string, version: string) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new BadRequestException('Tema o versione non validi'); }
  private access(write: boolean): AuthUserRef {
    const raw = this.request?.user || this.request?.authUser; const role = String(raw?.role || '').toLowerCase().trim();
    if (!raw || !hasRoleAtLeast(role, write ? 'admin' : 'manager')) throw new ForbiddenException(write ? 'Admin o superiore richiesto.' : 'Manager o superiore richiesto.');
    this.schema(); return { id: String(raw.sub || raw.id || raw.userId || ''), email: raw.email || null, role };
  }
  private schema() {
    const raw = this.request?.user || this.request?.authUser;
    const tenantRef = [raw?.tenantId,raw?.tenant_id,raw?.tenantSlug,this.request?.tenantId,this.request?.tenant?.schemaName,this.request?.tenant?.schema].find((value) => typeof value === 'string' && value.trim());
    if (!tenantRef) throw new NotFoundException('Tenant non trovato');
    const schema = safeSchema(tenantRef, 'site proposal themes');
    if (schema !== SITE_PROPOSALS_TENANT) throw new ForbiddenException('Funzione disponibile solo per doflow');
    return schema;
  }
  private ds(): DataSource { return (this.request?.tenantConnection as DataSource | undefined) || this.dataSource; }
  private context() { return { schema: this.schema(), dataSource: this.ds() }; }
  private userId(user: AuthUserRef) { return UUID_RE.test(user.id) ? user.id : null; }
  private ensure() { return ensureDoflowSiteProposalTables(this.dataSource, this.schema()); }
  private themeCompiler() { return this.compiler || new TenantSiteProposalsThemeCompilerService(this.packages); }
  private activity(db: Pick<DataSource, 'query'> | { query: (...args: any[]) => Promise<any> }, themeId: string, versionId: string | null, action: string, user: AuthUserRef, metadata: JsonObject) {
    assertNoPrototypePollution(metadata, 'themeActivity');
    return db.query(`INSERT INTO "${this.schema()}".site_proposal_theme_activity (theme_id,version_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3,$4::jsonb,$5,$6)`, [themeId, versionId, action, JSON.stringify(metadata), this.userId(user), user.email || null]);
  }
}
