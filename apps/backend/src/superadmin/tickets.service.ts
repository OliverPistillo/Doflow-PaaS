import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SupportTicket, TicketStatus, TicketPriority, TicketCategory,
} from './entities/support-ticket.entity';
import { PlatformNotificationsService } from './platform-notifications.service';
import { NotificationType } from './entities/platform-notification.entity';
import { TriggerEvent } from './entities/automation-rule.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,
    private readonly notifService: PlatformNotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Auto-generate ticket code ──────────────────────────────

  private async generateCode(): Promise<string> {
    const count = await this.ticketRepo.count();
    return `TK-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── CRUD ───────────────────────────────────────────────────

  async findAll(filters?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    search?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.category) where.category = filters.category;

    if (filters?.search) {
      return this.ticketRepo.find({
        where: [
          { ...where, subject: ILike(`%${filters.search}%`) },
          { ...where, ticketCode: ILike(`%${filters.search}%`) },
          { ...where, reporterEmail: ILike(`%${filters.search}%`) },
          { ...where, tenantName: ILike(`%${filters.search}%`) },
        ],
        order: { createdAt: 'DESC' },
      });
    }

    return this.ticketRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} non trovato.`);
    return ticket;
  }

  async create(dto: {
    subject: string;
    description: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    tenantId: string;
    tenantName?: string;
    reporterEmail: string;
    slaHours?: number;
  }) {
    const ticketCode = await this.generateCode();

    // SLA di default per priorità
    const defaultSla: Record<string, number> = {
      CRITICAL: 4, HIGH: 8, MEDIUM: 24, LOW: 72,
    };
    const priority = dto.priority || TicketPriority.MEDIUM;
    const slaHours = dto.slaHours || defaultSla[priority] || 24;

    const ticket = this.ticketRepo.create({
      ticketCode,
      subject: dto.subject,
      description: dto.description,
      category: dto.category || TicketCategory.GENERAL,
      priority,
      status: TicketStatus.OPEN,
      tenantId: dto.tenantId,
      tenantName: dto.tenantName,
      reporterEmail: dto.reporterEmail,
      slaHours,
      replies: [],
    });

    const saved = await this.ticketRepo.save(ticket);

    // Notifica al superadmin
    await this.notifService.create({
      title: `Nuovo ticket: ${ticketCode}`,
      message: `${dto.reporterEmail} ha aperto "${dto.subject}" [${priority}]`,
      type: priority === 'CRITICAL' ? NotificationType.ERROR : NotificationType.WARNING,
      actionUrl: `/superadmin/tickets`,
    });

    // 🔗 Automation hook: TICKET_CREATED
    this.eventEmitter.emit('automation.trigger', {
      event: TriggerEvent.TICKET_CREATED,
      context: {
        ticketId: saved.id, ticketCode, subject: dto.subject,
        priority, category: dto.category, tenantId: dto.tenantId,
        reporterEmail: dto.reporterEmail,
      },
    });

    return saved;
  }

  async update(id: string, dto: Partial<SupportTicket>) {
    const ticket = await this.findOne(id);
    // Non sovrascrivere replies/ticketCode
    const { replies, ticketCode, ...rest } = dto as any;
    Object.assign(ticket, rest);

    if (dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    return this.ticketRepo.save(ticket);
  }

  async addReply(id: string, reply: {
    author: string;
    message: string;
    isInternal?: boolean;
  }) {
    const ticket = await this.findOne(id);
    const newReply = {
      author: reply.author,
      message: reply.message,
      timestamp: new Date().toISOString(),
      isInternal: reply.isInternal ?? false,
    };
    ticket.replies = [...(ticket.replies || []), newReply];
    ticket.updatedAt = new Date();

    // Se è una risposta del supporto, cambia stato
    if (!reply.isInternal && ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    return this.ticketRepo.save(ticket);
  }

  async updateStatus(id: string, status: TicketStatus) {
    const ticket = await this.findOne(id);
    ticket.status = status;
    if (status === TicketStatus.RESOLVED) ticket.resolvedAt = new Date();
    return this.ticketRepo.save(ticket);
  }

  async delete(id: string) {
    const ticket = await this.findOne(id);
    await this.ticketRepo.delete(id);
    return { message: `Ticket ${ticket.ticketCode} eliminato.` };
  }

  // ─── Dashboard stats ───────────────────────────────────────

  async getStats() {
    const all = await this.ticketRepo.find();

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let slaBreached = 0;

    for (const t of all) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;

      if (t.resolvedAt && t.createdAt) {
        const hoursToResolve = (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        totalResolutionTime += hoursToResolve;
        resolvedCount++;

        if (t.slaHours && hoursToResolve > t.slaHours) {
          slaBreached++;
        }
      }

      // Check open tickets che hanno superato SLA
      if (t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED && t.slaHours) {
        const hoursOpen = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        if (hoursOpen > t.slaHours) slaBreached++;
      }
    }

    const avgResolutionHours = resolvedCount > 0
      ? Math.round((totalResolutionTime / resolvedCount) * 10) / 10
      : 0;

    const slaCompliance = all.length > 0
      ? Math.round(((all.length - slaBreached) / all.length) * 100)
      : 100;

    return {
      total: all.length,
      open: byStatus[TicketStatus.OPEN] || 0,
      inProgress: byStatus[TicketStatus.IN_PROGRESS] || 0,
      resolved: byStatus[TicketStatus.RESOLVED] || 0,
      closed: byStatus[TicketStatus.CLOSED] || 0,
      avgResolutionHours,
      slaBreached,
      slaCompliance,
      byPriority: Object.entries(byPriority).map(([p, c]) => ({ priority: p, count: c })),
      byCategory: Object.entries(byCategory).map(([cat, c]) => ({ category: cat, count: c })),
    };
  }
}
