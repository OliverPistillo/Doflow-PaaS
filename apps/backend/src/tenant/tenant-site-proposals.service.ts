import { BadRequestException, ConflictException, ForbiddenException, Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import {
  ACTIVITY,
  COLSOVA_TEMPLATE,
  COLSOVA_LATEST_TEMPLATE,
  GENERATED_STORAGE_PREFIX,
  PROPOSAL_STATUSES,
  SITE_PROPOSALS_TENANT,
} from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { TenantSiteProposalsCsvService } from './tenant-site-proposals-csv.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { TenantSiteProposalsPersonalizationService } from './tenant-site-proposals-personalization.service';
import { buildDeterministicProposal } from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';
import { TenantSiteProposalsGenerationCoreService } from './tenant-site-proposals-generation-core.service';
import { evaluateProposalReadiness } from './tenant-site-proposals-readiness';
import { AuthUserRef, JsonObject, PreviewRow, RowIssue } from './tenant-site-proposals.types';
import { getProposalContentProfileAdapter, hasProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';
import { evaluateProposalPersonalizationDelta } from './tenant-site-proposals-personalization-delta';
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
    @Optional() private readonly personalization?: TenantSiteProposalsPersonalizationService,
    @Optional() private readonly preparationQueue?: TenantSiteProposalsPreparationQueueService,
    @Optional() private readonly generationCore?: TenantSiteProposalsGenerationCoreService,
  ) {}

  async listTemplates() {
    this.assertAccess(false);
    await this.ensure();
    return this.templates.listTemplates();
  }

  async getTemplate(slug: string, version?: string) {
    this.assertAccess(false);
    await this.ensure();
    return this.templates.getTemplate(slug, version);
  }

  async previewImport(file: Express.Multer.File, requestedTemplateSlug?: string, requestedTemplateVersion?: string) {
    const user = this.assertAccess(true);
    await this.ensure();
    const configuredDefault = !requestedTemplateSlug && !requestedTemplateVersion ? await this.defaultThemeSelection() : null;
    const templateSlug = requestedTemplateSlug || configuredDefault?.slug || COLSOVA_LATEST_TEMPLATE.slug;
    const templateVersion = requestedTemplateVersion || configuredDefault?.version;
    const parsed = this.csv.parseCsvFile(file);
    const registration = await this.templates.getRegistration(templateSlug, templateVersion, this.templateContext());
    const defaultConfig = await this.templates.getDefaultConfig(templateSlug, templateVersion, this.templateContext());
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
        registration.version,
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
    if (Number(batch.valid_count || 0) === 0) {
      throw new BadRequestException(
        'Nessuna riga valida da importare. Correggi le intestazioni o i dati e crea un nuovo import.',
      );
    }

    const rows = (batch.rows || []) as PreviewRow[];
    const proposals: JsonObject[] = [];
    for (const row of rows.filter((r) => r.valid && r.canonical && r.siteConfig)) {
      const warnings = [...(row.warnings || [])];
      const match = await this.matchCompany(row.canonical!, warnings);
      const existingActive = await this.one(`SELECT id FROM "${schema}".site_proposals WHERE fingerprint = $1 AND deleted_at IS NULL LIMIT 1`, [row.fingerprint]);
      if (existingActive) warnings.push({ code: 'EXISTING_ACTIVE_PROPOSAL', message: 'Esiste gia una proposta attiva con lo stesso fingerprint.' });
      const deterministic = buildDeterministicProposal(row.siteConfig!, row.canonical!);
      const analysis = deterministic.analysis;
      const email = deterministic.email;
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
        [id, row.rowIndex, row.sourceRowHash, row.fingerprint, batch.template_slug, batch.template_version, row.displayName, match.companyId, JSON.stringify(row.canonical), JSON.stringify(deterministic.config), JSON.stringify(warnings), JSON.stringify(analysis), email.subject, email.body, this.userIdOrNull(user.id)],
      );
      await this.createVersion(inserted, 1, user, 'initial');
      await this.activity(inserted.id, ACTIVITY.proposalCreated, user, {});
      await this.activity(inserted.id, ACTIVITY.importConfirmed, user, { importBatchId: id });
      proposals.push(inserted);
    }
    await this.ds().query(`UPDATE "${schema}".site_proposal_import_batches SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [id]);
    const dispatches: Array<{ proposalId: string; status: 'queued'|'pending_dispatch'|'failed'; error?: string }> = [];
    if (this.preparationQueue) for (const proposal of proposals) {
      try {
        const result = await this.preparationQueue.enqueue(schema, String(proposal.id), user, { force: false, generate: true, reason: 'csv_import', targetTemplateSlug: batch.template_slug, targetTemplateVersion: batch.template_version });
        dispatches.push({ proposalId: String(proposal.id), status: result.pendingDispatch ? 'pending_dispatch' : 'queued' });
      } catch (error) { dispatches.push({ proposalId: String(proposal.id), status: 'failed', error: this.sanitizeError(error) }); }
    }
    return { batch: await this.getImport(id), proposals, queued: dispatches.filter((item) => item.status === 'queued').length, pendingDispatch: dispatches.filter((item) => item.status === 'pending_dispatch').length, failed: dispatches.filter((item) => item.status === 'failed').length, dispatches, idempotent: false };
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
    const scope = String(query.scope || 'active');
    if (scope !== 'active' && scope !== 'archived') {
      throw new BadRequestException('Scope proposte non valido.');
    }
    if (scope === 'archived' && query.status && query.status !== 'archived') {
      throw new BadRequestException('Nell’Archivio lo stato deve essere archived.');
    }
    const limit = Math.max(1, Math.min(100, Number(query.limit || 25) || 25));
    const offset = Math.max(0, Number(query.offset || 0) || 0);
    const allowedSort = new Set(['updated_at', 'created_at', 'display_name', 'status']);
    const sortBy = allowedSort.has(String(query.sortBy || '')) ? String(query.sortBy) : 'updated_at';
    const sortOrder = String(query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = scope === 'archived'
      ? ["deleted_at IS NOT NULL", "status = 'archived'"]
      : ["deleted_at IS NULL", "status <> 'archived'"];
    const params: unknown[] = [];
    for (const [field, column] of Object.entries({ status: 'status', templateSlug: 'template_slug', companyId: 'company_id', importBatchId: 'import_batch_id' })) {
      if (query[field] && !(scope === 'archived' && field === 'status')) {
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
    const rows = await this.ds().query(`SELECT id, display_name, status, archived_from_status, template_slug, template_version, company_id, current_version, last_generated_at, preparation_status, preparation_error, preparation_queued_at, preparation_started_at, preparation_completed_at, latest_preparation_job_id, personalization_status, email_subject, email_body, commercial_analysis, site_config, EXISTS(SELECT 1 FROM "${schema}".site_proposal_generations g WHERE g.proposal_id=site_proposals.id AND g.status='completed' AND g.proposal_version=site_proposals.current_version) generation_complete, updated_at, deleted_at FROM "${schema}".site_proposals WHERE ${sqlWhere} ORDER BY ${sortBy} ${sortOrder} NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    const items = await Promise.all(rows.map(async (row: any) => {
      const readiness = evaluateProposalReadiness({ emailSubject: row.email_subject, emailBody: row.email_body, commercialAnalysis: row.commercial_analysis, siteConfigValid: await this.siteConfigValid(row), generationComplete: row.generation_complete === true, requireGeneration: ['ready','fallback'].includes(row.preparation_status) });
      const { email_subject: _subject, email_body: _body, commercial_analysis: _analysis, site_config: _config, generation_complete: _generation, ...item } = row;
      if (!readiness.complete && ['ready','fallback'].includes(item.preparation_status)) { item.preparation_status = 'idle'; item.personalization_status = 'idle'; item.preparation_error = null; }
      return { ...item, readiness };
    }));
    return { items, total: Number(count?.total || 0), limit, offset };
  }

  async createManual(body: Record<string, any>) {
    const user = this.assertAccess(true);
    assertNoPrototypePollution(body);
    await this.ensure();
    const configuredDefault = !body.templateSlug && !body.templateVersion ? await this.defaultThemeSelection() : null;
    const templateSlug = String(body.templateSlug || configuredDefault?.slug || COLSOVA_LATEST_TEMPLATE.slug);
    const templateVersion = body.templateVersion ? String(body.templateVersion) : configuredDefault?.version;
    const sourceData = (body.sourceData && typeof body.sourceData === 'object' ? body.sourceData : {}) as Record<string, string>;
    const canonical = this.csv.normalizeRow({ ...sourceData, business_name: body.displayName || sourceData.business_name || sourceData.businessName || sourceData.name }, []);
    const warnings: RowIssue[] = [];
    await this.templates.getRegistration(templateSlug, templateVersion, this.templateContext());
    const baseConfig = await this.templates.getDefaultConfig(templateSlug, templateVersion, this.templateContext());
    const selectedTemplate = (baseConfig.template || {}) as JsonObject;
    const siteConfig = this.csv.buildSiteConfig(baseConfig, canonical, warnings);
    const deterministic = buildDeterministicProposal(siteConfig, canonical);
    const analysis = deterministic.analysis;
    const email = deterministic.email;
    const inserted = await this.one(
      `INSERT INTO "${this.schema()}".site_proposals
       (source_row_hash, fingerprint, template_slug, template_version, status, display_name, source_data, site_config, validation_warnings, commercial_analysis, email_subject, email_body, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'draft',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$12) RETURNING *`,
      [sha256(JSON.stringify(canonical)), buildFingerprint(canonical), String(selectedTemplate.slug), String(selectedTemplate.templateVersion), canonical.businessName, JSON.stringify(canonical), JSON.stringify(deterministic.config), JSON.stringify(warnings), JSON.stringify(analysis), email.subject, email.body, this.userIdOrNull(user.id)],
    );
    await this.createVersion(inserted, 1, user, 'manual_create');
    await this.activity(inserted.id, ACTIVITY.proposalCreated, user, {});
    const queued = this.preparationQueue ? await this.preparationQueue.enqueue(this.schema(), inserted.id, user, { force: false, generate: true, reason: 'manual_create', targetTemplateSlug: String(selectedTemplate.slug), targetTemplateVersion: String(selectedTemplate.templateVersion) }) : null;
    return { ...inserted, preparation_status: queued?.status || inserted.preparation_status || 'idle', preparation: queued };
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
    const readiness = evaluateProposalReadiness({ emailSubject: proposal.email_subject, emailBody: proposal.email_body, commercialAnalysis: proposal.commercial_analysis, siteConfigValid: await this.siteConfigValid(proposal), generationComplete: latestGeneration?.status === 'completed' && Number(latestGeneration?.proposal_version) === Number(proposal.current_version), requireGeneration: ['ready','fallback'].includes(proposal.preparation_status) });
    if (!readiness.complete && ['ready','fallback'].includes(proposal.preparation_status)) { proposal.preparation_status = 'idle'; proposal.personalization_status = 'idle'; proposal.preparation_error = null; }
    return { proposal: { ...proposal, readiness }, latestGeneration, versionCount: Number(versionCount?.count || 0), activityCount: Number(activityCount?.count || 0) };
  }

  personalizeProposal(id: string, body: unknown) {
    return this.prepareProposal(id, body, 'deprecated_personalize');
  }

  async prepareProposal(id: string, body: unknown = {}, reason = 'manual_prepare') {
    const user = this.assertAccess(true); this.assertUuid(id); assertNoPrototypePollution(body || {});
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as JsonObject : {};
    const allowed = new Set(['force','targetTemplateSlug','targetTemplateVersion']);
    for (const key of Object.keys(payload)) if (!allowed.has(key)) throw new BadRequestException(`Campo non consentito: ${key}`);
    if (!this.preparationQueue) throw new ConflictException('Coda di preparazione non disponibile');
    return this.preparationQueue.enqueue(this.schema(), id, user, { force: payload.force === true, generate: true, reason, targetTemplateSlug: payload.targetTemplateSlug ? String(payload.targetTemplateSlug) : undefined, targetTemplateVersion: payload.targetTemplateVersion ? String(payload.targetTemplateVersion) : undefined });
  }

  async prepareImport(id: string, body: unknown = {}) {
    const user = this.assertAccess(true); this.assertUuid(id); assertNoPrototypePollution(body || {});
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as JsonObject : {};
    if (Object.keys(payload).some((key) => key !== 'force')) throw new BadRequestException('Body batch prepare non valido');
    if (!this.preparationQueue) throw new ConflictException('Coda di preparazione non disponibile');
    await this.ensure(); const force = payload.force === true;
    const rows = await this.ds().query(`SELECT id,template_slug,template_version FROM "${this.schema()}".site_proposals WHERE import_batch_id=$1 AND deleted_at IS NULL AND status<>'archived' ${force ? '' : "AND coalesce(preparation_status,'idle') NOT IN ('running','ready','fallback')"} ORDER BY source_row_index LIMIT 50`, [id]);
    const results: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      try { results.push({ proposalId: row.id, ...(await this.preparationQueue.enqueue(this.schema(), row.id, user, { force, generate: true, reason: 'existing_batch', targetTemplateSlug: row.template_slug, targetTemplateVersion: row.template_version })) }); }
      catch (error) { results.push({ proposalId: row.id, queued: false, failed: true, error: this.sanitizeError(error) }); }
    }
    return { total: rows.length, queued: results.filter((result) => result.queued).length, pendingDispatch: results.filter((result) => result.pendingDispatch).length, failed: results.filter((result) => result.failed).length, results };
  }

  listPersonalizations(id: string) {
    if (!this.personalization) throw new Error('Personalization service unavailable');
    return this.personalization.list(id);
  }

  async upgradeTemplate(id: string, body: unknown = {}) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    assertNoPrototypePollution(body || {});
    const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as JsonObject : {};
    for (const key of Object.keys(payload)) if (!['targetSlug','targetVersion'].includes(key)) throw new BadRequestException(`Campo non consentito: ${key}`);
    await this.ensure();
    const current = (await this.get(id)).proposal;
    const targetSlug = payload.targetSlug ? String(payload.targetSlug) : current.template_slug;
    const target = await this.templates.getRegistration(targetSlug, payload.targetVersion ? String(payload.targetVersion) : undefined, this.templateContext());
    if (current.template_slug === target.slug && current.template_version === target.version) return { proposal: current, idempotent: true };
    if (!hasProposalContentProfileAdapter(target.contentProfile)) throw new BadRequestException('Profilo target non supportato per l’upgrade.');
    if (this.preparationQueue) return { queued: await this.preparationQueue.enqueue(this.schema(), id, user, { force: true, generate: true, reason: 'template_upgrade', targetTemplateSlug: target.slug, targetTemplateVersion: target.version }), idempotent: false };
    const running = await this.one(`SELECT id FROM "${this.schema()}".site_proposal_generations WHERE proposal_id=$1 AND status='running' LIMIT 1`, [id]);
    if (running) throw new ConflictException('La proposta ha una generazione in corso.');
    const canonical = deepClone(current.source_data || {}) as any;
    canonical.businessName = canonical.businessName || current.display_name;
    canonical.services = Array.isArray(canonical.services) ? canonical.services : [];
    canonical.brands = Array.isArray(canonical.brands) ? canonical.brands : [];
    canonical.extra = canonical.extra && typeof canonical.extra === 'object' ? canonical.extra : {};
    const built = buildDeterministicProposal(await this.templates.getDefaultConfig(target.slug,target.version,this.templateContext()), canonical);
    const oldConfig = current.site_config as JsonObject;
    const oldBusiness = (oldConfig.business || {}) as JsonObject;
    const nextBusiness = built.config.business as JsonObject;
    for (const key of ['email','phoneDisplay','phoneHref','address','socialLinkedIn','socialInstagram','socialFacebook']) if (oldBusiness[key]) nextBusiness[key] = oldBusiness[key];
    const oldImages = (oldConfig.images || {}) as JsonObject;
    const oldLogo = (oldImages.logo || {}) as JsonObject;
    if (oldLogo.src) (built.config.images as JsonObject).logoDefault = { src: oldLogo.src, alt: oldLogo.alt || canonical.businessName };
    validateSiteConfig(built.config,target);
    const version = Number(current.current_version)+1;
    const runner=this.ds().createQueryRunner();let original:unknown;
    try {
      await runner.connect();await runner.startTransaction();
      const locked=(await runner.query(`SELECT id,template_version FROM "${this.schema()}".site_proposals WHERE id=$1 AND deleted_at IS NULL AND status <> 'archived' FOR UPDATE`,[id]))[0];
      if(!locked)throw new NotFoundException('Proposta non trovata');
      if(locked.template_version===target.version){await runner.rollbackTransaction();return {proposal:await this.get(id).then(x=>x.proposal),idempotent:true};}
      const updated=(await runner.query(`UPDATE "${this.schema()}".site_proposals SET template_slug=$1,template_version=$2,site_config=$3::jsonb,commercial_analysis=$4::jsonb,email_subject=$5,email_body=$6,current_version=$7,status='ready',updated_by=$8,updated_at=now() WHERE id=$9 RETURNING *`,[target.slug,target.version,JSON.stringify(built.config),JSON.stringify(built.analysis),built.email.subject,built.email.body,version,this.userIdOrNull(user.id),id]))[0];
      await runner.query(`INSERT INTO "${this.schema()}".site_proposal_versions (proposal_id,version,site_config,commercial_analysis,email_subject,email_body,reason,created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,'template_upgrade',$7)`,[id,version,JSON.stringify(built.config),JSON.stringify(built.analysis),built.email.subject,built.email.body,this.userIdOrNull(user.id)]);
      await runner.query(`INSERT INTO "${this.schema()}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`,[id,ACTIVITY.proposalTemplateUpgraded,JSON.stringify({from:current.template_version,to:target.version}),this.userIdOrNull(user.id),user.email||null]);
      await runner.commitTransaction();return {proposal:updated,idempotent:false};
    }catch(error){original=error;if(runner.isTransactionActive)await runner.rollbackTransaction().catch(()=>undefined);throw error;}finally{await runner.release().catch((error)=>{if(!original)throw error;});}
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
      const template = (siteConfig.template || {}) as JsonObject;
      const registration = await this.templates.getRegistration(String(template.slug || current.template_slug), String(template.templateVersion || current.template_version), this.templateContext());
      forceTemplateContract(siteConfig, registration);
      validateSiteConfig(siteConfig, registration);
    }
    for (const key of ['companyId', 'contactId', 'leadId', 'opportunityId']) if (body[key]) await this.assertCrmRecord(key, body[key]);
    const nextVersion = Number(current.current_version) + 1;
    const next = {
      site_config: siteConfig,
      commercial_analysis: body.commercialAnalysis ?? current.commercial_analysis,
      email_subject: body.emailSubject ?? current.email_subject,
      email_body: body.emailBody ?? current.email_body,
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { displayName: 'display_name', status: 'status', companyId: 'company_id', contactId: 'contact_id', leadId: 'lead_id', opportunityId: 'opportunity_id' };
    for (const [input, column] of Object.entries(map)) if (input in body) { params.push(body[input] || null); sets.push(`${column} = $${params.length}`); }
    params.push(JSON.stringify(next.site_config), JSON.stringify(next.commercial_analysis), next.email_subject, next.email_body, nextVersion, this.userIdOrNull(user.id), id);
    const contentChanged = ['siteConfig','commercialAnalysis','emailSubject','emailBody'].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    const readiness = evaluateProposalReadiness({ emailSubject: next.email_subject, emailBody: next.email_body, commercialAnalysis: next.commercial_analysis, siteConfigValid: await this.siteConfigValid({ ...current, site_config: siteConfig }), generationComplete: false, requireGeneration: contentChanged });
    const updated = await this.one(
      `UPDATE "${this.schema()}".site_proposals SET ${sets.length ? `${sets.join(', ')},` : ''} site_config = $${params.length - 6}::jsonb, commercial_analysis = $${params.length - 5}::jsonb, email_subject = $${params.length - 4}, email_body = $${params.length - 3}, current_version = $${params.length - 2}, updated_by = $${params.length - 1}${contentChanged ? ", preparation_status='idle', preparation_error=NULL, personalization_status='idle'" : ''}, updated_at = now() WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    await this.createVersion(updated, nextVersion, user, 'update');
    await this.activity(id, ACTIVITY.proposalUpdated, user, {});
    if ('companyId' in body || 'contactId' in body || 'leadId' in body || 'opportunityId' in body) await this.activity(id, ACTIVITY.crmLinkUpdated, user, {});
    return { ...updated, readiness };
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
    const restoredMetadata = (restoredConfig.template || {}) as JsonObject;
    const registration = await this.templates.getRegistration(String(restoredMetadata.slug || ''), String(restoredMetadata.templateVersion || ''), this.templateContext(), true);
    forceTemplateContract(restoredConfig, registration);
    validateSiteConfig(restoredConfig, registration);
    const nextVersion = Number(current.current_version) + 1;
    const restoredTemplate = restoredConfig.template as JsonObject;
    const restored = await this.one(`UPDATE "${this.schema()}".site_proposals SET site_config = $1::jsonb, commercial_analysis = $2::jsonb, email_subject = $3, email_body = $4, current_version = $5, updated_by = $6, template_slug = $7, template_version = $8, updated_at = now() WHERE id = $9 RETURNING *`, [JSON.stringify(restoredConfig), JSON.stringify(snapshot.commercial_analysis), snapshot.email_subject, snapshot.email_body, nextVersion, this.userIdOrNull(user.id), String(restoredTemplate.slug), String(restoredTemplate.templateVersion), id]);
    await this.createVersion(restored, nextVersion, user, `restore:${version}`);
    await this.activity(id, ACTIVITY.versionRestored, user, { restoredFrom: version });
    return restored;
  }

  async generateProposal(id: string) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    if (!this.generationCore) throw new Error('Generation core non registrato');
    return this.generationCore.generate(this.schema(), user, id);
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
    const row = await this.one(`UPDATE "${this.schema()}".site_proposals SET archived_from_status = CASE WHEN status <> 'archived' THEN status ELSE archived_from_status END, status = 'archived', deleted_at = COALESCE(deleted_at, now()), updated_by = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL AND status <> 'archived' RETURNING *`, [this.userIdOrNull(user.id), id]);
    if (!row) {
      const archived = await this.one(`SELECT * FROM "${this.schema()}".site_proposals WHERE id = $1 AND deleted_at IS NOT NULL AND status = 'archived'`, [id]);
      if (archived) return archived;
      throw new NotFoundException('Proposta non trovata');
    }
    await this.activity(id, ACTIVITY.proposalArchived, user, {});
    return row;
  }

  async archiveBulk(body: unknown) {
    const user = this.assertAccess(true);
    const ids = this.normalizeBulkIds(body);
    await this.ensure();
    const items = await this.ds().query(
      `UPDATE "${this.schema()}".site_proposals
       SET archived_from_status = CASE WHEN status <> 'archived' THEN status ELSE archived_from_status END,
           status = 'archived', deleted_at = now(), updated_at = now(), updated_by = $1
       WHERE id = ANY($2::uuid[]) AND deleted_at IS NULL AND status <> 'archived'
       RETURNING id, status, deleted_at`,
      [this.userIdOrNull(user.id), ids],
    );
    for (const item of items) await this.activity(item.id, ACTIVITY.proposalArchived, user, {});
    return { requested: ids.length, affected: items.length, items };
  }

  async restore(id: string) {
    const user = this.assertAccess(true);
    this.assertUuid(id);
    await this.ensure();
    const row = await this.restoreArchived(id, user);
    if (!row) throw new NotFoundException('Proposta archiviata non trovata');
    await this.activity(id, ACTIVITY.proposalRestored, user, {});
    return row;
  }

  async restoreBulk(body: unknown) {
    const user = this.assertAccess(true);
    const ids = this.normalizeBulkIds(body);
    await this.ensure();
    const items = await this.ds().query(
      `UPDATE "${this.schema()}".site_proposals
       SET status = CASE
             WHEN archived_from_status = ANY($1::text[]) THEN archived_from_status
             WHEN last_generated_at IS NOT NULL THEN 'generated'
             ELSE 'draft'
           END,
           archived_from_status = NULL, deleted_at = NULL, updated_at = now(), updated_by = $2
       WHERE id = ANY($3::uuid[]) AND deleted_at IS NOT NULL AND status = 'archived'
       RETURNING id, status, deleted_at`,
      [['draft', 'ready', 'generated', 'error'], this.userIdOrNull(user.id), ids],
    );
    for (const item of items) await this.activity(item.id, ACTIVITY.proposalRestored, user, {});
    return { requested: ids.length, affected: items.length, items };
  }

  async delete(id: string) {
    this.assertPermanentDeleteAccess();
    this.assertUuid(id);
    await this.ensure();
    const runner = this.ds().createQueryRunner();
    let originalError: unknown;
    try {
      await runner.connect();
      await runner.startTransaction();
      const proposals = await runner.query(
        `SELECT id FROM "${this.schema()}".site_proposals WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!proposals[0]) throw new NotFoundException('Proposta non trovata');
      const running = await runner.query(
        `SELECT id FROM "${this.schema()}".site_proposal_generations WHERE proposal_id = $1 AND status = 'running' LIMIT 1`,
        [id],
      );
      if (running[0]) throw new ConflictException('La proposta ha una generazione in corso.');
      const prefix = `${GENERATED_STORAGE_PREFIX}/${id}/`;
      const storageObjectsDeleted = await this.fileStorage.deleteGeneratedPrefix(prefix);
      await runner.query(`DELETE FROM "${this.schema()}".site_proposals WHERE id = $1`, [id]);
      await runner.commitTransaction();
      return { deleted: true, id, storageObjectsDeleted };
    } catch (error) {
      originalError = error;
      if (runner.isTransactionActive) {
        try {
          await runner.rollbackTransaction();
        } catch {
          // Preserve the original operation error.
        }
      }
      throw error;
    } finally {
      try {
        await runner.release();
      } catch (releaseError) {
        if (!originalError) throw releaseError;
      }
    }
  }

  async deleteBulk(body: unknown) {
    this.assertPermanentDeleteAccess();
    const ids = this.normalizeBulkIds(body);
    const deletedIds: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];
    for (const id of ids) {
      try {
        await this.delete(id);
        deletedIds.push(id);
      } catch (error) {
        failed.push({ id, message: this.permanentDeleteErrorMessage(error) });
      }
    }
    return { requested: ids.length, deleted: deletedIds.length, deletedIds, failed };
  }

  private async ensure() {
    const schema = this.schema();
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
  }

  private async defaultThemeSelection(): Promise<{ slug: string; version: string } | null> {
    const rows = await this.ds().query(
      `SELECT t.slug, t.default_version AS version
       FROM "${this.schema()}".site_proposal_themes t
       JOIN "${this.schema()}".site_proposal_theme_versions v ON v.theme_id=t.id AND v.version=t.default_version
       WHERE t.is_active=true AND v.status='active' AND v.runtime_adapter_status='ready' AND t.default_version IS NOT NULL
              ORDER BY t.updated_at DESC
       LIMIT 1`,
    );
    return rows[0] ? { slug: String(rows[0].slug), version: String(rows[0].version) } : null;
  }

  private async siteConfigValid(proposal: any): Promise<boolean> {
    try {
      const registration = await this.templates.getRegistration(String(proposal.template_slug), String(proposal.template_version), this.templateContext());
      validateSiteConfig(proposal.site_config as JsonObject, registration);
      if (hasProposalContentProfileAdapter(registration.contentProfile)) {
        const base = await this.templates.getDefaultConfig(registration.slug, registration.version, this.templateContext());
        if (!evaluateProposalPersonalizationDelta(base, proposal.site_config as JsonObject, getProposalContentProfileAdapter(registration.contentProfile)).sufficient) return false;
      }
      return true;
    } catch { return false; }
  }

  private async restoreArchived(id: string, user: AuthUserRef) {
    return this.one(
      `UPDATE "${this.schema()}".site_proposals
       SET status = CASE
             WHEN archived_from_status = ANY($1::text[]) THEN archived_from_status
             WHEN last_generated_at IS NOT NULL THEN 'generated'
             ELSE 'draft'
           END,
           archived_from_status = NULL, deleted_at = NULL, updated_at = now(), updated_by = $2
       WHERE id = $3 AND deleted_at IS NOT NULL AND status = 'archived'
       RETURNING *`,
      [['draft', 'ready', 'generated', 'error'], this.userIdOrNull(user.id), id],
    );
  }

  private normalizeBulkIds(body: unknown): string[] {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Seleziona almeno una proposta.');
    }
    assertNoPrototypePollution(body as Record<string, unknown>);
    const ids = (body as Record<string, unknown>).ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Seleziona almeno una proposta.');
    }
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const value of ids) {
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        throw new BadRequestException('ID proposta non valido.');
      }
      if (!seen.has(value)) {
        seen.add(value);
        unique.push(value);
      }
    }
    if (unique.length > 100) {
      throw new BadRequestException('Puoi gestire al massimo 100 proposte alla volta.');
    }
    return unique;
  }

  private assertPermanentDeleteAccess(): AuthUserRef {
    const user = this.assertAccess(true);
    if (!hasRoleAtLeast(user.role, 'admin')) {
      throw new ForbiddenException('Admin o superiore richiesto.');
    }
    return user;
  }

  private permanentDeleteErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) return 'La proposta ha una generazione in corso.';
    if (error instanceof NotFoundException) return 'Proposta non trovata.';
    return 'Eliminazione non riuscita.';
  }

  private schema(): string {
    const user = this.request?.user || this.request?.authUser;
    const tenantRef = [user?.tenantId,user?.tenant_id,user?.tenantSlug,this.request?.tenantId,this.request?.tenant?.schemaName,this.request?.tenant?.schema].find((value) => typeof value === 'string' && value.trim());
    if (!tenantRef) throw new NotFoundException('Tenant non trovato');
    const schema = safeSchema(tenantRef, 'TenantSiteProposalsService.schema');
    if (schema !== SITE_PROPOSALS_TENANT) throw new NotFoundException('Tenant non trovato');
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

  private templateContext() { return { schema: this.schema(), dataSource: this.ds() }; }
}
