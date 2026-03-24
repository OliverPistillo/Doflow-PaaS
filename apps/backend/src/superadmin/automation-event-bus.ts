import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AutomationsService } from './automations.service';
import { TriggerEvent } from './entities/automation-rule.entity';

/**
 * Ponte tra i service applicativi e l'engine di automazione.
 * I service emettono eventi, questo bridge li cattura e li inoltra
 * all'AutomationsService senza creare dipendenze circolari.
 *
 * Uso nei service:
 *   this.eventEmitter.emit('automation.trigger', {
 *     event: TriggerEvent.LEAD_CREATED,
 *     context: { leadId, fullName, ... }
 *   });
 */

export interface AutomationTriggerPayload {
  event: TriggerEvent;
  context: Record<string, any>;
}

@Injectable()
export class AutomationEventBus {
  private readonly logger = new Logger(AutomationEventBus.name);

  constructor(
    private readonly automations: AutomationsService,
  ) {}

  @OnEvent('automation.trigger')
  async handleAutomationTrigger(payload: AutomationTriggerPayload) {
    try {
      const result = await this.automations.processEvent(payload.event, payload.context);
      if (result.executed > 0) {
        this.logger.log(`⚡ ${result.executed}/${result.rulesMatched} regole eseguite per ${payload.event}`);
      }
    } catch (err: any) {
      this.logger.error(`❌ Errore processamento evento ${payload.event}: ${err.message}`);
    }
  }
}
