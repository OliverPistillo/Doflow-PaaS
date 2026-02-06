import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardResponseDto } from './dto/dashboard-stats.dto';
import { PlatformDeal } from './entities/platform-deal.entity';

@Injectable()
export class SuperadminDashboardService {
  private readonly logger = new Logger(SuperadminDashboardService.name);

  constructor(
    @InjectRepository(PlatformDeal)
    private dealRepo: Repository<PlatformDeal>,
  ) {}

  async getSalesStats(): Promise<DashboardResponseDto> {
    try {
      this.logger.log('Inizio calcolo statistiche dashboard...');

      // 1. KPI: Totali generali
      const totalDeals = await this.dealRepo.count();
      this.logger.log(`Totale deals trovati: ${totalDeals}`);
      
      const sumResult = await this.dealRepo
        .createQueryBuilder('deal')
        .select('SUM(deal.value)', 'totalValue')
        .getRawOne();
      
      const totalValue = sumResult && sumResult.totalValue ? Number(sumResult.totalValue) : 0;

      const leadsCount = await this.dealRepo.count({ where: { stage: 'Lead qualificato' } });
      const wonCount = await this.dealRepo.count({ where: { stage: 'Chiuso vinto' } });
      
      const winRate = totalDeals > 0 ? Math.round((wonCount / totalDeals) * 100) : 0;
      const avgDealValue = totalDeals > 0 ? (totalValue / totalDeals) : 0;

      // 2. PIPELINE
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

      this.logger.log('Statistiche calcolate con successo');

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
    } catch (error: any) {
      this.logger.error(`ERRORE CRITICO DASHBOARD: ${error.message}`, error.stack);
      // Rilanciamo l'errore per vederlo come 500 nel frontend, ma ora lo leggiamo nei log
      throw error;
    }
  }
}