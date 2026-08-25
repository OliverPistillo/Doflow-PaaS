import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { TenantAutomationEngineService } from './tenant-automation-engine.service';
import { TenantDoflowPerformanceRuntimeService } from './tenant-doflow-performance-runtime.service';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';

@Injectable()
export class TenantAutomationPerformanceDispatcher {
  private readonly logger = new Logger(TenantAutomationPerformanceDispatcher.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly engine: TenantAutomationEngineService,
    private readonly performance: TenantDoflowPerformanceRuntimeService,
  ) {}

  @Cron('*/2 * * * * *')
  async dispatch() {
    if (this.running) return;
    this.running = true;
    try {
      const schemas: Array<{ schema_name: string }> = await this.dataSource.query(
        `SELECT schema_name FROM information_schema.schemata WHERE lower(schema_name)='doflow'`,
      );
      for (const row of schemas) await this.dispatchSchema(safeSchema(row.schema_name, 'automation dispatcher'));
    } catch (error) {
      this.logger.warn(`Dispatcher Phase 4B: ${error instanceof Error ? error.message : 'errore'}`);
    } finally {
      this.running = false;
    }
  }

  async dispatchSchema(schema: string) {
    await ensureDoflowAutomationPerformanceTables(this.dataSource, schema);
    const outbox = await this.dataSource.query(
      `SELECT id,run_id FROM "${schema}".automation_outbox
       WHERE processed_at IS NULL AND status IN ('pending','retry') AND available_at<=now()
       ORDER BY created_at LIMIT 100`,
    );
    for (const row of outbox) {
      try { await this.engine.enqueueOutbox(schema, row.run_id, row.id); }
      catch (error) { this.logger.warn(`Outbox automation ${row.id}: ${error instanceof Error ? error.message : 'errore'}`); }
    }

    const due = await this.dataSource.query(
      `SELECT id,created_by,next_run_at FROM "${schema}".automation_rules
       WHERE deleted_at IS NULL AND archived_at IS NULL AND is_enabled=true
         AND run_mode IN ('scheduled','hybrid') AND next_run_at IS NOT NULL AND next_run_at<=now()
       ORDER BY next_run_at LIMIT 50`,
    );
    for (const rule of due) {
      try {
        await this.engine.enqueueRule(schema, rule.id, { id: rule.created_by || '', role: 'system' }, {
          triggerSource: 'scheduled',
          idempotencyKey: `scheduled:${rule.id}:${new Date(rule.next_run_at).toISOString()}`,
          operationId: undefined,
          payload: { scheduled_at: rule.next_run_at },
        });
        await this.dataSource.query(
          `UPDATE "${schema}".automation_rules
           SET next_run_at = CASE
             WHEN COALESCE(schedule_config->>'frequency','daily')='hourly' THEN now()+interval '1 hour'
             WHEN COALESCE(schedule_config->>'frequency','daily')='weekly' THEN now()+interval '7 days'
             ELSE now()+interval '1 day' END
           WHERE id=$1`,
          [rule.id],
        );
      } catch (error) {
        this.logger.warn(`Scheduler rule ${rule.id}: ${error instanceof Error ? error.message : 'errore'}`);
      }
    }

    const commerce = await this.dataSource.query(
      `SELECT o.id FROM "${schema}".commerce_outbox o
       LEFT JOIN "${schema}".performance_event_registry r ON r.source_table='commerce_outbox' AND r.source_id=o.id
       WHERE r.source_id IS NULL ORDER BY o.created_at LIMIT 100`,
    );
    const delivery = await this.dataSource.query(
      `SELECT o.id FROM "${schema}".delivery_outbox o
       LEFT JOIN "${schema}".performance_event_registry r ON r.source_table='delivery_outbox' AND r.source_id=o.id
       WHERE r.source_id IS NULL ORDER BY o.created_at LIMIT 100`,
    );
    for (const row of commerce) await this.performance.enqueueEvent({ schema, sourceTable: 'commerce_outbox', sourceId: row.id });
    for (const row of delivery) await this.performance.enqueueEvent({ schema, sourceTable: 'delivery_outbox', sourceId: row.id });
  }
}
