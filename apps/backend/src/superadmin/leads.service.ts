import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Lead, LeadSource, LeadStatus } from './entities/lead.entity';
import { TriggerEvent } from './entities/automation-rule.entity';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── CRUD ───────────────────────────────────────────────────

  async findAll(filters?: {
    status?: LeadStatus;
    source?: LeadSource;
    search?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.source) where.source = filters.source;
    if (filters?.search) {
      // Ricerca su nome, email, company
      return this.leadRepo.find({
        where: [
          { ...where, fullName: ILike(`%${filters.search}%`) },
          { ...where, email: ILike(`%${filters.search}%`) },
          { ...where, company: ILike(`%${filters.search}%`) },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return this.leadRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} non trovato.`);
    return lead;
  }

  async create(dto: Partial<Lead>) {
    const lead = this.leadRepo.create(dto);
    const saved = await this.leadRepo.save(lead);

    // 🔗 Automation hook: LEAD_CREATED
    this.eventEmitter.emit('automation.trigger', {
      event: TriggerEvent.LEAD_CREATED,
      context: {
        leadId: saved.id, fullName: saved.fullName, email: saved.email,
        phone: saved.phone, company: saved.company, source: saved.source,
        score: saved.score,
      },
    });

    return saved;
  }

  async update(id: string, dto: Partial<Lead>) {
    const lead = await this.findOne(id);
    Object.assign(lead, dto);
    return this.leadRepo.save(lead);
  }

  async delete(id: string) {
    const lead = await this.findOne(id);
    await this.leadRepo.delete(id);
    return { message: `Lead '${lead.fullName}' eliminato.` };
  }

  async updateStatus(id: string, status: LeadStatus) {
    const lead = await this.findOne(id);
    const fromStatus = lead.status;
    lead.status = status;
    const saved = await this.leadRepo.save(lead);

    // 🔗 Automation hook: LEAD_STATUS_CHANGE
    this.eventEmitter.emit('automation.trigger', {
      event: TriggerEvent.LEAD_STATUS_CHANGE,
      context: {
        leadId: saved.id, fullName: saved.fullName, email: saved.email,
        company: saved.company, fromStatus, toStatus: status, score: saved.score,
      },
    });

    return saved;
  }

  // ─── Dashboard stats ───────────────────────────────────────

  async getStats() {
    const all = await this.leadRepo.find();

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalScore = 0;

    for (const l of all) {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      bySource[l.source] = (bySource[l.source] || 0) + 1;
      totalScore += l.score;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentLeads = all.filter(l => new Date(l.createdAt) >= thirtyDaysAgo);

    const wonCount = byStatus[LeadStatus.WON] || 0;
    const lostCount = byStatus[LeadStatus.LOST] || 0;
    const conversionRate = (wonCount + lostCount) > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100)
      : 0;

    return {
      total: all.length,
      new: byStatus[LeadStatus.NEW] || 0,
      qualified: byStatus[LeadStatus.QUALIFIED] || 0,
      won: wonCount,
      lost: lostCount,
      conversionRate,
      avgScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
      last30Days: recentLeads.length,
      bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })),
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    };
  }
}
