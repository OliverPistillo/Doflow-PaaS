import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import { DashboardResponseDto, DashboardKpiDto, PipelineStageDto, TopDealDto } from './dto/dashboard-stats.dto';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto';
import { PlatformDeal } from './entities/platform-deal.entity';
import { DealStage } from './enums/deal-stage.enum';

@Injectable()
export class SuperadminDashboardService {
  constructor(
    @InjectRepository(PlatformDeal)
    private dealRepo: Repository<PlatformDeal>,
  ) {}

  // ===========================================================================
  // 1. KPI & STATISTICHE (GET /stats)
  // ===========================================================================
  async getSalesStats(filters?: GetDealsQueryDto): Promise<DashboardResponseDto> {
    // 1. Applichiamo i filtri base a una query riutilizzabile
    // Nota: I KPI "generali" di solito non filtrano per stage specifici (es. "Lead count" deve contare i lead),
    // ma devono rispettare i filtri temporali (Mese) e Cliente se presenti.
    
    // Calcoliamo i KPI specifici
    
    // A) Offerte in qualificazione (Count)
    // Filtro: Stage = QUALIFIED_LEAD + Filtri globali (Mese/Cliente)
    const leadsCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :leadStage', { leadStage: DealStage.QUALIFIED_LEAD })
      .getCount();

    // B) Valore Totale (Sum)
    // Di solito questo KPI somma TUTTO o solo quello che l'utente sta filtrando?
    // Se l'utente non filtra nulla, mostriamo il totale globale.
    const { totalValueCents } = await this.createFilteredQuery(filters)
      .select('SUM(deal.value_cents)', 'totalValueCents')
      .getRawOne();
    
    // C) Tasso di Vincita
    // Formula: Vinte / (Vinte + Perse) nel periodo selezionato
    const wonCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :wonStage', { wonStage: DealStage.CLOSED_WON })
      .getCount();
      
    const lostCount = await this.createFilteredQuery(filters)
      .andWhere('deal.stage = :lostStage', { lostStage: DealStage.CLOSED_LOST })
      .getCount();
      
    const closedTotal = wonCount + lostCount;
    const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

    // D) Media Offerta (Average Value)
    // Media su tutte le offerte trovate dai filtri attuali
    const { avgValueCents } = await this.createFilteredQuery(filters)
      .select('AVG(deal.value_cents)', 'avgValueCents')
      .getRawOne();

    // E) Chiusura prevista questo mese (Count)
    // Qui forziamo il filtro temporale al mese corrente, ignorando il filtro mese dell'utente se c'è,
    // perché questo KPI è specifico "QUESTO MESE" per definizione.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Copiamo i filtri ma rimuoviamo quelli temporali per applicare "questo mese"
    const thisMonthFilters = { ...filters, expectedCloseMonth: undefined, expectedCloseYear: undefined };
    const dealsClosingThisMonth = await this.createFilteredQuery(thisMonthFilters)
      .andWhere('deal.expectedCloseDate BETWEEN :start AND :end', { start: startOfMonth, end: endOfMonth })
      .getCount();

    // F) Pipeline Chart (Group by Stage)
    const rawPipeline = await this.createFilteredQuery(filters)
      .select('deal.stage', 'stage')
      .addSelect('SUM(deal.value_cents)', 'value')
      .addSelect('COUNT(deal.id)', 'count')
      .groupBy('deal.stage')
      .getRawMany();

    const pipeline: PipelineStageDto[] = rawPipeline.map(p => ({
      stage: p.stage,
      value: Number(p.value || 0) / 100, // Converti cents -> Euro
      count: Number(p.count || 0),
    }));

    // G) Top Deals (List limit 10)
    const topDealsEntities = await this.createFilteredQuery(filters)
      .orderBy('deal.value_cents', 'DESC')
      .take(10)
      .getMany();

    const topDeals: TopDealDto[] = topDealsEntities.map(d => ({
      name: d.title,
      client: d.clientName,
      value: d.valueCents / 100, // Euro
      stage: d.stage,
    }));

    // Costruzione DTO Finale
    const kpi: DashboardKpiDto = {
      leadsCount,
      totalValue: Number(totalValueCents || 0) / 100, // Euro
      winRate,
      avgDealValue: Number(avgValueCents || 0) / 100, // Euro
      dealsClosingThisMonth
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
        query.sortOrder || 'DESC'
      )
      .getMany();

    // Mappiamo per il frontend (Euro e %)
    return deals.map(d => ({
      id: d.id,
      name: d.title,
      clientName: d.clientName,
      value: d.valueCents / 100, // FE usa Euro float
      winProbability: d.probabilityBps / 100, // FE usa % float (50.5)
      stage: d.stage,
      expectedCloseDate: d.expectedCloseDate,
    }));
  }

  // ===========================================================================
  // 3. EDIT FORM (PATCH /deals/:id)
  // ===========================================================================
  async updateDeal(id: string, updateData: UpdateDealDto): Promise<PlatformDeal> {
    const deal = await this.dealRepo.findOne({ where: { id } });
    if (!deal) throw new NotFoundException('Offerta non trovata');

    // Mapping Update DTO -> Entity
    if (updateData.title !== undefined) deal.title = updateData.title;
    if (updateData.clientName !== undefined) deal.clientName = updateData.clientName;
    if (updateData.stage !== undefined) deal.stage = updateData.stage;
    if (updateData.expectedCloseDate !== undefined) deal.expectedCloseDate = updateData.expectedCloseDate ? new Date(updateData.expectedCloseDate) : null;
    
    // Conversioni valuta/probabilità
    if (updateData.value !== undefined) {
      deal.valueCents = Math.round(updateData.value * 100);
    }
    if (updateData.winProbability !== undefined) {
      deal.probabilityBps = Math.round(updateData.winProbability * 100);
    }

    return this.dealRepo.save(deal);
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
    
    return result.map(r => r.client);
  }

  // ===========================================================================
  // HELPER PRIVATO: QUERY BUILDER CON FILTRI
  // ===========================================================================
  private createFilteredQuery(filters: GetDealsQueryDto = {}): SelectQueryBuilder<PlatformDeal> {
    const qb = this.dealRepo.createQueryBuilder('deal');

    // 1. Filtro Stages (Array)
    if (filters.stages && filters.stages.length > 0) {
      // Gestione caso singolo vs array
      const stages = Array.isArray(filters.stages) ? filters.stages : [filters.stages];
      qb.andWhere('deal.stage IN (:...stages)', { stages });
    }

    // 2. Filtro Temporale (Mese/Anno chiusura prevista)
    if (filters.expectedCloseMonth && filters.expectedCloseYear) {
      const start = new Date(filters.expectedCloseYear, filters.expectedCloseMonth - 1, 1);
      const end = new Date(filters.expectedCloseYear, filters.expectedCloseMonth, 0); // Ultimo giorno del mese
      qb.andWhere('deal.expectedCloseDate BETWEEN :start AND :end', { start, end });
    }

    // 3. Filtro Cliente
    if (filters.clientName) {
      qb.andWhere('deal.clientName = :clientName', { clientName: filters.clientName });
    }

    // 4. Ricerca Globale (Search Bar)
    if (filters.search) {
      qb.andWhere(new Brackets(sqb => {
        sqb.where('deal.title ILIKE :search', { search: `%${filters.search}%` })
           .orWhere('deal.clientName ILIKE :search', { search: `%${filters.search}%` });
      }));
    }

    return qb;
  }
}