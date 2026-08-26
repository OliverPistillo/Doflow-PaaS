import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EnrichmentService } from '../sales-intelligence/workers/enrichment.service';
import { isTenantAdministrator, tenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';

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
    const all = isTenantAdministrator(actor) || actor.role === 'manager';
    return { items: await this.dataSource.query(
      `SELECT * FROM "${actor.schema}".company_intelligence_reports
       WHERE deleted_at IS NULL AND ($1::boolean OR owner_user_id=$2)
       ORDER BY created_at DESC LIMIT 200`, [all, actor.id],
    ), provider: this.providerState() };
  }
  async get(idValue: string) {
    const actor = await this.authorize();
    const id = tenantUuid(idValue, 'reportId');
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    const all = isTenantAdministrator(actor) || actor.role === 'manager';
    const rows = await this.dataSource.query(
      `SELECT * FROM "${actor.schema}".company_intelligence_reports
       WHERE id=$1 AND deleted_at IS NULL AND ($2::boolean OR owner_user_id=$3) LIMIT 1`, [id, all, actor.id],
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
}
