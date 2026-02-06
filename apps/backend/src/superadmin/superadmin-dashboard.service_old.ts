import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardResponseDto } from './dto/dashboard-stats.dto';
import { PlatformDeal } from './entities/platform-deal.entity';

@Injectable()
export class SuperadminDashboardService {
  constructor(
    @InjectRepository(PlatformDeal)
    private dealRepo: Repository<PlatformDeal>,
  ) {}

  async getSalesStats(): Promise<DashboardResponseDto> {
    // 1. KPI: Totali generali
    const totalDeals = await this.dealRepo.count();
    
    // Somma valore totale (Gestione sicura se null)
    const sumResult = await this.dealRepo
      .createQueryBuilder('deal')
      .select('SUM(deal.value)', 'totalValue')
      .getRawOne();
    
    const totalValue = sumResult && sumResult.totalValue ? Number(sumResult.totalValue) : 0;

    const leadsCount = await this.dealRepo.count({ where: { stage: 'Lead qualificato' } });
    const wonCount = await this.dealRepo.count({ where: { stage: 'Chiuso vinto' } });
    
    const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;
    const avgDealValue = totalDeals > 0 ? (totalValue / totalDeals) : 0;

    // 2. PIPELINE: Raggruppamento per fase
    const rawPipeline = await this.dealRepo
      .createQueryBuilder('deal')
      .select('deal.stage', 'stage')
      .addSelect('SUM(deal.value)', 'value')
      .addSelect('COUNT(deal.id)', 'count')
      .groupBy('deal.stage')
      .getRawMany();

    const pipeline = rawPipeline.map(p => ({
      stage: p.stage || 'Sconosciuto',
      value: p.value ? Number(p.value) : 0,
      count: p.count ? Number(p.count) : 0,
    }));

    // 3. TOP DEALS: I primi 10 per valore
    const topDealsEntities = await this.dealRepo.find({
      order: { value: 'DESC' },
      take: 10,
    });

    const topDeals = topDealsEntities.map(d => ({
      name: d.name,
      client: d.clientName,
      value: Number(d.value),
      stage: d.stage,
    }));

    return {
      kpi: {
        leadsCount,
        totalValue,
        winRate,
        avgDealValue,
      },
      pipeline,
      topDeals,
    };
  }
}