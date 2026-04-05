// apps/backend/src/superadmin/superadmin-dashboard.service.ts
// MODIFICATO: aggiunto metodo getActivityFeed() e relative iniezioni di
// repository (Tenant, SupportTicket, Invoice) nel costruttore.
// Tutto il resto (getSalesStats, findAllDeals, updateDeal, ecc.) è invariato.

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }               from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import { EventEmitter2 }                  from '@nestjs/event-emitter';

import {
  DashboardResponseDto,
  DashboardKpiDto,
  PipelineStageDto,
  TopDealDto,
} from './dto/dashboard-stats.dto';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto';
import { PlatformDeal }       from './entities/platform-deal.entity';
import { DealStage }          from './enums/deal-stage.enum';
import { TriggerEvent }       from './entities/automation-rule.entity';
import { Tenant }             from './entities/tenant.entity';
import { SupportTicket, TicketStatus } from './entities/support-ticket.entity';
import { Invoice, InvoiceStatus }       from './entities/invoice.entity';

// ── Tipo condiviso con il frontend (Control Room activity feed) ──────────────

export type ActivityItemType = 'tenant' | 'payment' | 'ticket' | 'deal' | 'system';

export interface ActivityFeedItem {
  id:        string;
  type:      ActivityItemType;
  title:     string;
  subtitle:  string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SuperadminDashboardService {
  constructor(
    @InjectRepository(PlatformDeal)
    private dealRepo: Repository<PlatformDeal>,

    // NUOVO: iniettati per getActivityFeed()
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,

    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===========================================================================
  // 1. KPI & STATISTICHE (GET /stats)
  // ===========================================================================

  async getSalesStats(filters?: GetDealsQueryDto): Promise<DashboardResponseDto> {
    // A) Offerte in qualificazione
    const leadsCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :leadStage', { leadStage: DealStage.QUALIFIED_LEAD })
      .getCount();

    // B) Valore totale pipeline
    const { totalValueCents } = await this.createFilteredQuery(filters)
      .select('SUM(deal.value_cents)', 'totalValueCents')
      .getRawOne();

    // C) Win rate
    const wonCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :wonStage', { wonStage: DealStage.CLOSED_WON })
      .getCount();
    const lostCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :lostStage', { lostStage: DealStage.CLOSED_LOST })
      .getCount();
    const closedTotal = wonCount + lostCount;
    const winRate     = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

    // D) Media per deal
    const { avgValueCents } = await this.createFilteredQuery(filters)
      .select('AVG(deal.value_cents)', 'avgValueCents')
      .getRawOne();

    // E) Deals in chiusura questo mese
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisMonthFilters = {
      ...filters,
      expectedCloseMonth: undefined,
      expectedCloseYear:  undefined,
    };
    const dealsClosingThisMonth = await this.createFilteredQuery(thisMonthFilters)
      .andWhere('deal.expectedCloseDate BETWEEN :start AND :end', {
        start: startOfMonth,
        end:   endOfMonth,
      })
      .getCount();

    // F) Pipeline chart (group by stage)
    const rawPipeline = await this.createFilteredQuery(filters)
      .select('deal.stage',              'stage')
      .addSelect('SUM(deal.value_cents)', 'value')
      .addSelect('COUNT(deal.id)',        'count')
      .groupBy('deal.stage')
      .getRawMany();

    const pipeline: PipelineStageDto[] = rawPipeline.map((p) => ({
      stage: p.stage,
      value: Number(p.value || 0) / 100,
      count: Number(p.count || 0),
    }));

    // G) Top 10 deals per valore
    const topDealsEntities = await this.createFilteredQuery(filters)
      .orderBy('deal.value_cents', 'DESC')
      .take(10)
      .getMany();

    const topDeals: TopDealDto[] = topDealsEntities.map((d) => ({
      name:   d.title,
      client: d.clientName,
      value:  d.valueCents / 100,
      stage:  d.stage,
    }));

    const kpi: DashboardKpiDto = {
      leadsCount,
      totalValue:           Number(totalValueCents || 0) / 100,
      winRate,
      avgDealValue:         Number(avgValueCents   || 0) / 100,
      dealsClosingThisMonth,
    };

    return { kpi, pipeline, topDeals };
  }

  // ===========================================================================
  // 2. LISTA DRILL-DOWN (GET /deals)
  // ===========================================================================

  async findAllDeals(query: GetDealsQueryDto): Promise<any[]> {
    const deals = await this.createFilteredQuery(query)
      .orderBy(
        query.sortBy ? `deal.${query.sortBy}` : 'deal.value_cents',
        query.sortOrder || 'DESC',
      )
      .getMany();

    return deals.map((d) => ({
      id:                 d.id,
      name:               d.title,
      clientName:         d.clientName,
      value:              d.valueCents / 100,
      winProbability:     d.probabilityBps / 100,
      stage:              d.stage,
      expectedCloseDate:  d.expectedCloseDate,
    }));
  }

  // ===========================================================================
  // 3. EDIT DEAL (PATCH /deals/:id)
  // ===========================================================================

  async updateDeal(id: string, updateData: UpdateDealDto): Promise<PlatformDeal> {
    const deal = await this.dealRepo.findOne({ where: { id } });
    if (!deal) throw new NotFoundException('Offerta non trovata');

    const oldStage = deal.stage;

    if (updateData.title             !== undefined) deal.title            = updateData.title;
    if (updateData.clientName        !== undefined) deal.clientName       = updateData.clientName;
    if (updateData.stage             !== undefined) deal.stage            = updateData.stage;
    if (updateData.expectedCloseDate !== undefined) {
      deal.expectedCloseDate = updateData.expectedCloseDate
        ? new Date(updateData.expectedCloseDate)
        : null;
    }
    if (updateData.value             !== undefined) deal.valueCents       = Math.round(updateData.value * 100);
    if (updateData.winProbability    !== undefined) deal.probabilityBps   = Math.round(updateData.winProbability * 100);

    const saved = await this.dealRepo.save(deal);

    if (updateData.stage !== undefined && updateData.stage !== oldStage) {
      this.eventEmitter.emit('automation.trigger', {
        event:   TriggerEvent.DEAL_STAGE_CHANGE,
        context: {
          dealId:     saved.id,
          title:      saved.title,
          clientName: saved.clientName,
          fromStage:  oldStage,
          toStage:    saved.stage,
          valueCents: saved.valueCents,
        },
      });
    }

    return saved;
  }

  // ===========================================================================
  // 4. FILTRI: LISTA CLIENTI (GET /filters/clients)
  // ===========================================================================

  async getUniqueClients(): Promise<string[]> {
    const result = await this.dealRepo
      .createQueryBuilder('deal')
      .select('DISTINCT deal.clientName', 'client')
      .where('deal.clientName IS NOT NULL')
      .orderBy('deal.clientName', 'ASC')
      .getRawMany();

    return result.map((r) => r.client);
  }

  // ===========================================================================
  // 5. CREA DEAL (POST /deals)
  // ===========================================================================

  async createDeal(data: UpdateDealDto): Promise<PlatformDeal> {
    const deal = this.dealRepo.create({
      title:             data.title,
      clientName:        data.clientName,
      stage:             data.stage            || DealStage.QUALIFIED_LEAD,
      valueCents:        data.value            ? Math.round(data.value * 100)         : 0,
      probabilityBps:    data.winProbability   ? Math.round(data.winProbability * 100) : 0,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate)    : null,
    });
    return this.dealRepo.save(deal);
  }

  // ===========================================================================
  // 6. ELIMINA DEAL (DELETE /deals/:id)
  // ===========================================================================

  async deleteDeal(id: string): Promise<void> {
    const result = await this.dealRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Offerta non trovata');
    }
  }

  // ===========================================================================
  // 7. ACTIVITY FEED (GET /activity-feed)  ← NUOVO
  // ===========================================================================
  // Aggrega gli ultimi eventi da 4 sorgenti (deal, tenant, ticket, fatture)
  // in un unico stream ordinato per timestamp decrescente.
  // Nessuna query pesante: ogni sorgente porta max (limit) record, poi si
  // merge e si taglia al limite richiesto.

  async getActivityFeed(limit = 20): Promise<{ items: ActivityFeedItem[] }> {
    const perSource = Math.max(limit, 10); // almeno 10 per sorgente

    // ── Deals recentemente modificati ───────────────────────────────────────
    const deals = await this.dealRepo.find({
      order: { updatedAt: 'DESC' },
      take:  perSource,
    });

    const dealItems: ActivityFeedItem[] = deals.map((d) => ({
      id:        `deal-${d.id}`,
      type:      'deal' as const,
      title:     d.title || 'Offerta senza titolo',
      subtitle:  `${this.stageLabelIt(d.stage)} — ${d.clientName || 'Cliente sconosciuto'}`,
      timestamp: d.updatedAt,
    }));

    // ── Tenant creati di recente ─────────────────────────────────────────────
    const tenants = await this.tenantRepo.find({
      order: { createdAt: 'DESC' },
      take:  perSource,
    });

    const tenantItems: ActivityFeedItem[] = tenants.map((t) => ({
      id:        `tenant-${t.id}`,
      type:      'tenant' as const,
      title:     `Nuovo tenant: ${t.name || t.schemaName || t.id}`,
      subtitle:  `Piano ${(t.planTier || 'STARTER').toUpperCase()} — ${t.contactEmail || ''}`,
      timestamp: t.createdAt,
    }));

    // ── Ticket aperti di recente ─────────────────────────────────────────────
    const tickets = await this.ticketRepo.find({
      order: { createdAt: 'DESC' },
      take:  perSource,
    });

    const ticketItems: ActivityFeedItem[] = tickets.map((tk) => ({
      id:        `ticket-${tk.id}`,
      type:      'ticket' as const,
      title:     tk.subject || 'Ticket senza oggetto',
      subtitle:  `${this.ticketStatusLabelIt(tk.status)} — ${tk.tenantName || tk.tenantId}`,
      timestamp: tk.createdAt,
    }));

    // ── Fatture emesse di recente ────────────────────────────────────────────
    const invoices = await this.invoiceRepo.find({
      order: { createdAt: 'DESC' },
      take:  perSource,
    });

    const invoiceItems: ActivityFeedItem[] = invoices.map((inv) => ({
      id:        `invoice-${inv.id}`,
      type:      'payment' as const,
      title:     `Fattura ${inv.invoiceNumber || inv.id} — ${inv.clientName}`,
      subtitle:  `€ ${Number(inv.amount).toFixed(2)} — ${this.invoiceStatusLabelIt(inv.status)}`,
      timestamp: inv.createdAt,
    }));

    // ── Merge, sort, slice ───────────────────────────────────────────────────
    const all = [
      ...dealItems,
      ...tenantItems,
      ...ticketItems,
      ...invoiceItems,
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return { items: all.slice(0, limit) };
  }

  // ── Label helpers (italianizzazione degli enum) ───────────────────────────

  private stageLabelIt(stage: DealStage): string {
    // DealStage enum values sono già stringhe italiane (es. 'Lead qualificato').
    // Usiamo la mappa solo per normalizzare, con fallback al valore grezzo.
    const map: Record<string, string> = {
      [DealStage.QUALIFIED_LEAD]: 'Lead qualificato',
      [DealStage.QUOTE_SENT]:     'Preventivo inviato',
      [DealStage.NEGOTIATION]:    'In negoziazione',
      [DealStage.CLOSED_WON]:     'Chiuso — vinto',
      [DealStage.CLOSED_LOST]:    'Chiuso — perso',
    };
    return map[stage] ?? stage;
  }

  private ticketStatusLabelIt(status: TicketStatus): string {
    const map: Record<string, string> = {
      [TicketStatus.OPEN]:        'Aperto',
      [TicketStatus.IN_PROGRESS]: 'In lavorazione',
      [TicketStatus.RESOLVED]:    'Risolto',
      [TicketStatus.CLOSED]:      'Chiuso',
    };
    return map[status] ?? status;
  }

  private invoiceStatusLabelIt(status: InvoiceStatus): string {
    // InvoiceStatus: PAID='paid', PENDING='pending', OVERDUE='overdue'
    const map: Record<string, string> = {
      [InvoiceStatus.PAID]:    'Pagata',
      [InvoiceStatus.PENDING]: 'In attesa',
      [InvoiceStatus.OVERDUE]: 'Scaduta',
    };
    return map[status] ?? status;
  }

  // ===========================================================================
  // HELPER PRIVATO: QUERY BUILDER CON FILTRI
  // ===========================================================================

  private createFilteredQuery(
    filters: GetDealsQueryDto = {},
  ): SelectQueryBuilder<PlatformDeal> {
    const qb = this.dealRepo.createQueryBuilder('deal');

    // Filtro stages (array o singolo valore)
    if (filters.stages && filters.stages.length > 0) {
      const stages = Array.isArray(filters.stages)
        ? filters.stages
        : [filters.stages];
      qb.andWhere('deal.stage IN (:...stages)', { stages });
    }

    // Filtro mese/anno chiusura prevista
    if (filters.expectedCloseMonth && filters.expectedCloseYear) {
      const start = new Date(
        filters.expectedCloseYear,
        filters.expectedCloseMonth - 1,
        1,
      );
      const end = new Date(
        filters.expectedCloseYear,
        filters.expectedCloseMonth,
        0,
      );
      qb.andWhere('deal.expectedCloseDate BETWEEN :start AND :end', {
        start,
        end,
      });
    }

    // Filtro cliente esatto
    if (filters.clientName) {
      qb.andWhere('deal.clientName = :clientName', {
        clientName: filters.clientName,
      });
    }

    // Ricerca full-text (titolo + cliente)
    if (filters.search) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('deal.title ILIKE :search',      { search: `%${filters.search}%` })
            .orWhere('deal.clientName ILIKE :search', { search: `%${filters.search}%` });
        }),
      );
    }

    return qb;
  }
}
