import { Injectable } from '@nestjs/common';
import { DashboardResponseDto } from './dto/dashboard-stats.dto';

@Injectable()
export class SuperadminDashboardService {
  
  // Qui in futuro inietterai il Repository delle Offerte/Deals
  // constructor(@InjectRepository(Deal) private dealRepo: Repository<Deal>) {}

  async getSalesStats(): Promise<DashboardResponseDto> {
    // TODO: Sostituire questi dati mock con query reali al DB
    // Esempio: const deals = await this.dealRepo.find();
    
    return {
      kpi: {
        leadsCount: 14, // Esempio: await this.dealRepo.count({ where: { stage: 'lead' } })
        totalValue: 85000,
        winRate: 68,
        avgDealValue: 3200,
      },
      pipeline: [
        { stage: 'Lead qualificato', value: 45000, count: 20 },
        { stage: 'Preventivo inviato', value: 68000, count: 15 },
        { stage: 'Negoziazione', value: 42000, count: 8 },
        { stage: 'Chiuso vinto', value: 28000, count: 5 },
      ],
      topDeals: [
        { name: "SaaS Enterprise Lic", client: "Acme Corp", value: 25000, stage: "Negoziazione" },
        { name: "Consulenza Annuale", client: "Global Tech", value: 15000, stage: "Preventivo" },
        { name: "Sviluppo Custom", client: "StartUp Inc", value: 12000, stage: "Lead" },
        { name: "Integrazione API", client: "Logistic Srl", value: 8000, stage: "Chiuso vinto" },
        { name: "Audit Sicurezza", client: "Finance Bank", value: 5000, stage: "Preventivo" },
      ]
    };
  }
}