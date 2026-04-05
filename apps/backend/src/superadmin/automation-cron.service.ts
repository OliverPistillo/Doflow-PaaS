import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { TriggerEvent } from './entities/automation-rule.entity';

@Injectable()
export class AutomationCronService {
  private readonly logger = new Logger(AutomationCronService.name);

  constructor(
    @InjectRepository(TenantSubscription)
    private subRepo: Repository<TenantSubscription>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Ogni giorno alle 08:00 — controlla trial in scadenza (entro 7 giorni) */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkTrialExpiring() {
    this.logger.log('🕐 Controllo trial in scadenza...');

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringSubs = await this.subRepo.find({
      where: {
        status: 'TRIAL' as any,
        trialEndsAt: LessThan(sevenDaysFromNow),
      },
      relations: ['tenant', 'module'],
    });

    for (const sub of expiringSubs) {
      const daysLeft = Math.ceil(
        (new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysLeft > 0 && daysLeft <= 7) {
        this.eventEmitter.emit('automation.trigger', {
          event: TriggerEvent.TENANT_TRIAL_EXPIRING,
          context: {
            tenantId: sub.tenantId,
            tenantName: sub.tenant?.name || sub.tenantId,
            moduleKey: sub.moduleKey,
            moduleName: sub.module?.name || sub.moduleKey,
            trialEndsAt: sub.trialEndsAt,
            daysLeft,
          },
        });
      }
    }

    if (expiringSubs.length > 0) {
      this.logger.log(`⚡ ${expiringSubs.length} trial in scadenza processati`);
    }
  }

  /** Ogni giorno alle 09:00 — controlla fatture scadute non pagate */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkOverdueInvoices() {
    this.logger.log('🕐 Controllo fatture scadute...');

    const now = new Date();

    // Trova fatture con dueDate passata e ancora in stato SENT o PENDING
    const overdueInvoices = await this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.status IN (:...statuses)', { statuses: ['SENT', 'PENDING'] })
      .andWhere('inv.dueDate IS NOT NULL')
      .andWhere('inv.dueDate < :now', { now })
      .getMany();

    for (const inv of overdueInvoices) {
      this.eventEmitter.emit('automation.trigger', {
        event: TriggerEvent.INVOICE_OVERDUE,
        context: {
          invoiceId: inv.id,
          invoiceNumber: (inv as any).invoiceNumber || inv.id,
          amount: Number(inv.amount),
          clientName: (inv as any).clientName,
          dueDate: (inv as any).dueDate,
          daysPastDue: Math.ceil((now.getTime() - new Date((inv as any).dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        },
      });
    }

    if (overdueInvoices.length > 0) {
      this.logger.log(`⚡ ${overdueInvoices.length} fatture scadute processate`);
    }
  }
}
