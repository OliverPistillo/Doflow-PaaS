import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { ChangelogEntry } from '../superadmin/entities/changelog-entry.entity';
import { PlatformNotification } from '../superadmin/entities/platform-notification.entity';
import { SupportTicket, TicketStatus, TicketPriority, TicketCategory } from '../superadmin/entities/support-ticket.entity';

@Controller('tenant/self-service')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class TenantSelfServiceController {
  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
    @InjectRepository(PlatformModule) private moduleRepo: Repository<PlatformModule>,
    @InjectRepository(ChangelogEntry) private changelogRepo: Repository<ChangelogEntry>,
    @InjectRepository(PlatformNotification) private notifRepo: Repository<PlatformNotification>,
    @InjectRepository(SupportTicket) private ticketRepo: Repository<SupportTicket>,
  ) {}

  private getTenantId(req: Request): string {
    const user = (req as any).user;
    const jwtTenant = user?.tenantId || user?.tenant_id;
    const routedTenant = (req as any).tenantId;

    // Per il portale self-service il tenant autenticato è la fonte autorevole.
    // Su app.doflow.it/localhost il middleware risolve spesso `public`; se lo
    // preferiamo al JWT, un nuovo owner appena registrato non vede il wizard.
    if (jwtTenant && jwtTenant !== 'public') return jwtTenant;
    return routedTenant || jwtTenant || 'public';
  }

  private async findTenant(tenantIdentifier: string) {
    // tenantIdentifier might be the UUID, slug, or schema_name
    return this.tenantRepo
      .createQueryBuilder('t')
      .where('t.id::text = :id OR t.slug = :id OR t.schemaName = :id', { id: tenantIdentifier })
      .getOne();
  }


  private isSubscriptionActive(sub: TenantSubscription): boolean {
    if (!['ACTIVE', 'TRIAL'].includes(sub.status)) return false;

    const now = Date.now();
    if (sub.expiresAt && new Date(sub.expiresAt).getTime() <= now) return false;
    if (sub.status === 'TRIAL' && sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() <= now) return false;

    return true;
  }

  /** Info piano del tenant corrente */
  @Get('plan')
  async getMyPlan(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const tenant = await this.findTenant(tenantId);
    if (!tenant) return { error: 'Tenant non trovato' };

    const TIER_PRICES: Record<string, number> = { STARTER: 0, PRO: 99, ENTERPRISE: 299 };
    const tier = (tenant.planTier || 'STARTER').toUpperCase();

    return {
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planTier: tier,
      monthlyPrice: TIER_PRICES[tier] || 0,
      maxUsers: tenant.maxUsers,
      storageUsedMb: Number(tenant.storageUsedMb) || 0,
      storageLimitGb: Number(tenant.storageLimitGb) || 0,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    };
  }

  /** Moduli attivi per il tenant corrente */
  @Get('modules')
  async getMyModules(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const tenant = await this.findTenant(tenantId);
    const realTenantId = tenant?.id || tenantId;
    const subs = await this.subRepo.find({ where: { tenantId: realTenantId }, relations: ['module'] });
    const allModules = await this.moduleRepo.find({ order: { category: 'ASC', name: 'ASC' } });

    return {
      active: subs.filter(s => this.isSubscriptionActive(s)).map(s => ({
        key: s.moduleKey,
        name: s.module?.name || s.moduleKey,
        category: s.module?.category,
        status: s.status,
        assignedAt: s.assignedAt,
        trialEndsAt: s.trialEndsAt,
      })),
      available: allModules.map(m => ({
        key: m.key,
        name: m.name,
        description: m.description,
        category: m.category,
        minTier: m.minTier,
        priceMonthly: m.priceMonthly,
        isBeta: m.isBeta,
        isActive: subs.some(s => s.moduleKey === m.key && this.isSubscriptionActive(s)),
      })),
    };
  }

  /** Changelog pubblico (release notes) */
  @Get('changelog')
  async getChangelog() {
    return this.changelogRepo.find({
      where: { isPublished: true },
      order: { publishedAt: 'DESC' },
      take: 20,
    });
  }

  /** Notifiche per il tenant corrente */
  @Get('notifications')
  async getMyNotifications(@Req() req: Request) {
    const tenantIdentifier = this.getTenantId(req);
    const tenant = await this.findTenant(tenantIdentifier);
    const tenantId = tenant?.id || tenantIdentifier;
    const all = await this.notifRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
    return all.filter(n => !n.targetTenantId || n.targetTenantId === tenantId);
  }

  /** Segna notifica come letta */
  @Patch('notifications/:id/read')
  async markNotifRead(@Param('id') id: string) {
    await this.notifRepo.update(id, { isRead: true, readAt: new Date() });
    return { message: 'Notifica segnata come letta.' };
  }

  /** Salva onboarding wizard scelte: settore + moduli scelti dall'utente */
  @Post('onboarding/complete')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async completeOnboarding(
    @Req() req: Request,
    @Body() body: { sector?: string; selectedModules?: string[] },
  ) {
    const tenantIdentifier = this.getTenantId(req);
    const tenant = await this.findTenant(tenantIdentifier);
    if (!tenant) return { error: 'Tenant non trovato' };
    const tenantId = tenant.id;

    const planTier = (tenant.planTier || 'STARTER').toUpperCase();
    const tierRank: Record<string, number> = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };
    const userTierRank = tierRank[planTier] ?? 0;

    // Sync subscriptions: enable selected modules user can access, disable others
    const allModules = await this.moduleRepo.find();
    const selected = new Set(body.selectedModules || []);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    for (const mod of allModules) {
      const allowed = (tierRank[mod.minTier] ?? 0) <= userTierRank;
      const wantActive = allowed && selected.has(mod.key);
      const existing = await this.subRepo.findOne({ where: { tenantId, moduleKey: mod.key } });

      if (wantActive) {
        if (!existing) {
          await this.subRepo.save(this.subRepo.create({
            tenantId, moduleKey: mod.key,
            status: mod.priceMonthly > 0 ? 'TRIAL' : 'ACTIVE',
            trialEndsAt: mod.priceMonthly > 0 ? trialEndsAt : null as any,
          }));
        } else if (existing.status === 'CANCELLED' || existing.status === 'EXPIRED') {
          await this.subRepo.update(existing.id, { status: 'ACTIVE' });
        }
      } else if (existing && (existing.status === 'ACTIVE' || existing.status === 'TRIAL')) {
        await this.subRepo.update(existing.id, { status: 'CANCELLED' });
      }
    }

    // Persist onboarding state (raw query — table created in seed bootstrap)
    await this.subRepo.manager.query(
      `INSERT INTO public.tenant_onboarding (tenant_id, sector, completed_at, selected_modules)
       VALUES ($1, $2, NOW(), $3::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE
         SET sector = EXCLUDED.sector,
             completed_at = EXCLUDED.completed_at,
             selected_modules = EXCLUDED.selected_modules,
             updated_at = NOW()`,
      [tenantId, body.sector || 'generic', JSON.stringify(Array.from(selected))],
    );

    return {
      success: true,
      sector: body.sector,
      modulesActive: Array.from(selected).filter(k => {
        const m = allModules.find(am => am.key === k);
        return m && (tierRank[m.minTier] ?? 0) <= userTierRank;
      }),
    };
  }

  /** Stato onboarding (per redirect lato frontend) */
  @Get('onboarding/status')
  async getOnboardingStatus(@Req() req: Request) {
    const tenantIdentifier = this.getTenantId(req);
    const tenant = await this.findTenant(tenantIdentifier);
    if (!tenant) return { completed: false };
    const rows = await this.subRepo.manager.query(
      `SELECT sector, completed_at, selected_modules FROM public.tenant_onboarding WHERE tenant_id = $1 LIMIT 1`,
      [tenant.id],
    );
    if (rows.length === 0) return { completed: false };
    return {
      completed: !!rows[0].completed_at,
      sector: rows[0].sector,
      selectedModules: rows[0].selected_modules || [],
      completedAt: rows[0].completed_at,
    };
  }

  // ─── SUPPORTO TICKET ───────────────────────────────────────

  /** Lista ticket del tenant corrente */
  @Get('tickets')
  async getMyTickets(@Req() req: Request) {
    const tenantIdentifier = this.getTenantId(req);
    const tenant = await this.findTenant(tenantIdentifier);
    const tenantId = tenant?.id || tenantIdentifier;
    return this.ticketRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Crea un nuovo ticket dal portale tenant */
  @Post('tickets')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async createTicket(
    @Req() req: Request,
    @Body() body: { subject: string; description: string; category?: string; priority?: string },
  ) {
    const tenantId = this.getTenantId(req);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const user = (req as any).user;
    const email = user?.email || 'unknown';

    const count = await this.ticketRepo.count();
    const ticketCode = `TK-${String(count + 1).padStart(4, '0')}`;

    const priority = (body.priority as TicketPriority) || TicketPriority.MEDIUM;
    const defaultSla: Record<string, number> = { CRITICAL: 4, HIGH: 8, MEDIUM: 24, LOW: 72 };

    const ticket = this.ticketRepo.create({
      ticketCode,
      subject: body.subject,
      description: body.description,
      category: (body.category as TicketCategory) || TicketCategory.GENERAL,
      priority,
      status: TicketStatus.OPEN,
      tenantId,
      tenantName: tenant?.name || tenantId,
      reporterEmail: email,
      slaHours: defaultSla[priority] || 24,
      replies: [],
    });

    return this.ticketRepo.save(ticket);
  }

  /** Aggiungi risposta a un ticket */
  @Post('tickets/:id/reply')
  async replyToTicket(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const tenantId = this.getTenantId(req);
    const user = (req as any).user;
    const ticket = await this.ticketRepo.findOne({ where: { id, tenantId } });
    if (!ticket) return { error: 'Ticket non trovato.' };

    const reply = {
      author: user?.email || 'tenant',
      message: body.message,
      timestamp: new Date().toISOString(),
      isInternal: false,
    };
    ticket.replies = [...(ticket.replies || []), reply];
    if (ticket.status === TicketStatus.RESOLVED) {
      ticket.status = TicketStatus.OPEN; // Riapri se il tenant risponde
    }
    return this.ticketRepo.save(ticket);
  }
}
