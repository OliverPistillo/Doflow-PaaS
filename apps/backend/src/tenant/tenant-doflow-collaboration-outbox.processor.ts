import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { NotificationsService } from '../realtime/notifications.service';
import { isDoflowTenant } from './tenant-context';
import {
  DOFLOW_COLLABORATION_OUTBOX_JOB,
  DOFLOW_COLLABORATION_OUTBOX_QUEUE,
} from './tenant-doflow-collaboration.service';

type CollaborationOutboxJob = { schema: string; outboxId: string };

@Processor(DOFLOW_COLLABORATION_OUTBOX_QUEUE, { concurrency: 4 })
export class TenantDoflowCollaborationOutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(TenantDoflowCollaborationOutboxProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) { super(); }

  async process(job: Job<CollaborationOutboxJob>) {
    if (job.name !== DOFLOW_COLLABORATION_OUTBOX_JOB) throw new Error('Unsupported collaboration outbox job');
    const schema = safeSchema(job.data.schema, 'collaboration outbox');
    if (!isDoflowTenant(schema)) throw new Error('Collaboration outbox is doflow-only');
    const rows = await this.dataSource.query(
      `SELECT id, recipient_user_id, payload, processed_at
       FROM "${schema}".collaboration_outbox WHERE id = $1 LIMIT 1`,
      [job.data.outboxId],
    );
    const event = rows[0];
    if (!event || event.processed_at) return { dispatched: false };
    try {
      if (event.recipient_user_id) await this.notifications.notifyUserOrThrow(String(event.recipient_user_id), {
        eventId: String(event.id),
        ...(event.payload || {}),
      }, schema);
      await this.dataSource.query(
        `UPDATE "${schema}".collaboration_outbox
         SET processed_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1 AND processed_at IS NULL`,
        [event.id],
      );
      return { dispatched: true };
    } catch (error) {
      await this.dataSource.query(
        `UPDATE "${schema}".collaboration_outbox
         SET attempts = attempts + 1, last_error = $2, available_at = now() + interval '5 seconds' WHERE id = $1`,
        [event.id, error instanceof Error ? error.message.slice(0, 500) : 'dispatch failed'],
      );
      this.logger.warn(`Collaboration outbox dispatch failed event=${event.id}`);
      throw error;
    }
  }
}
