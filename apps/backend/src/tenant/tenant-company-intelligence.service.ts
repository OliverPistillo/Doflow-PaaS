import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EnrichmentService } from '../sales-intelligence/workers/enrichment.service';
import { isTenantAdministrator, tenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';
import { ensureTenantBackendContractTables } from './tenant-backend-contracts-schema';
import { boundedText, rejectActorOverride, rejectTenantOverride } from './tenant-universal-context';

@Injectable()
export class TenantCompanyIntelligenceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly enrichment: EnrichmentService,
    @Inject(REQUEST) private readonly request: any,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}
  private actor() {
    return tenantActor(this.request, 'TenantCompanyIntelligenceService');
  }
  private async authorize(capability: 'canViewAssignedLeads' | 'canAnalyzeCompanies' = 'canViewAssignedLeads') {
    const actor = this.actor();
    await this.capabilities.require(actor, capability);
    return actor;
  }
  private providerState() { return { provider: 'apollo', configured: this.enrichment.isConfigured(), status: this.enrichment.isConfigured() ? 'ready' : 'provider_unconfigured' }; }
  async provider() { await this.authorize(); return this.providerState(); }
  private domain(value: unknown) {
    const domain = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new BadRequestException('domain non valido');
    return domain;
  }
  async list() {
    const actor = await this.authorize();
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const all = isTenantAdministrator(actor) || actor.role === 'manager';
    return { items: await this.dataSource.query(
      `SELECT r.*,
       COALESCE((SELECT jsonb_agg(s) FROM "${actor.schema}".company_intelligence_report_shares s WHERE s.report_id=r.id AND s.revoked_at IS NULL),'[]'::jsonb) AS shares,
       COALESCE((SELECT jsonb_agg(c) FROM "${actor.schema}".company_intelligence_competitors c WHERE c.report_id=r.id AND c.deleted_at IS NULL),'[]'::jsonb) AS competitors
       FROM "${actor.schema}".company_intelligence_reports r
       WHERE deleted_at IS NULL AND ($1::boolean OR owner_user_id=$2 OR EXISTS (SELECT 1 FROM "${actor.schema}".company_intelligence_report_shares s WHERE s.report_id=r.id AND s.user_id=$2 AND s.revoked_at IS NULL))
       ORDER BY created_at DESC LIMIT 200`, [all, actor.id],
    ), provider: this.providerState() };
  }
  async get(idValue: string) {
    const actor = await this.authorize();
    const id = tenantUuid(idValue, 'reportId');
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const all = isTenantAdministrator(actor) || actor.role === 'manager';
    const rows = await this.dataSource.query(
      `SELECT r.*,
       COALESCE((SELECT jsonb_agg(s) FROM "${actor.schema}".company_intelligence_report_shares s WHERE s.report_id=r.id AND s.revoked_at IS NULL),'[]'::jsonb) AS shares,
       COALESCE((SELECT jsonb_agg(c) FROM "${actor.schema}".company_intelligence_competitors c WHERE c.report_id=r.id AND c.deleted_at IS NULL),'[]'::jsonb) AS competitors
       FROM "${actor.schema}".company_intelligence_reports r
       WHERE id=$1 AND deleted_at IS NULL AND ($2::boolean OR owner_user_id=$3 OR EXISTS (SELECT 1 FROM "${actor.schema}".company_intelligence_report_shares s WHERE s.report_id=r.id AND s.user_id=$3 AND s.revoked_at IS NULL)) LIMIT 1`, [id, all, actor.id],
    );
    if (!rows[0]) throw new NotFoundException('Report non trovato');
    return rows[0];
  }
  async analyze(body: Record<string, unknown>) {
    const actor = await this.authorize('canAnalyzeCompanies');
    if (body.userId !== undefined || body.user_id !== undefined || body.tenantId !== undefined || body.tenant_id !== undefined) {
      throw new BadRequestException('Tenant e utente sono determinati dalla sessione');
    }
    const domain = this.domain(body.domain);
    if (!this.enrichment.isConfigured()) return { provider: 'apollo', configured: false, status: 'provider_unconfigured', report: null };
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    try {
      const report = await this.enrichment.lookupCompany(domain);
      const rows = await this.dataSource.query(
        `INSERT INTO "${actor.schema}".company_intelligence_reports
         (owner_user_id,domain,company_name,status,provider,provider_configured,report)
         VALUES ($1,$2,$3,'completed','apollo',true,$4::jsonb) RETURNING *`,
        [actor.id, domain, report.name || domain, JSON.stringify(report)],
      );
      return rows[0];
    } catch {
      const rows = await this.dataSource.query(
        `INSERT INTO "${actor.schema}".company_intelligence_reports
         (owner_user_id,domain,status,provider,provider_configured,error_code)
         VALUES ($1,$2,'failed','apollo',true,'PROVIDER_FAILED') RETURNING id,domain,status,provider,provider_configured,error_code,created_at`,
        [actor.id, domain],
      );
      return rows[0];
    }
  }

  private async writable(idValue: string, ownerOnly = false) {
    const actor = await this.authorize();
    const id = tenantUuid(idValue, 'reportId');
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const elevated = isTenantAdministrator(actor) || actor.role === 'manager';
    const rows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".company_intelligence_reports WHERE id=$1 AND deleted_at IS NULL AND ($2::boolean OR owner_user_id=$3 OR ($4::boolean=false AND EXISTS (SELECT 1 FROM "${actor.schema}".company_intelligence_report_shares s WHERE s.report_id=$1 AND s.user_id=$3 AND s.permission='edit' AND s.revoked_at IS NULL)))`, [id,elevated,actor.id,ownerOnly]);
    if (!rows[0]) throw new NotFoundException('Report non trovato');
    return { actor, id, report: rows[0] };
  }
  async share(idValue: string, body: Record<string, unknown>) {
    rejectTenantOverride(body);
    if (body.actorId !== undefined || body.actor_id !== undefined) throw new BadRequestException('L’attore è determinato dalla sessione');
    const { actor,id }=await this.writable(idValue,true); const userId=tenantUuid(body.targetUserId??body.userId,'targetUserId');
    if(userId===actor.id) throw new BadRequestException('Il proprietario non deve essere condiviso');
    const permission=body.permission==='edit'?'edit':'view'; const users=await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".users WHERE id=$1 AND COALESCE(is_active,true)=true`,[userId]);if(!users[0])throw new NotFoundException('Utente non trovato');
    const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".company_intelligence_report_shares (report_id,user_id,permission,shared_by) VALUES ($1,$2,$3,$4) ON CONFLICT (report_id,user_id) DO UPDATE SET permission=$3,shared_by=$4,created_at=now(),revoked_at=NULL RETURNING *`,[id,userId,permission,actor.id]);return rows[0];
  }
  async revokeShare(idValue:string,userValue:string){const {actor,id}=await this.writable(idValue,true);const userId=tenantUuid(userValue,'targetUserId');await this.dataSource.query(`UPDATE "${actor.schema}".company_intelligence_report_shares SET revoked_at=COALESCE(revoked_at,now()) WHERE report_id=$1 AND user_id=$2`,[id,userId]);return {id,userId,revoked:true};}
  async addCompetitor(idValue:string,body:Record<string,unknown>){rejectActorOverride(body);const {actor,id}=await this.writable(idValue);await this.capabilities.require(actor,'canAnalyzeCompanies');const domain=this.domain(body.requestedUrl??body.domain);const existing=await this.dataSource.query(`SELECT * FROM "${actor.schema}".company_intelligence_competitors WHERE report_id=$1 AND domain=$2 AND deleted_at IS NULL`,[id,domain]);if(existing[0])return existing[0];if(!this.enrichment.isConfigured())throw new BadRequestException('Provider di analisi non configurato');try{const report=await this.enrichment.lookupCompany(domain);const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".company_intelligence_competitors (report_id,domain,company_name,status,report,created_by) VALUES ($1,$2,$3,'completed',$4::jsonb,$5) ON CONFLICT (report_id,domain) DO UPDATE SET company_name=$3,status='completed',report=$4::jsonb,error_code=NULL,deleted_at=NULL,updated_at=now() RETURNING *`,[id,domain,boundedText(body.companyName??report.name??domain,'companyName',200,true),JSON.stringify(report),actor.id]);return rows[0];}catch{const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".company_intelligence_competitors (report_id,domain,company_name,status,error_code,created_by) VALUES ($1,$2,$3,'failed','PROVIDER_FAILED',$4) ON CONFLICT (report_id,domain) DO UPDATE SET status='failed',error_code='PROVIDER_FAILED',deleted_at=NULL,updated_at=now() RETURNING *`,[id,domain,boundedText(body.companyName??domain,'companyName',200,true),actor.id]);return rows[0];}}
  async removeCompetitor(idValue:string,competitorValue:string){const {actor,id}=await this.writable(idValue);const competitorId=tenantUuid(competitorValue,'competitorId');const rows=await this.dataSource.query(`UPDATE "${actor.schema}".company_intelligence_competitors SET deleted_at=COALESCE(deleted_at,now()),updated_at=now() WHERE id=$1 AND report_id=$2 AND deleted_at IS NULL RETURNING id`,[competitorId,id]);if(!rows[0])throw new NotFoundException('Competitor non trovato');return {id:competitorId,deleted:true};}
  async exportReport(idValue:string,body:Record<string,unknown>){rejectActorOverride(body);const report=await this.get(idValue);const actor=await this.authorize();const format=body.format==='csv'?'csv':'json';await this.dataSource.query(`INSERT INTO "${actor.schema}".company_intelligence_exports (report_id,actor_user_id,format) VALUES ($1,$2,$3)`,[report.id,actor.id,format]);if(format==='csv')return {filename:`company-intelligence-${report.id}.csv`,format,content:`domain,status,company\n${JSON.stringify(report.domain)},${JSON.stringify(report.status)},${JSON.stringify(report.company_name||'')}`};return {filename:`company-intelligence-${report.id}.json`,format,content:report};}
  async remove(idValue:string){const {actor,id}=await this.writable(idValue,true);await this.dataSource.query(`UPDATE "${actor.schema}".company_intelligence_reports SET deleted_at=COALESCE(deleted_at,now()),optimistic_version=optimistic_version+1 WHERE id=$1`,[id]);return {id,deleted:true};}
}
