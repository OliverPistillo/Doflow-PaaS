import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In } from 'typeorm';
import { DashboardResponseDto } from './dto/dashboard-stats.dto';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto'; // <--- Importa i nuovi DTO
import { PlatformDeal } from './entities/platform-deal.entity';

@Injectable()
export class SuperadminDashboardService {
  constructor(
    @InjectRepository(PlatformDeal)
    private dealRepo: Repository<PlatformDeal>,
  ) {}

  // --- METODO ESISTENTE (KPI) ---
  async getSalesStats(): Promise<DashboardResponseDto> {
    // ... (Mantieni il codice che ti ho dato nel passaggio precedente per i KPI)
    // Per brevità non lo riscrivo tutto qui, ma VA LASCIATO UGUALE.
    // Se vuoi te lo riposto completo, dimmelo.
    
    // ... (Logica calcolo KPI) ...
    
    // Placeholder per non rompere la compilazione se copi-incolli:
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const leadsCount = await this.dealRepo.count({ where: { stage: 'Lead qualificato' } });
    const wonCount = await this.dealRepo.count({ where: { stage: 'Chiuso vinto' } });
    const totalDeals = await this.dealRepo.count();
    const dealsClosingThisMonth = await this.dealRepo.count({ where: { expectedCloseDate: Between(firstDay, lastDay) } });
    const { totalValue } = await this.dealRepo.createQueryBuilder('deal').select('SUM(deal.value)', 'totalValue').getRawOne();
    
    // ... eccetera (usa il codice del passo precedente per il return)
    return {
        kpi: { 
            leadsCount, 
            totalValue: Number(totalValue || 0), 
            winRate: totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0, 
            avgDealValue: 0, // Calcola come prima
            dealsClosingThisMonth 
        },
        pipeline: [], // Usa query precedente
        topDeals: []  // Usa query precedente
    };
  }

  // --- NUOVI METODI PER DRILL-DOWN ---

  // 1. Lista filtrata per il Drill-down
  async findAllDeals(query: GetDealsQueryDto): Promise<PlatformDeal[]> {
    const qb = this.dealRepo.createQueryBuilder('deal');

    // Filtro per Fase (Multi-select)
    if (query.stages && query.stages.length > 0) {
      // Se arriva una stringa singola invece di array (capita con i query params), la gestiamo
      const stages = Array.isArray(query.stages) ? query.stages : [query.stages];
      qb.andWhere('deal.stage IN (:...stages)', { stages });
    }

    // Filtro per Mese di chiusura (es. "2024-08")
    if (query.month) {
      const [year, month] = query.month.split('-');
      // Costruiamo range inizio-fine mese
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      qb.andWhere('deal.expectedCloseDate BETWEEN :start AND :end', { start: startDate, end: endDate });
    }

    // Filtro per Cliente (Ricerca parziale)
    if (query.clientName) {
      qb.andWhere('deal.clientName ILIKE :clientName', { clientName: `%${query.clientName}%` });
    }

    // Ricerca Libera (Search bar globale)
    if (query.search) {
      qb.andWhere('(deal.name ILIKE :search OR deal.clientName ILIKE :search)', { search: `%${query.search}%` });
    }

    // Ordinamento
    if (query.sortBy) {
        const order = query.sortOrder || 'DESC';
        // Protezione semplice contro SQL injection nei nomi colonna
        if (['value', 'expectedCloseDate', 'created_at', 'winProbability'].includes(query.sortBy)) {
            qb.orderBy(`deal.${query.sortBy}`, order);
        }
    } else {
        qb.orderBy('deal.value', 'DESC'); // Default: i più ricchi prima
    }

    return qb.getMany();
  }

  // 2. Aggiornamento (Edit Form)
  async updateDeal(id: string, updateData: UpdateDealDto): Promise<PlatformDeal> {
    const deal = await this.dealRepo.findOne({ where: { id } });
    if (!deal) throw new NotFoundException('Offerta non trovata');

    // Merge dei dati
    Object.assign(deal, updateData);
    
    return this.dealRepo.save(deal);
  }

  // 3. Lista Clienti unici (per il filtro dropdown)
  async getUniqueClients(): Promise<string[]> {
    const result = await this.dealRepo
      .createQueryBuilder('deal')
      .select('DISTINCT deal.clientName', 'client')
      .orderBy('deal.clientName', 'ASC')
      .getRawMany();
    
    return result.map(r => r.client);
  }
}