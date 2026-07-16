import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { TenantNotificationsService } from './tenant-notifications.service';
import { ensureTenantCredentialsTables } from './tenant-credentials-schema';

type CredentialAlert = {
  id: string;
  title: string;
  owner_user_id?: string | null;
  alert_type: string;
  due_at: string;
};

@Injectable()
export class TenantCredentialsSchedulerService {
  private readonly logger = new Logger(TenantCredentialsSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: TenantNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processCredentialAlerts() {
    const tenants = await this.dataSource.query(
      `SELECT schema_name, slug FROM public.tenants WHERE is_active = true`,
    ).catch(() => []);

    for (const tenant of tenants) {
      const rawSchema = tenant.schema_name || tenant.slug;
      if (!rawSchema) continue;
      try {
        const schema = safeSchema(rawSchema, 'TenantCredentialsSchedulerService.processCredentialAlerts');
        await this.processTenant(schema);
      } catch (err) {
        this.logger.error(`Errore alert credenziali tenant=${rawSchema}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  async processTenant(schema: string) {
    const s = safeSchema(schema, 'TenantCredentialsSchedulerService.processTenant');
    await ensureTenantCredentialsTables(this.dataSource, s);
    const rows: CredentialAlert[] = await this.dataSource.query(
      `SELECT id, title, owner_user_id,
              CASE
                WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
                WHEN rotation_due_at IS NOT NULL AND rotation_due_at < now() THEN 'overdue_rotation'
                WHEN expires_at IS NOT NULL AND expires_at <= now() + interval '30 days' THEN 'expires_at'
                WHEN renewal_at IS NOT NULL AND renewal_at <= now() + interval '30 days' THEN 'renewal_at'
                WHEN rotation_due_at IS NOT NULL AND rotation_due_at <= now() + interval '30 days' THEN 'rotation_due_at'
              END AS alert_type,
              COALESCE(expires_at, renewal_at, rotation_due_at)::text AS due_at
       FROM "${s}".credential_items
       WHERE deleted_at IS NULL
         AND status <> 'archived'
         AND (
           (expires_at IS NOT NULL AND expires_at <= now() + interval '30 days')
           OR (renewal_at IS NOT NULL AND renewal_at <= now() + interval '30 days')
           OR (rotation_due_at IS NOT NULL AND rotation_due_at <= now() + interval '30 days')
         )
       LIMIT 100`,
    );

    for (const row of rows) {
      if (!row.alert_type) continue;
      await this.sendDedupeAlert(s, row);
    }
  }

  private async sendDedupeAlert(schema: string, row: CredentialAlert) {
    const recipient = row.owner_user_id || null;
    const threshold = `${row.alert_type}:${String(row.due_at || '').slice(0, 10)}`;
    const existing = await this.dataSource.query(
      `SELECT id
       FROM "${schema}".credential_alert_dedupe
       WHERE credential_item_id = $1
         AND alert_type = $2
         AND threshold_key = $3
         AND recipient_user_id IS NOT DISTINCT FROM $4
       LIMIT 1`,
      [row.id, row.alert_type, threshold, recipient],
    );
    if (existing[0]) return;
    const inserted = await this.dataSource.query(
      `INSERT INTO "${schema}".credential_alert_dedupe (
         credential_item_id, alert_type, threshold_key, recipient_user_id, sent_at
       ) VALUES ($1,$2,$3,$4,now())
       RETURNING id`,
      [row.id, row.alert_type, threshold, recipient],
    );
    if (!inserted[0]) return;

    const title = this.titleFor(row.alert_type, row.title);
    await this.notifications.createNotification(schema, {
      recipient_user_id: recipient,
      recipient_role: recipient ? null : 'owner',
      title,
      body: `Controlla la credenziale "${row.title}" nel vault interno. Nessun segreto e' incluso in questa notifica.`,
      type: 'system',
      priority: ['expired', 'overdue_rotation'].includes(row.alert_type) ? 'urgent' : 'high',
      entity_type: 'system',
      entity_id: null,
      link_url: `/credentials/${row.id}`,
      fingerprint: `credentials:${row.id}:${threshold}:${recipient || 'owner'}`,
      metadata: { credential_item_id: row.id, alert_type: row.alert_type },
      created_by: null,
    });

    await this.dataSource.query(
      `INSERT INTO "${schema}".credential_audit_log (
         credential_item_id, actor_user_id, action, outcome, reason, metadata, created_at
       ) VALUES ($1,NULL,'alert_sent','success',NULL,$2::jsonb,now())`,
      [row.id, JSON.stringify({ alert_type: row.alert_type })],
    );
  }

  private titleFor(type: string, title: string): string {
    if (type === 'expired') return `Credenziale scaduta: ${title}`;
    if (type === 'overdue_rotation') return `Rotazione credenziale in ritardo: ${title}`;
    if (type === 'expires_at') return `Credenziale in scadenza: ${title}`;
    if (type === 'renewal_at') return `Rinnovo credenziale in arrivo: ${title}`;
    if (type === 'rotation_due_at') return `Rotazione credenziale in arrivo: ${title}`;
    return `Alert credenziale: ${title}`;
  }
}
