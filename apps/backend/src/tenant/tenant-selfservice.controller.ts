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
    return (req as any).tenantId || user?.tenantId || user?.tenant_id || 'public';
  }

  /** Info piano del tenant corrente */
  @Get('plan')
  async getMyPlan(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return { error: 'Tenant non trovato' };

    const TIER_PRICES: Record<string, number> = { STARTER: 49, PRO: 99, ENTERPRISE: 299 };
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
    const subs = await this.subRepo.find({ where: { tenantId }, relations: ['module'] });
    const allModules = await this.moduleRepo.find({ order: { category: 'ASC', name: 'ASC' } });

    return {
      active: subs.filter(s => s.status === 'ACTIVE').map(s => ({
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
        category: m.category,
        minTier: m.minTier,
        priceMonthly: m.priceMonthly,
        isBeta: m.isBeta,
        isActive: subs.some(s => s.moduleKey === m.key && s.status === 'ACTIVE'),
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
    const tenantId = this.getTenantId(req);
    const all = await this.notifRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
    return all.filter(n => !n.targetTenantId || n.targetTenantId === tenantId);
  }

  /** Segna notifica come letta */
  @Patch('notifications/:id/read')
  async markNotifRead(@Param('id') id: string) {
    await this.notifRepo.update(id, { isRead: true, readAt: new Date() });
    return { message: 'Notifica segnata come letta.' };
  }

  // ─── SUPPORTO TICKET ───────────────────────────────────────

  /** Lista ticket del tenant corrente */
  @Get('tickets')
  async getMyTickets(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
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
