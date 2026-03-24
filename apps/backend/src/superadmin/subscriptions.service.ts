import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { Tenant } from './entities/tenant.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { PlatformModule } from './entities/platform-module.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(TenantSubscription)
    private subRepo: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(PlatformModule)
    private moduleRepo: Repository<PlatformModule>,
    private dataSource: DataSource,
  ) {}

  // ─── Revenue Dashboard ──────────────────────────────────────

  async getRevenueDashboard() {
    const tenants = await this.tenantRepo.find();
    const activeTenants = tenants.filter(t => t.isActive);
    const subs = await this.subRepo.find({ relations: ['module'] });
    const modules = await this.moduleRepo.find();
    const invoices = await this.invoiceRepo.find();

    // Prezzi base per tier
    const TIER_PRICES: Record<string, number> = {
      STARTER: 49,
      PRO: 99,
      ENTERPRISE: 299,
    };

    // MRR da piani base
    let baseMrr = 0;
    const tierBreakdown: Record<string, { count: number; revenue: number }> = {};
    for (const t of activeTenants) {
      const tier = (t.planTier || 'STARTER').toUpperCase();
      const price = TIER_PRICES[tier] || 0;
      baseMrr += price;
      if (!tierBreakdown[tier]) tierBreakdown[tier] = { count: 0, revenue: 0 };
      tierBreakdown[tier].count++;
      tierBreakdown[tier].revenue += price;
    }

    // MRR da moduli aggiuntivi
    let moduleMrr = 0;
    const activeSubs = subs.filter(s => s.status === 'ACTIVE');
    for (const s of activeSubs) {
      if (s.module) {
        moduleMrr += Number(s.module.priceMonthly) || 0;
      }
    }

    const totalMrr = baseMrr + moduleMrr;
    const arr = totalMrr * 12;

    // Churn
    const totalTenants = tenants.length;
    const inactiveCount = tenants.filter(t => !t.isActive).length;
    const churnRate = totalTenants > 0 ? (inactiveCount / totalTenants) * 100 : 0;

    // Revenue totale incassata
    const paidInvoices = invoices.filter(i => i.status === InvoiceStatus.PAID);
    const totalRevenue = paidInvoices.reduce((acc, inv) => acc + Number(inv.amount), 0);

    // Prossime scadenze (trial / expiring)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringTrials = subs.filter(
      s => s.status === 'TRIAL' && s.trialEndsAt && new Date(s.trialEndsAt) <= thirtyDaysFromNow,
    );

    // Top moduli per adozione
    const moduleAdoption: Record<string, number> = {};
    for (const s of activeSubs) {
      moduleAdoption[s.moduleKey] = (moduleAdoption[s.moduleKey] || 0) + 1;
    }
    const topModules = Object.entries(moduleAdoption)
      .map(([key, count]) => {
        const mod = modules.find(m => m.key === key);
        return { key, name: mod?.name || key, count, revenue: count * (Number(mod?.priceMonthly) || 0) };
      })
      .sort((a, b) => b.count - a.count);

    // Revenue trend (ultimi 6 mesi da fatture)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentInvoices = paidInvoices.filter(i => new Date(i.createdAt) >= sixMonthsAgo);

    const monthlyRevenue: Record<string, number> = {};
    for (const inv of recentInvoices) {
      const monthKey = new Date(inv.createdAt).toISOString().slice(0, 7); // "2026-01"
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + Number(inv.amount);
    }

    const revenueTrend = Object.entries(monthlyRevenue)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      mrr: totalMrr,
      baseMrr,
      moduleMrr,
      arr,
      totalRevenue,
      churnRate: Math.round(churnRate * 10) / 10,
      activeTenants: activeTenants.length,
      totalTenants,
      tierBreakdown,
      topModules,
      expiringTrials: expiringTrials.length,
      revenueTrend,
    };
  }

  // ─── Lista subscriptions con dettaglio ──────────────────────

  async findAll() {
    return this.subRepo.find({
      relations: ['tenant', 'module'],
      order: { assignedAt: 'DESC' },
    });
  }

  async findByTenant(tenantId: string) {
    return this.subRepo.find({
      where: { tenantId },
      relations: ['module'],
      order: { assignedAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED') {
    await this.subRepo.update(id, { status });
    return this.subRepo.findOne({ where: { id }, relations: ['module', 'tenant'] });
  }
}
