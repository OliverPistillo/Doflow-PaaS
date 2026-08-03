import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import {
  ACTIVITY,
  COLSOVA_TEMPLATE,
  GENERATED_STORAGE_PREFIX,
  PROPOSAL_STATUSES,
  SITE_PROPOSALS_TENANT,
} from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { TenantSiteProposalsCsvService } from './tenant-site-proposals-csv.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { AuthUserRef, JsonObject, PreviewRow, RowIssue } from './tenant-site-proposals.types';
import {
  allowedStatusTransition,
  assertNoPrototypePollution,
  buildCommercialAnalysis,
  buildEmail,
  buildFingerprint,
  buildCommercialAnalysis as analysisFor,
  cleanString,
  deepClone,
  forceTemplateContract,
  normalizeEmail,
  normalizeNameKey,
  normalizeWebsite,
  sha256,
  UUID_RE,
  validateSiteConfig,
} from './tenant-site-proposals-validation';

@Injectable()
export class TenantSiteProposalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly csv: TenantSiteProposalsCsvService,
    private readonly templates: TenantSiteProposalsTemplateService,
    private readonly artifacts: TenantSiteProposalsArtifactService,
    private readonly fileStorage: FileStorageService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  async listTemplates() {
    this.assertAccess(false);
    await this.ensure();
    return this.templates.listTemplates();
  }

  async getTemplate(slug: string, version?: string) {
    this.assertAccess(false);
    await this.ensure();
    return this.templates.getTemplate(slug, version || COLSOVA_TEMPLATE.version);
  }

  async previewImport(file: Express.Multer.File, templateSlug: string = COLSOVA_TEMPLATE.slug) {
    const user = this.assertAccess(true);
    await this.ensure();
    if (templateSlug !== COLSOVA_TEMPLATE.slug) throw new NotFoundException('Template non trovato');
    const parsed = this.csv.parseCsvFile(file);
    const defaultConfig = await this.templates.getDefaultConfig(templateSlug);
    const previewRows = this.csv.buildPreviewRows(parsed.rows, defaultConfig);
    const errors = previewRows.flatMap((row) => row.errors.map((error) => ({ rowIndex: row.rowIndex, ...error })));
    const rows = await this.ds().query(
      `
      INSERT INTO "${this.schema()}".site_proposal_import_batches
        (template_slug, template_version, original_filename, content_type, source_sha256, status, row_count, valid_count, invalid_count, rows, errors, created_by)
      VALUES ($1, $2, $3, $4, $5, 'preview', $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      RETURNING *
      `,
      [
        templateSlug,
        COLSOVA_TEMPLATE.version,
        cleanString(file.originalname, 255) || 'import.csv',
        cleanString(file.mimetype, 100) || null,
        sha256(file.buffer),
        previewRows.length,
        previewRows.filter((r) => r.valid).length,
        previewRows.filter((r) => !r.valid).length,
        JSON.stringify(previewRows),
        JSON.stringify(errors),
        this.userIdOrNull(user.id),
      ],
    );
    return { batch: rows[0], rows: previewRows };
  }

  async getImport(id: string) {
    this.assertAccess(false);
    this.assertUuid(id);
    await this.ensure();
    const row = await this.one(`SELECT * FROM "${this.schema()}".site_proposal_import_batches WHERE id = $1`, [id]);
    if (!row) throw new NotFoundException('Import non trovato');
    return row;
  }

  async confirmImport(id: string) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const schema = this.schema();
    const batch = await this.getImport(id);
    if (batch.status !== 'preview') {
      const existing = await this.ds().query(`SELECT id, display_name, status FROM "${schema}".site_proposals WHERE import_batch_id = $1 ORDER BY source_row_index`, [id]);
      return { batch, proposals: existing, idempotent: true };
    }
    const rows = (batch.rows || []) as PreviewRow[];
    const proposals: JsonObject[] = [];
    for (const row of rows.filter((r) => r.valid && r.canonical && r.siteConfig)) {
      const warnings = [...(row.warnings || [])];
      const match = await this.matchCompany(row.canonical!, warnings);
      const existingActive = await this.one(`SELECT id FROM "${schema}".site_proposals WHERE fingerprint = $1 AND deleted_at IS NULL LIMIT 1`, [row.fingerprint]);
      if (existingActive) warnings.push({ code: 'EXISTING_ACTIVE_PROPOSAL', message: 'Esiste gia una proposta attiva con lo stesso fingerprint.' });
      const analysis = buildCommercialAnalysis(row.canonical!);
      const email = buildEmail(row.canonical!);
      const inserted = await this.one(
        `
        INSERT INTO "${schema}".site_proposals
          (import_batch_id, source_row_index, source_row_hash, fingerprint, template_slug, template_version, status, display_name,
           company_id, source_data, site_config, validation_warnings, commercial_analysis, email_subject, email_body, current_version, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,1,$15,$15)
        ON CONFLICT (import_batch_id, source_row_index) WHERE import_batch_id IS NOT NULL AND source_row_index IS NOT NULL
        DO UPDATE SET updated_at = "${schema}".site_proposals.updated_at
        RETURNING *
        `,
        [id, row.rowIndex, row.sourceRowHash, row.fingerprint, batch.template_slug, batch.template_version, row.displayName, match.companyId, JSON.stringify(row.canonical), JSON.stringify(row.siteConfig), JSON.stringify(warnings), JSON.stringify(analysis), email.subject, email.body, this.userIdOrNull(user.id)],
      );
      await this.createVersion(inserted, 1, user, 'initial');
      await this.activity(inserted.id, ACTIVITY.proposalCreated, user, {});
      await this.activity(inserted.id, ACTIVITY.importConfirmed, user, { importBatchId: id });
      proposals.push(inserted);
    }
    await this.ds().query(`UPDATE "${schema}".site_proposal_import_batches SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [id]);
    return { batch: await this.getImport(id), proposals, idempotent: false };
  }

  async generateImport(id: string) {
    this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const batch = await this.getImport(id);
    if (!['confirmed', 'generated', 'partial'].includes(batch.status)) throw new BadRequestException('Import non confermato');
    const proposals = await this.ds().query(`SELECT id FROM "${this.schema()}".site_proposals WHERE import_batch_id = $1 AND deleted_at IS NULL AND status <> 'archived' ORDER BY source_row_index LIMIT 50`, [id]);
    const results = [];
    for (const proposal of proposals) results.push(await this.generateProposal(proposal.id));
    const failures = results.filter((r: any) => r.status === 'failed');
    await this.ds().query(`UPDATE "${this.schema()}".site_proposal_import_batches SET status = $2, generated_at = now() WHERE id = $1`, [id, failures.length ? 'partial' : 'generated']);
    return { total: results.length, success: results.length - failures.length, failed: failures.length, results };
  }

  async list(query: Record<string, any>) {
    this.assertAccess(false);
    await this.ensure();
    const schema = this.schema();
    const limit = Math.max(1, Math.min(100, Number(query.limit || 25) || 25));
    const offset = Math.max(0, Number(query.offset || 0) || 0);
    const allowedSort = new Set(['updated_at', 'created_at', 'display_name', 'status']);
    const sortBy = allowedSort.has(String(query.sortBy || '')) ? String(query.sortBy) : 'updated_at';
    const sortOrder = String(query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    for (const [field, column] of Object.entries({ status: 'status', templateSlug: 'template_slug', companyId: 'company_id', importBatchId: 'import_batch_id' })) {
      if (query[field]) {
        params.push(query[field]);
        where.push(`${column} = $${params.length}`);
      }
    }
    if (query.search) {
      params.push(`%${String(query.search).toLowerCase()}%`);
      where.push(`lower(display_name) LIKE $${params.length}`);
    }
    const sqlWhere = where.join(' AND ');
    const count = await this.one(`SELECT count(*)::int total FROM "${schema}".site_proposals WHERE ${sqlWhere}`, params);
    const items = await this.ds().query(`SELECT id, display_name, status, template_slug, template_version, company_id, current_version, last_generated_at, updated_at FROM "${schema}".site_proposals WHERE ${sqlWhere} ORDER BY ${sortBy} ${sortOrder} NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    return { items, total: Number(count?.total || 0), limit, offset };
  }

  async createManual(body: Record<string, any>) {
    const user = this.assertAccess(true);
    assertNoPrototypePollution(body);
    await this.ensure();
    if (body.templateSlug && body.templateSlug !== COLSOVA_TEMPLATE.slug) throw new NotFoundException('Template non trovato');
    const sourceData = (body.sourceData && typeof body.sourceData === 'object' ? body.sourceData : {}) as Record<string, string>;
    const canonical = this.csv.normalizeRow({ ...sourceData, business_name: body.displayName || sourceData.business_name || sourceData.businessName || sourceData.name }, []);
    const warnings: RowIssue[] = [];
    const siteConfig = this.csv.buildSiteConfig(await this.templates.getDefaultConfig(), canonical, warnings);
    const analysis = analysisFor(canonical);
    const email = buildEmail(canonical);
    const inserted = await this.one(
      `INSERT INTO "${this.schema()}".site_proposals
       (source_row_hash, fingerprint, template_slug, template_version, status, display_name, source_data, site_config, validation_warnings, commercial_analysis, email_subject, email_body, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'draft',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$12) RETURNING *`,
      [sha256(JSON.stringify(canonical)), buildFingerprint(canonical), COLSOVA_TEMPLATE.slug, COLSOVA_TEMPLATE.version, canonical.businessName, JSON.stringify(canonical), JSON.stringify(siteConfig), JSON.stringify(warnings), JSON.stringify(analysis), email.subject, email.body, this.userIdOrNull(user.id)],
    );
    await this.createVersion(inserted, 1, user, 'manual_create');
    await this.activity(inserted.id, ACTIVITY.proposalCreated, user, {});
    return inserted;
  }

  async get(id: string) {
    this.assertAccess(false);
    this.assertUuid(id);
    await this.ensure();
    const proposal = await this.one(`SELECT * FROM "${this.schema()}".site_proposals WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!proposal) throw new NotFoundException('Proposta non trovata');
    const latestGeneration = await this.one(`SELECT * FROM "${this.schema()}".site_proposal_generations WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]);
    const versionCount = await this.one(`SELECT count(*)::int count FROM "${this.schema()}".site_proposal_versions WHERE proposal_id = $1`, [id]);
    const activityCount = await this.one(`SELECT count(*)::int count FROM "${this.schema()}".site_proposal_activity WHERE proposal_id = $1`, [id]);
    return { proposal, latestGeneration, versionCount: Number(versionCount?.count || 0), activityCount: Number(activityCount?.count || 0) };
  }

  async update(id: string, body: Record<string, any>) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    assertNoPrototypePollution(body);
    await this.ensure();
    const allowed = new Set(['displayName', 'status', 'siteConfig', 'commercialAnalysis', 'emailSubject', 'emailBody', 'companyId', 'contactId', 'leadId', 'opportunityId']);
    for (const key of Object.keys(body)) if (!allowed.has(key)) throw new BadRequestException(`Campo non consentito: ${key}`);
    const current = (await this.get(id)).proposal;
    if (body.status && (!PROPOSAL_STATUSES.includes(body.status) || !allowedStatusTransition(current.status, body.status))) throw new BadRequestException('Status non valido');
    let siteConfig = current.site_config as JsonObject;
    if (body.siteConfig) {
      siteConfig = deepClone(body.siteConfig as JsonObject);
      forceTemplateContract(siteConfig);
      validateSiteConfig(siteConfig);
    }
    for (const key of ['companyId', 'contactId', 'leadId', 'opportunityId']) if (body[key]) await this.assertCrmRecord(key, body[key]);
    const nextVersion = Number(current.current_version) + 1;
    const next = {
      site_config: siteConfig,
      commercial_analysis: body.commercialAnalysis || current.commercial_analysis,
      email_subject: body.emailSubject ?? current.email_subject,
      email_body: body.emailBody ?? current.email_body,
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { displayName: 'display_name', status: 'status', companyId: 'company_id', contactId: 'contact_id', leadId: 'lead_id', opportunityId: 'opportunity_id' };
    for (const [input, column] of Object.entries(map)) if (input in body) { params.push(body[input] || null); sets.push(`${column} = $${params.length}`); }
    params.push(JSON.stringify(next.site_config), JSON.stringify(next.commercial_analysis), next.email_subject, next.email_body, nextVersion, this.userIdOrNull(user.id), id);
    const updated = await this.one(
      `UPDATE "${this.schema()}".site_proposals SET ${sets.length ? `${sets.join(', ')},` : ''} site_config = $${params.length - 6}::jsonb, commercial_analysis = $${params.length - 5}::jsonb, email_subject = $${params.length - 4}, email_body = $${params.length - 3}, current_version = $${params.length - 2}, updated_by = $${params.length - 1}, updated_at = now() WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    await this.createVersion(updated, nextVersion, user, 'update');
    await this.activity(id, ACTIVITY.proposalUpdated, user, {});
    if ('companyId' in body || 'contactId' in body || 'leadId' in body || 'opportunityId' in body) await this.activity(id, ACTIVITY.crmLinkUpdated, user, {});
    return updated;
  }

  async listVersions(id: string) {
    this.assertAccess(false);
    this.assertUuid(id);
    await this.ensure();
    return this.ds().query(`SELECT * FROM "${this.schema()}".site_proposal_versions WHERE proposal_id = $1 ORDER BY version DESC`, [id]);
  }

  async restoreVersion(id: string, version: number) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const current = (await this.get(id)).proposal;
    const snapshot = await this.one(`SELECT * FROM "${this.schema()}".site_proposal_versions WHERE proposal_id = $1 AND version = $2`, [id, version]);
    if (!snapshot) throw new NotFoundException('Versione non trovata');
    const restoredConfig = deepClone(snapshot.site_config as JsonObject);
    forceTemplateContract(restoredConfig);
    validateSiteConfig(restoredConfig);
    const nextVersion = Number(current.current_version) + 1;
    const restored = await this.one(`UPDATE "${this.schema()}".site_proposals SET site_config = $1::jsonb, commercial_analysis = $2::jsonb, email_subject = $3, email_body = $4, current_version = $5, updated_by = $6, updated_at = now() WHERE id = $7 RETURNING *`, [JSON.stringify(restoredConfig), JSON.stringify(snapshot.commercial_analysis), snapshot.email_subject, snapshot.email_body, nextVersion, this.userIdOrNull(user.id), id]);
    await this.createVersion(restored, nextVersion, user, `restore:${version}`);
    await this.activity(id, ACTIVITY.versionRestored, user, { restoredFrom: version });
    return restored;
  }

  async generateProposal(id: string) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const schema = this.schema();
    const proposal = (await this.get(id)).proposal;
    const generation = await this.one(`INSERT INTO "${schema}".site_proposal_generations (proposal_id, proposal_version, template_slug, template_version, status, created_by, started_at) VALUES ($1,$2,$3,$4,'running',$5,now()) RETURNING *`, [id, proposal.current_version, proposal.template_slug, proposal.template_version, this.userIdOrNull(user.id)]);
    await this.activity(id, ACTIVITY.generationStarted, user, {});
    try {
      const rendered = await this.templates.renderHtml(proposal.site_config);
      const redirects = await this.templates.buildRedirectFiles(proposal.site_config);
      const zip = await this.artifacts.createZip(rendered.html, redirects);
      const prefix = `${GENERATED_STORAGE_PREFIX}/${id}/${generation.id}/`;
      const htmlKey = `${prefix}index.html`;
      const zipKey = `${prefix}demo.zip`;
      await this.fileStorage.uploadGeneratedBuffer(htmlKey, Buffer.from(rendered.html, 'utf8'), 'text/html; charset=utf-8');
      await this.fileStorage.uploadGeneratedBuffer(zipKey, zip.buffer, 'application/zip');
      const completed = await this.one(`UPDATE "${schema}".site_proposal_generations SET status = 'completed', html_key = $1, zip_key = $2, html_sha256 = $3, zip_sha256 = $4, html_size = $5, zip_size = $6, completed_at = now() WHERE id = $7 RETURNING *`, [htmlKey, zipKey, rendered.sha256, zip.sha256, rendered.size, zip.size, generation.id]);
      await this.ds().query(`UPDATE "${schema}".site_proposals SET status = 'generated', last_generated_at = now(), updated_at = now() WHERE id = $1`, [id]);
      await this.activity(id, ACTIVITY.generated, user, {});
      return completed;
    } catch (error) {
      const message = this.sanitizeError(error);
      await this.ds().query(`UPDATE "${schema}".site_proposal_generations SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2`, [message, generation.id]);
      await this.ds().query(`UPDATE "${schema}".site_proposals SET status = 'error', updated_at = now() WHERE id = $1`, [id]);
      await this.activity(id, ACTIVITY.generationFailed, user, { message });
      return { ...generation, status: 'failed', error_message: message };
    }
  }

  async listGenerations(id: string) {
    this.assertAccess(false);
    this.assertUuid(id);
    await this.ensure();
    return this.ds().query(`SELECT * FROM "${this.schema()}".site_proposal_generations WHERE proposal_id = $1 ORDER BY created_at DESC`, [id]);
  }

  async listActivity(id: string, query: Record<string, unknown> = {}) {
    this.assertAccess(false);
    this.assertUuid(id);
    await this.ensure();
    const schema = this.schema();
    const proposal = await this.one(`SELECT id FROM "${schema}".site_proposals WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!proposal) throw new NotFoundException('Proposta non trovata');
    const limit = Math.max(1, Math.min(100, Number(query.limit || 50) || 50));
    const offset = Math.max(0, Number(query.offset || 0) || 0);
    const count = await this.one(`SELECT count(*)::int total FROM "${schema}".site_proposal_activity WHERE proposal_id = $1`, [id]);
    const items = await this.ds().query(
      `SELECT id, action, metadata, actor_user_id, actor_email, created_at FROM "${schema}".site_proposal_activity WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    );
    return { items, total: Number(count?.total || 0), limit, offset };
  }

  async previewHtml(id: string, generationId?: string) {
    const html = await this.downloadArtifact(id, 'html', generationId);
    return html.stream;
  }

  async downloadArtifact(id: string, type: 'html' | 'zip', generationId?: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number; filename: string }> {
    this.assertAccess(false);
    this.assertUuid(id);
    if (generationId) this.assertUuid(generationId);
    await this.ensure();
    const generation = await this.resolveGeneration(id, generationId);
    const key = type === 'html' ? generation.html_key : generation.zip_key;
    const expected = `${GENERATED_STORAGE_PREFIX}/${id}/${generation.id}/`;
    if (!key || !String(key).startsWith(expected)) throw new ForbiddenException('Artifact non valido');
    const object = await this.fileStorage.downloadObjectStream(key);
    return { ...object, filename: type === 'html' ? 'index.html' : 'demo.zip' };
  }

  async archive(id: string) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const row = await this.one(`UPDATE "${this.schema()}".site_proposals SET status = 'archived', deleted_at = COALESCE(deleted_at, now()), updated_by = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING *`, [this.userIdOrNull(user.id), id]);
    if (!row) throw new NotFoundException('Proposta non trovata');
    await this.activity(id, ACTIVITY.proposalArchived, user, {});
    return row;
  }

  private async ensure() {
    const schema = this.schema();
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
  }

  private schema(): string {
    const user = this.request.user || this.request.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || user?.tenantSlug || this.request.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantSiteProposalsService.schema');
    if (schema !== SITE_PROPOSALS_TENANT) throw new NotFoundException();
    return schema;
  }

  private ds(): DataSource {
    return (this.request.tenantConnection as DataSource | undefined) || this.dataSource;
  }

  private assertAccess(write: boolean): AuthUserRef {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    const role = String(user.role || 'user').toLowerCase().trim();
    if (!hasRoleAtLeast(role, 'manager')) throw new ForbiddenException(write ? 'Manager o superiore richiesto.' : 'Manager o superiore richiesto.');
    this.schema();
    return { id: String(user.sub || user.id || user.userId || ''), email: user.email, role };
  }

  private userIdOrNull(id: string): string | null {
    return UUID_RE.test(id) ? id : null;
  }

  private assertUuid(id: string) {
    if (!UUID_RE.test(String(id || ''))) throw new BadRequestException('UUID non valido');
  }

  private async one(sql: string, params: unknown[]) {
    const rows = await this.ds().query(sql, params);
    return rows[0];
  }

  private async createVersion(proposal: any, version: number, user: AuthUserRef, reason: string) {
    await this.ds().query(
      `INSERT INTO "${this.schema()}".site_proposal_versions (proposal_id, version, site_config, commercial_analysis, email_subject, email_body, reason, created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8) ON CONFLICT (proposal_id, version) DO NOTHING`,
      [proposal.id, version, JSON.stringify(proposal.site_config), JSON.stringify(proposal.commercial_analysis), proposal.email_subject, proposal.email_body, reason, this.userIdOrNull(user.id)],
    );
    await this.activity(proposal.id, ACTIVITY.versionCreated, user, { version });
  }

  private async activity(proposalId: string, action: string, user: AuthUserRef, metadata: JsonObject) {
    try {
      await this.ds().query(`INSERT INTO "${this.schema()}".site_proposal_activity (proposal_id, action, metadata, actor_user_id, actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [proposalId, action, JSON.stringify(metadata || {}), this.userIdOrNull(user.id), user.email || null]);
    } catch {
      // Activity non bloccante per tenant legacy durante provisioning concorrente.
    }
  }

  private async matchCompany(input: any, warnings: any[]) {
    const schema = this.schema();
    const website = normalizeWebsite(input.websiteUrl);
    const email = normalizeEmail(input.email);
    const name = normalizeNameKey(input.businessName);
    const attempts: [string, unknown[]][] = [];
    if (website) attempts.push([`SELECT id FROM "${schema}".companies WHERE deleted_at IS NULL AND lower(regexp_replace(coalesce(website,''), '/$', '')) = $1`, [website]]);
    if (email) attempts.push([`SELECT id FROM "${schema}".companies WHERE deleted_at IS NULL AND lower(email) = $1`, [email]]);
    if (name) attempts.push([`SELECT id FROM "${schema}".companies WHERE deleted_at IS NULL AND lower(regexp_replace(name, '[^a-zA-Z0-9]+', ' ', 'g')) = $1`, [name]]);
    for (const [sql, params] of attempts) {
      const rows = await this.ds().query(sql, params);
      if (rows.length === 1) return { companyId: rows[0].id };
      if (rows.length > 1) {
        warnings.push({ code: 'CRM_MATCH_AMBIGUOUS', message: 'Matching CRM ambiguo: collegamento automatico non eseguito.' });
        return { companyId: null };
      }
    }
    warnings.push({ code: 'CRM_MATCH_NOT_FOUND', message: 'Nessuna company CRM collegata automaticamente.' });
    return { companyId: null };
  }

  private async assertCrmRecord(key: string, id: string) {
    this.assertUuid(id);
    const table: Record<string, string> = { companyId: 'companies', contactId: 'contacts', leadId: 'leads', opportunityId: 'opportunities' };
    const row = await this.one(`SELECT id FROM "${this.schema()}".${table[key]} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!row) throw new BadRequestException(`${key} non trovato`);
  }

  private async resolveGeneration(proposalId: string, generationId?: string) {
    const params = generationId ? [proposalId, generationId] : [proposalId];
    const row = await this.one(
      `SELECT * FROM "${this.schema()}".site_proposal_generations WHERE proposal_id = $1 AND status = 'completed' ${generationId ? 'AND id = $2' : ''} ORDER BY created_at DESC LIMIT 1`,
      params,
    );
    if (!row) throw new NotFoundException('Generazione non trovata');
    return row;
  }

  private sanitizeError(error: unknown): string {
    return cleanString(error instanceof Error ? error.message : String(error), 500) || 'Generation failed';
  }
}
