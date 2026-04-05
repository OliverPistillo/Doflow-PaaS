import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationRule, TriggerEvent, ActionType } from './entities/automation-rule.entity';
import { PlatformNotificationsService } from './platform-notifications.service';
import { EmailTemplatesService } from './email-templates.service';
import { NotificationType } from './entities/platform-notification.entity';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private ruleRepo: Repository<AutomationRule>,
    private readonly notifService: PlatformNotificationsService,
    private readonly emailService: EmailTemplatesService,
  ) {}

  // ─── CRUD ───────────────────────────────────────────────────

  async findAll() {
    return this.ruleRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Automazione ${id} non trovata.`);
    return rule;
  }

  async create(dto: Partial<AutomationRule>) {
    const rule = this.ruleRepo.create(dto);
    return this.ruleRepo.save(rule);
  }

  async update(id: string, dto: Partial<AutomationRule>) {
    const rule = await this.findOne(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.ruleRepo.delete(id);
    return { message: 'Automazione eliminata.' };
  }

  async toggle(id: string, isActive: boolean) {
    const rule = await this.findOne(id);
    rule.isActive = isActive;
    return this.ruleRepo.save(rule);
  }

  // ─── Engine: processa un evento ─────────────────────────────

  async processEvent(event: TriggerEvent, context: Record<string, any>) {
    const rules = await this.ruleRepo.find({
      where: { triggerEvent: event, isActive: true },
    });

    let executed = 0;

    for (const rule of rules) {
      if (!this.matchConditions(rule.triggerConditions, context)) continue;

      try {
        await this.executeAction(rule, context);
        rule.executionCount++;
        rule.lastExecutedAt = new Date();
        await this.ruleRepo.save(rule);
        executed++;
        this.logger.log(`✅ Automazione '${rule.name}' eseguita per evento ${event}`);
      } catch (err: any) {
        this.logger.error(`❌ Automazione '${rule.name}' fallita: ${err.message}`);
      }
    }

    return { event, rulesMatched: rules.length, executed };
  }

  private matchConditions(conditions: Record<string, unknown>, context: Record<string, any>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key];
      if (expectedValue !== undefined && actualValue !== expectedValue) return false;
    }
    return true;
  }

  private async executeAction(rule: AutomationRule, context: Record<string, any>) {
    const config = rule.actionConfig;

    switch (rule.actionType) {
      case ActionType.SEND_EMAIL: {
        const slug = config.templateSlug as string;
        const toField = config.to as string;
        const to = this.interpolate(toField, context);
        const variables: Record<string, string> = {};
        if (config.variables && typeof config.variables === 'object') {
          for (const [k, v] of Object.entries(config.variables as Record<string, string>)) {
            variables[k] = this.interpolate(v, context);
          }
        }
        await this.emailService.sendWithTemplate(slug, to, variables);
        break;
      }

      case ActionType.CREATE_NOTIFICATION: {
        await this.notifService.create({
          title: this.interpolate(config.title as string || rule.name, context),
          message: this.interpolate(config.message as string || '', context),
          type: (config.notificationType as NotificationType) || NotificationType.INFO,
          targetTenantId: context.tenantId,
        });
        break;
      }

      case ActionType.WEBHOOK: {
        const url = config.url as string;
        if (url) {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule: rule.name, event: rule.triggerEvent, context }),
          });
        }
        break;
      }

      default:
        this.logger.warn(`Azione '${rule.actionType}' non ancora implementata.`);
    }
  }

  /** Sostituisce {{campo}} con il valore dal contesto */
  private interpolate(template: string, context: Record<string, any>): string {
    if (!template) return '';
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let val: any = context;
      for (const p of parts) val = val?.[p];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }

  // ─── Stats ──────────────────────────────────────────────────

  async getStats() {
    const all = await this.ruleRepo.find();
    const active = all.filter(r => r.isActive).length;
    const totalExecutions = all.reduce((acc, r) => acc + r.executionCount, 0);
    const byTrigger: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    for (const r of all) {
      byTrigger[r.triggerEvent] = (byTrigger[r.triggerEvent] || 0) + 1;
      byAction[r.actionType] = (byAction[r.actionType] || 0) + 1;
    }
    return {
      total: all.length, active, totalExecutions,
      byTrigger: Object.entries(byTrigger).map(([t, c]) => ({ trigger: t, count: c })),
      byAction: Object.entries(byAction).map(([a, c]) => ({ action: a, count: c })),
    };
  }
}
