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
    
    // Somma valore totale (TypeORM restituisce decimal come stringa, convertiamo)
    const { totalValue } = await this.dealRepo
      .createQueryBuilder('deal')
      .select('SUM(deal.value)', 'totalValue')
      .getRawOne();

    const leadsCount = await this.dealRepo.count({ where: { stage: 'Lead qualificato' } });
    const wonCount = await this.dealRepo.count({ where: { stage: 'Chiuso vinto' } });
    
    const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;
    const numericTotalValue = Number(totalValue || 0);
    const avgDealValue = totalDeals > 0 ? (numericTotalValue / totalDeals) : 0;

    // 2. PIPELINE
    const rawPipeline = await this.dealRepo
      .createQueryBuilder('deal')
      .select('deal.stage', 'stage')
      .addSelect('SUM(deal.value)', 'value')
      .addSelect('COUNT(deal.id)', 'count')
      .groupBy('deal.stage')
      .getRawMany();

    const pipeline = rawPipeline.map(p => ({
      stage: p.stage,
      value: Number(p.value),
      count: Number(p.count),
    }));

    // 3. TOP DEALS
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
        totalValue: numericTotalValue,
        winRate,
        avgDealValue,
      },
      pipeline,
      topDeals,
    };
  }
}