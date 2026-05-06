// apps/backend/src/sales-intelligence/workers/enrichment.service.ts
//
// Apollo.io endpoints usati:
//   POST api/v1/organizations/enrich          → dati aziendali completi
//   POST api/v1/mixed_people/api_search → persone per dominio (seniority filter)
//
// Variabile d'ambiente richiesta: APOLLO_API_KEY
//
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { CompanyIntel } from '../entities/company-intel.entity';
import { Prospect } from '../entities/prospect.entity';
import { AnalyzeProspectDto } from '../dto/analyze-prospect.dto';

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

// ─── Apollo response types ─────────────────────────────────────────────────────

interface ApolloTechnology {
  uid: string;
  name: string;
  category: string;
}

interface ApolloFundingEvent {
  id: string;
  date: string;
  amount: number;
  currency: string;
  series: string;
  investors: string[];
}

interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  annual_revenue_printed?: string;
  primary_domain?: string;
  country?: string;
  city?: string;
  short_description?: string;
  technologies?: ApolloTechnology[];
  funding_events?: ApolloFundingEvent[];
  latest_funding_stage?: string;
  total_funding?: number;
  total_funding_printed?: string;
}

interface ApolloOrgResponse {
  organization?: ApolloOrganization;
}

export interface ApolloPerson {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  title?: string;
  seniority?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  country?: string;
  photo_url?: string;
}

interface ApolloTopPeopleResponse {
  people?: ApolloPerson[];
}

// ─── Exported types ───────────────────────────────────────────────────────────

export interface CompanyLookupResult {
  apolloOrgId: string;
  name: string;
  domain: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: string;
  country?: string;
  city?: string;
  linkedinUrl?: string;
  shortDescription?: string;
  techStack?: string[];
  fundingStage?: string;
  totalFunding?: string;
  fundingEvents?: ApolloFundingEvent[];
  /** Lista persone — max 10, ordinate per seniority */
  people: ApolloPerson[];
  /** true se Apollo non ha dati per questo dominio */
  notFoundInApollo?: boolean;
}

export interface EnrichedProspect {
  fullName: string;
  email?: string;
  jobTitle?: string;
  seniority?: string;
  linkedinUrl?: string;
  phone?: string;
  company: {
    name: string;
    domain: string;
    industry?: string;
    employeeCount?: number;
    annualRevenue?: string;
    techStack?: string[];
    country?: string;
    city?: string;
    linkedinUrl?: string;
    shortDescription?: string;
    fundingStage?: string;
    totalFunding?: string;
    fundingEvents?: ApolloFundingEvent[];
  };
  prospectId: string;
  companyId: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly apolloKey: string;

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(CompanyIntel)
    private readonly companyRepo: Repository<CompanyIntel>,
    @InjectRepository(Prospect)
    private readonly prospectRepo: Repository<Prospect>,
  ) {
    const key = process.env.APOLLO_API_KEY;
    if (!key) {
      this.logger.warn(
        '[SalesIntel] APOLLO_API_KEY non configurata. ' +
        'Il modulo Sales Intelligence è in modalità degradata (enrichment disabilitato). ' +
        'Aggiungi APOLLO_API_KEY nel file .env per abilitare Apollo.io.',
      );
      this.apolloKey = '';
    } else {
      this.apolloKey = key;
    }
  }

  // ─── STEP A: lookup azienda + lista persone (chiamato dal controller lookup) ─

  async lookupCompany(domain: string): Promise<CompanyLookupResult> {
    const org    = await this.fetchOrganization(domain);

    // Apollo non ha questo dominio — restituisce dati minimi senza bloccare
    if (!org) {
      return {
        apolloOrgId:  '',
        name:         domain,
        domain,
        people:       [],
        notFoundInApollo: true,
      };
    }

    const people = await this.fetchTopPeople(org.id, domain);

    return {
      apolloOrgId:      org.id,
      name:             org.name,
      domain:           org.primary_domain ?? domain,
      industry:         org.industry,
      employeeCount:    org.estimated_num_employees,
      annualRevenue:    org.annual_revenue_printed,
      country:          org.country,
      city:             org.city,
      linkedinUrl:      org.linkedin_url,
      shortDescription: org.short_description,
      techStack:        (org.technologies ?? []).map(t => t.name),
      fundingStage:     org.latest_funding_stage,
      totalFunding:     org.total_funding_printed,
      fundingEvents:    org.funding_events ?? [],
      people,
    };
  }

  // ─── STEP B: enrich con prospect selezionato (chiamato dal processor) ─────────

  async enrich(dto: AnalyzeProspectDto): Promise<EnrichedProspect> {
    // Prende i dati aziendali (dalla cache se disponibile)
    // org può essere null se Apollo non ha dati per questo dominio
    const org   = await this.fetchOrganization(dto.domain);
    const saved = await this.upsertCompany(org ?? null, dto.domain);

    // Il prospect viene dal form (già selezionato dall'utente nella UI)
    const prospect = await this.upsertProspect(dto, saved.id);

    return {
      fullName:    prospect.fullName,
      email:       prospect.email,
      jobTitle:    prospect.jobTitle,
      seniority:   prospect.seniority,
      linkedinUrl: prospect.linkedinUrl,
      company: {
        name:             saved.name,
        domain:           saved.domain,
        industry:         saved.industry,
        employeeCount:    saved.employeeCount,
        annualRevenue:    saved.annualRevenue,
        techStack:        saved.techStack ?? [],
        country:          saved.country,
        linkedinUrl:      saved.linkedinUrl,
        shortDescription: (saved as any).shortDescription,
        fundingStage:     saved.fundingInfo?.['stage'] as string | undefined,
        totalFunding:     saved.fundingInfo?.['total'] as string | undefined,
        fundingEvents:    (saved.fundingInfo?.['events'] ?? []) as ApolloFundingEvent[],
      },
      prospectId: prospect.id,
      companyId:  saved.id,
    };
  }

  // ─── Apollo: organizations/enrich ────────────────────────────────────────────

  private async fetchOrganization(domain: string): Promise<ApolloOrganization | null> {
    const cacheKey = `si:apollo:org:${domain}`;
    const cached   = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      this.logger.log(`[Apollo] Cache HIT org: ${domain}`);
      return JSON.parse(cached);
    }

    this.logger.log(`[Apollo] organizations/enrich → ${domain}`);

    const res = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key':     this.apolloKey,
      },
      body: JSON.stringify({ domain }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(
        `[Apollo] organizations/enrich HTTP ${res.status} per "${domain}": ${body}`,
      );
    }

    const data: ApolloOrgResponse = await res.json();
    if (!data.organization) {
      this.logger.warn(`[Apollo] Nessun risultato per il dominio "${domain}" — azienda non trovata nel database Apollo`);
      return null;
    }

    await this.redisService.getClient().set(
      cacheKey,
      JSON.stringify(data.organization),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return data.organization;
  }

  // ─── Apollo: mixed_people/api_search (ricerca persone per dominio) ──────────────

  private async fetchTopPeople(organizationId: string, domain: string): Promise<ApolloPerson[]> {
    const cacheKey = `si:apollo:people:${domain}`;
    const cached   = await this.redisService.getClient().get(cacheKey);
    if (cached) {
      this.logger.log(`[Apollo] Cache HIT people: ${domain}`);
      return JSON.parse(cached);
    }

    this.logger.log(`[Apollo] mixed_people/api_search → ${domain}`);

    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key':     this.apolloKey,
      },
      body: JSON.stringify({
        // Cerca per dominio azienda — funziona anche senza organization_id
        organization_domains: [domain],
        person_seniorities: ['c_suite', 'founder', 'vp', 'director', 'manager'],
        per_page: 10,
        page: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`[Apollo] mixed_people/api_search HTTP ${res.status}: ${body}`);
      return [];
    }

    const data: ApolloTopPeopleResponse = await res.json();
    const people = data.people ?? [];

    this.logger.log(`[Apollo] Trovate ${people.length} persone per ${domain}`);

    await this.redisService.getClient().set(
      cacheKey,
      JSON.stringify(people),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return people;
  }

  // ─── DB helpers ───────────────────────────────────────────────────────────────

  private async upsertCompany(org: ApolloOrganization | null, domain: string): Promise<CompanyIntel> {
    // Se Apollo non ha dati, salva solo il dominio e il nome
    const data = org ? {
      name:         org.name,
      domain,
      industry:     org.industry,
      employeeCount: org.estimated_num_employees,
      annualRevenue: org.annual_revenue_printed,
      country:      org.country,
      linkedinUrl:  org.linkedin_url,
      techStack:    (org.technologies ?? []).map(t => t.name),
      fundingInfo: {
        events: org.funding_events ?? [],
        total:  org.total_funding_printed,
        stage:  org.latest_funding_stage,
      },
      enrichedAt: new Date(),
    } : {
      name:      domain,
      domain,
      enrichedAt: new Date(),
    };

    const existing = await this.companyRepo.findOne({ where: { domain } });
    if (existing) {
      await this.companyRepo.update(existing.id, data as any);
      return { ...existing, ...data } as CompanyIntel;
    }
    return this.companyRepo.save({ ...data, domain } as any);
  }

  private async upsertProspect(dto: AnalyzeProspectDto, companyId: string): Promise<Prospect> {
    const existing = await this.prospectRepo.findOne({
      where: { fullName: dto.fullName, companyId },
    });

    const data = {
      fullName:    dto.fullName,
      email:       dto.email,
      jobTitle:    dto.jobTitle,
      linkedinUrl: dto.linkedinUrl,
      seniority:   dto.seniority ?? this.inferSeniority(dto.jobTitle),
      companyId,
    };

    if (existing) {
      await this.prospectRepo.update(existing.id, data);
      return { ...existing, ...data };
    }
    return this.prospectRepo.save(data);
  }

  private inferSeniority(jobTitle?: string): string {
    if (!jobTitle) return 'Unknown';
    const t = jobTitle.toLowerCase();
    if (/ceo|cto|coo|cfo|founder/.test(t))  return 'C-Level';
    if (/\bvp\b|vice president/.test(t))     return 'VP';
    if (/director|direttore/.test(t))        return 'Director';
    if (/manager|head of/.test(t))           return 'Manager';
    return 'Individual Contributor';
  }
}