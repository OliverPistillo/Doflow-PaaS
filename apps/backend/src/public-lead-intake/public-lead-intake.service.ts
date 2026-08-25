import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { NotificationsService } from '../realtime/notifications.service';
import { RedisService } from '../redis/redis.service';
import { ANONYMOUS_CLIENT_IP, normalizeIpAddress } from '../common/client-ip.utils';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantCrmCoreTables } from '../tenant/tenant-crm-schema';
import { isDoflowTenant } from '../tenant/commercial-stage-model';
import { TenantNotificationsService } from '../tenant/tenant-notifications.service';
import { PublicLeadIntakeDto } from './public-lead-intake.dto';
import { ensureLeadIntakeSubmissionsTable } from './public-lead-intake-schema';
import { isPublicLeadIntakeTenantEnabled } from './public-lead-intake-tenants';

type TenantResolution = {
  id: string;
  slug: string;
  schema: string;
};

export type PublicLeadIntakeResponse = {
  success: true;
  reference: string;
  duplicate: boolean;
  message: string;
};

export class PublicLeadRateLimitException extends HttpException {
  constructor(readonly retryAfter: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Troppe richieste. Riprova più tardi.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class PublicLeadIntakeService {
  private readonly logger = new Logger(PublicLeadIntakeService.name);
  private readonly localRateLimit = new Map<string, { minuteCount: number; minuteReset: number; dayCount: number; dayReset: number }>();
  private readonly maxLocalRateLimitEntries = 10_000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly tenantNotificationsService: TenantNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submit(
    tenantSlug: string,
    dto: PublicLeadIntakeDto,
    requestMeta: { origin?: string | null; ip?: string | null },
  ): Promise<PublicLeadIntakeResponse> {
    if (dto.privacy_accepted !== true) {
      throw new BadRequestException('Consenso privacy obbligatorio.');
    }

    this.assertAllowedOrigin(requestMeta.origin);

    const tenant = await this.resolveTenant(tenantSlug);
    await this.assertRateLimit(requestMeta.ip);

    if (dto.website || dto.completion_seconds < 2) {
      return this.success(dto.submission_id, false);
    }

    await ensureTenantCrmCoreTables(this.dataSource, tenant.schema);
    await ensureLeadIntakeSubmissionsTable(this.dataSource, tenant.schema);

    const result = await this.createCrmRecords(tenant.schema, dto, requestMeta.origin || null);
    if (!result.created) return this.success(dto.submission_id, true);

    void this.notifyAfterCommit(tenant, dto.submission_id, result.opportunityId, result.leadId)
      .catch((error) => {
        this.logger.warn(`Notifiche intake sito non inviate per submission ${dto.submission_id}: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
      });

    return this.success(dto.submission_id, false);
  }

  private success(submissionId: string, duplicate: boolean): PublicLeadIntakeResponse {
    return {
      success: true,
      reference: submissionId,
      duplicate,
      message: 'Richiesta ricevuta correttamente.',
    };
  }

  private normalizeOrigin(value?: string | null): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return `${url.protocol}//${url.host}`.toLowerCase();
    } catch {
      return null;
    }
  }

  private publicOrigins(): string[] {
    return String(process.env.CORS_PUBLIC_ORIGINS || '')
      .split(',')
      .map((origin) => this.normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => Boolean(origin));
  }

  private assertAllowedOrigin(origin?: string | null) {
    const normalized = this.normalizeOrigin(origin);
    const allowed = new Set(this.publicOrigins());
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

    if (!normalized) {
      if (isProduction) throw new ForbiddenException('Origine non autorizzata.');
      return;
    }

    if (!allowed.has(normalized)) {
      throw new ForbiddenException('Origine non autorizzata.');
    }
  }

  private async resolveTenant(tenantSlug: string): Promise<TenantResolution> {
    const slug = String(tenantSlug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
      throw new ForbiddenException('Tenant non autorizzato.');
    }
    if (!isPublicLeadIntakeTenantEnabled(slug)) {
      throw new ForbiddenException('Tenant non autorizzato.');
    }

    const rows = await this.dataSource.query(
      `SELECT id::text, slug, schema_name, is_active
       FROM public.tenants
       WHERE lower(slug) = lower($1)
       LIMIT 1`,
      [slug],
    );
    const row = rows[0];
    if (!row || row.is_active !== true) {
      throw new ForbiddenException('Tenant non autorizzato.');
    }

    const schema = safeSchema(row.schema_name, 'PublicLeadIntakeService.resolveTenant');
    if (schema === 'public') throw new ForbiddenException('Tenant non autorizzato.');
    return { id: row.id, slug: row.slug, schema };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private clientIp(ip?: string | null): string {
    return normalizeIpAddress(ip) || ANONYMOUS_CLIENT_IP;
  }

  private async assertRateLimit(ip?: string | null) {
    const keyPart = this.hash(this.clientIp(ip));
    const minuteKey = `df:public-lead:intake:ip:${keyPart}:m`;
    const dayKey = `df:public-lead:intake:ip:${keyPart}:d`;

    try {
      const client = this.redisService.getClient();
      const minuteCount = Number(await client.incr(minuteKey));
      if (minuteCount === 1) await client.expire(minuteKey, 60);
      const minuteTtl = Math.max(1, Number(await client.ttl(minuteKey)) || 60);
      if (minuteCount > 5) throw new PublicLeadRateLimitException(minuteTtl);

      const dayCount = Number(await client.incr(dayKey));
      if (dayCount === 1) await client.expire(dayKey, 86400);
      const dayTtl = Math.max(1, Number(await client.ttl(dayKey)) || 86400);
      if (dayCount > 30) throw new PublicLeadRateLimitException(dayTtl);
    } catch (error) {
      if (error instanceof PublicLeadRateLimitException) throw error;
      this.logger.warn('Redis rate limit non disponibile per intake sito; uso fallback locale temporaneo.');
      this.assertLocalRateLimit(keyPart);
    }
  }

  private assertLocalRateLimit(keyPart: string) {
    const now = Date.now();
    this.pruneLocalRateLimit(now);
    const current = this.localRateLimit.get(keyPart) || {
      minuteCount: 0,
      minuteReset: now + 60_000,
      dayCount: 0,
      dayReset: now + 86_400_000,
    };

    if (now >= current.minuteReset) {
      current.minuteCount = 0;
      current.minuteReset = now + 60_000;
    }
    if (now >= current.dayReset) {
      current.dayCount = 0;
      current.dayReset = now + 86_400_000;
    }

    current.minuteCount += 1;
    current.dayCount += 1;
    this.localRateLimit.set(keyPart, current);

    if (current.minuteCount > 5) {
      throw new PublicLeadRateLimitException(Math.max(1, Math.ceil((current.minuteReset - now) / 1000)));
    }
    if (current.dayCount > 30) {
      throw new PublicLeadRateLimitException(Math.max(1, Math.ceil((current.dayReset - now) / 1000)));
    }
  }

  private pruneLocalRateLimit(now: number) {
    for (const [key, value] of this.localRateLimit) {
      if (now >= value.minuteReset && now >= value.dayReset) {
        this.localRateLimit.delete(key);
      }
    }

    while (this.localRateLimit.size >= this.maxLocalRateLimitEntries) {
      const oldestKey = this.localRateLimit.keys().next().value;
      if (!oldestKey) break;
      this.localRateLimit.delete(oldestKey);
    }
  }

  private async createCrmRecords(schema: string, dto: PublicLeadIntakeDto, origin: string | null) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const duplicate = await this.findSubmission(runner, schema, dto.submission_id);
      if (duplicate) {
        await runner.commitTransaction();
        return { created: false, leadId: duplicate.lead_id, opportunityId: duplicate.opportunity_id };
      }

      const companyId = await this.findOrCreateCompany(runner, schema, dto);
      const contactId = await this.findOrCreateContact(runner, schema, dto, companyId);
      const notes = this.notes(dto);
      const title = `Richiesta sito - ${dto.project_type} - ${dto.name}`;

      const leadRows = await runner.query(
        `INSERT INTO "${schema}".leads (
           company_id, contact_id, title, source, interest, urgency, status,
           next_action, next_action_at, notes, created_by, updated_by, created_at, updated_at
         )
         VALUES ($1, $2, $3, 'website_form', $4, $5, 'new', $6, now(), $7, NULL, NULL, now(), now())
         RETURNING id`,
        [
          companyId,
          contactId,
          title,
          `${dto.project_type}; ${dto.goals.join(', ')}`,
          dto.timeline,
          'Contattare il lead dal sito',
          notes,
        ],
      );
      const leadId = leadRows[0].id;

      const opportunityRows = await runner.query(
        `INSERT INTO "${schema}".opportunities (
           company_id, contact_id, lead_id, title, service_type, lead_source,
           lead_interest, lead_urgency, stage, next_action, next_action_at,
           notes, created_by, updated_by, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, 'website_form', $6, $7, $8, $9, now(), $10, NULL, NULL, now(), now())
         RETURNING id`,
        [
          companyId,
          contactId,
          leadId,
          title,
          dto.project_type,
          dto.goals.join(', '),
          dto.timeline,
          isDoflowTenant(schema) ? 'new' : 'new_lead',
          'Contattare il lead dal sito',
          notes,
        ],
      );
      const opportunityId = opportunityRows[0].id;

      const activityRows = await runner.query(
        `INSERT INTO "${schema}".commercial_activities (
           company_id, contact_id, lead_id, opportunity_id, type, title, description,
           due_at, created_by, updated_by, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, 'website_lead_received', 'Nuova richiesta dal sito', $5, now(), NULL, NULL, now(), now())
         RETURNING id`,
        [
          companyId,
          contactId,
          leadId,
          opportunityId,
          `Richiesta ${dto.project_type} ricevuta dal form pubblico.`,
        ],
      );
      const activityId = activityRows[0].id;

      await runner.query(
        `INSERT INTO "${schema}".lead_intake_submissions (
           submission_id, company_id, contact_id, lead_id, opportunity_id, activity_id,
           source_origin, landing_url, attribution, form_data, privacy_accepted_at, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, now(), now())`,
        [
          dto.submission_id,
          companyId,
          contactId,
          leadId,
          opportunityId,
          activityId,
          origin,
          dto.landing_url,
          JSON.stringify(this.attribution(dto)),
          JSON.stringify(this.formData(dto)),
        ],
      );

      const attribution = this.attribution(dto);
      await runner.query(
        `INSERT INTO "${schema}".commercial_attributions (
           company_id, contact_id, lead_id, opportunity_id, source, medium,
           campaign_name, content, term, gclid, fbclid, ttclid, landing_url,
           referrer, attribution_model, occurred_at, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           'last_non_direct', now(), $15::jsonb
         )`,
        [
          companyId,
          contactId,
          leadId,
          opportunityId,
          dto.utm_source || 'website_form',
          dto.utm_medium || null,
          dto.utm_campaign || null,
          dto.utm_content || null,
          dto.utm_term || null,
          dto.gclid || null,
          dto.fbclid || null,
          dto.ttclid || null,
          dto.landing_url,
          dto.referrer || null,
          JSON.stringify({ submission_id: dto.submission_id, form_version: dto.form_version }),
        ],
      );

      const operationId = randomUUID();
      const correlationId = randomUUID();
      const eventMetadata = {
        submission_id: dto.submission_id,
        company_id: companyId,
        contact_id: contactId,
        lead_id: leadId,
        opportunity_id: opportunityId,
        activity_id: activityId,
        attribution_model: 'last_non_direct',
      };
      await runner.query(
        `INSERT INTO "${schema}".commercial_history
           (operation_id, correlation_id, entity_type, entity_id, event_type,
            before_state, after_state, metadata)
         VALUES ($1, $2, 'opportunity', $3, 'commercial_public_lead_intake_created',
                 NULL, $4::jsonb, $5::jsonb)`,
        [operationId, correlationId, opportunityId, JSON.stringify({ stage: isDoflowTenant(schema) ? 'new' : 'new_lead' }), JSON.stringify(eventMetadata)],
      );
      await runner.query(
        `INSERT INTO "${schema}".audit_log
           (actor_email, actor_role, action, target, metadata, created_at)
         VALUES (NULL, 'public_intake', 'commercial_public_lead_intake_created', $1, $2::jsonb, now())`,
        [opportunityId, JSON.stringify({ operation_id: operationId, correlation_id: correlationId, ...eventMetadata })],
      );
      await runner.query(
        `INSERT INTO "${schema}".commercial_outbox
           (operation_id, correlation_id, topic, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, 'commercial_public_lead_intake_created', 'opportunity', $3, $4::jsonb)`,
        [operationId, correlationId, opportunityId, JSON.stringify(eventMetadata)],
      );

      await runner.commitTransaction();
      return { created: true, leadId, opportunityId };
    } catch (error: any) {
      await runner.rollbackTransaction();
      if (error?.code === '23505') {
        const existing = await this.findSubmission(this.dataSource as any, schema, dto.submission_id);
        if (existing) return { created: false, leadId: existing.lead_id, opportunityId: existing.opportunity_id };
      }
      throw new InternalServerErrorException('Richiesta non completata. Riprova più tardi.');
    } finally {
      await runner.release();
    }
  }

  private async findSubmission(queryable: Pick<QueryRunner, 'query'>, schema: string, submissionId: string) {
    const rows = await queryable.query(
      `SELECT lead_id, opportunity_id
       FROM "${schema}".lead_intake_submissions
       WHERE submission_id = $1
       LIMIT 1`,
      [submissionId],
    );
    return rows[0] || null;
  }

  private async findOrCreateCompany(runner: QueryRunner, schema: string, dto: PublicLeadIntakeDto): Promise<string | null> {
    if (!dto.company) return null;
    const existing = await runner.query(
      `SELECT id FROM "${schema}".companies
       WHERE lower(name) = lower($1) AND deleted_at IS NULL
       LIMIT 1`,
      [dto.company],
    );
    if (existing[0]) return existing[0].id;

    const rows = await runner.query(
      `INSERT INTO "${schema}".companies (
         name, email, phone, province, status, source, created_by, updated_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 'prospect', 'website_form', NULL, NULL, now(), now())
       RETURNING id`,
      [dto.company, dto.email, dto.phone, dto.province],
    );
    return rows[0].id;
  }

  private async findOrCreateContact(runner: QueryRunner, schema: string, dto: PublicLeadIntakeDto, companyId: string | null): Promise<string> {
    await runner.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`public_lead_contact:${dto.email.toLowerCase()}`]);
    const existing = await runner.query(
      `SELECT id, phone, company_id
       FROM "${schema}".contacts
       WHERE lower(email) = lower($1) AND deleted_at IS NULL
       LIMIT 1`,
      [dto.email],
    );
    if (existing[0]) {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (!existing[0].phone) {
        params.push(dto.phone);
        updates.push(`phone = $${params.length}`);
      }
      if (companyId && !existing[0].company_id) {
        params.push(companyId);
        updates.push(`company_id = $${params.length}`);
      }
      if (updates.length > 0) {
        params.push(existing[0].id);
        await runner.query(
          `UPDATE "${schema}".contacts SET ${updates.join(', ')}, updated_at = now()
           WHERE id = $${params.length}`,
          params,
        );
      }
      return existing[0].id;
    }

    const { firstName, lastName } = this.splitName(dto.name);
    const rows = await runner.query(
      `INSERT INTO "${schema}".contacts (
         company_id, first_name, last_name, email, phone, is_primary,
         created_by, updated_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, now(), now())
       RETURNING id`,
      [companyId, firstName, lastName, dto.email, dto.phone, Boolean(companyId)],
    );
    return rows[0].id;
  }

  private splitName(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || null };
  }

  private attribution(dto: PublicLeadIntakeDto) {
    return {
      form_version: dto.form_version,
      referrer: dto.referrer || null,
      utm_source: dto.utm_source || null,
      utm_medium: dto.utm_medium || null,
      utm_campaign: dto.utm_campaign || null,
      utm_content: dto.utm_content || null,
      utm_term: dto.utm_term || null,
      gclid: dto.gclid || null,
      fbclid: dto.fbclid || null,
      ttclid: dto.ttclid || null,
      completion_seconds: dto.completion_seconds,
    };
  }

  private formData(dto: PublicLeadIntakeDto) {
    return {
      form_version: dto.form_version,
      project_type: dto.project_type,
      goals: dto.goals,
      timeline: dto.timeline,
      province: dto.province,
    };
  }

  private notes(dto: PublicLeadIntakeDto): string {
    const utm = [
      dto.utm_source ? `source=${dto.utm_source}` : null,
      dto.utm_medium ? `medium=${dto.utm_medium}` : null,
      dto.utm_campaign ? `campaign=${dto.utm_campaign}` : null,
      dto.utm_content ? `content=${dto.utm_content}` : null,
      dto.utm_term ? `term=${dto.utm_term}` : null,
    ].filter(Boolean).join(', ') || 'nessuna';

    return [
      `Progetto: ${dto.project_type}`,
      `Obiettivi: ${dto.goals.join(', ')}`,
      `Tempistica: ${dto.timeline}`,
      `Provincia: ${dto.province}`,
      `Pagina di origine: ${dto.landing_url}`,
      `Referrer: ${dto.referrer || '-'}`,
      `Attribution UTM: ${utm}`,
      `Riferimento submission: ${dto.submission_id}`,
    ].join('\n');
  }

  private async notifyAfterCommit(tenant: TenantResolution, submissionId: string, opportunityId: string, leadId: string) {
    const linkUrl = `/pipeline?stage=new&opportunity=${encodeURIComponent(opportunityId)}`;
    const base = {
      title: 'Nuova richiesta dal sito',
      body: 'Una nuova richiesta dal sito e disponibile nella pipeline.',
      type: 'website_lead_received',
      priority: 'high',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      link_url: linkUrl,
      metadata: { lead_id: leadId },
    };

    for (const role of ['owner', 'admin']) {
      await this.tenantNotificationsService.createNotification(tenant.schema, {
        ...base,
        recipient_role: role,
        fingerprint: `website_lead_received:${submissionId}:role:${role}`,
      });
    }

    await this.notificationsService.notifyTenant(tenant.id, {
      type: 'website_lead_received',
      priority: 'high',
      title: 'Nuova richiesta dal sito',
      entity_type: 'opportunity',
      link_url: linkUrl,
    });
  }
}
