import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  async getDashboardMetrics() {
    const tenants = await this.tenantRepo.find({ where: { isActive: true } });
    
    let mrr = 0;
    const tierCounts = { STARTER: 0, PRO: 0, ENTERPRISE: 0, CUSTOM: 0 };
    
    for (const t of tenants) {
      const tier = (t.planTier || 'STARTER').toUpperCase();
      if (tier === 'STARTER') { mrr += 49; tierCounts.STARTER++; }
      else if (tier === 'PRO') { mrr += 99; tierCounts.PRO++; }
      else if (tier === 'ENTERPRISE') { mrr += 299; tierCounts.ENTERPRISE++; }
      else { tierCounts.CUSTOM++; }
    }

    const arr = mrr * 12;

    // Simulate churn rate based on inactive tenants
    const totalTenants = await this.tenantRepo.count();
    const inactiveTenants = totalTenants - tenants.length;
    const churnRate = totalTenants > 0 ? ((inactiveTenants / totalTenants) * 100).toFixed(1) : '0.0';

    // Revenue da Invoices
    const paidInvoices = await this.invoiceRepo.find({ where: { status: InvoiceStatus.PAID } });
    const totalRevenue = paidInvoices.reduce((acc, inv) => acc + Number(inv.amount), 0);

    return {
      mrr,
      arr,
      activeTenants: tenants.length,
      churnRate: Number(churnRate),
      totalRevenue,
      tierDistribution: [
        { name: 'Starter', value: tierCounts.STARTER, fill: 'hsl(var(--chart-1))' },
        { name: 'Pro', value: tierCounts.PRO, fill: 'hsl(var(--chart-2))' },
        { name: 'Enterprise', value: tierCounts.ENTERPRISE, fill: 'hsl(var(--chart-3))' },
      ].filter(t => t.value > 0),
    };
  }
}
