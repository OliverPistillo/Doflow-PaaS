import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { NotificationsService } from './realtime/notifications.service';
import { safeSchema } from './common/schema.utils';

type AuditMetadata = Record<string, unknown>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly notifications: NotificationsService) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) throw new Error('No tenant connection on request');
    return conn;
  }

  private getTenantSchema(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    // FIX 🔴: safeSchema unificato (fail-fast su input non valido)
    // Per l'audit usiamo 'public' come fallback sicuro solo se non c'è tenant
    return tenantId ? safeSchema(tenantId, 'AuditService') : 'public';
  }

  async log(
    req: Request,
    params: {
      action: string;
      targetEmail?: string;
      metadata?: AuditMetadata;
    },
  ) {
    const conn = this.getConn(req);
    const schema = this.getTenantSchema(req);

    const authUser = (req as any).authUser as
      | { email?: string; role?: string }
      | undefined;

    const actorEmail   = authUser?.email   ?? null;
    const actorRole    = authUser?.role    ?? null;
    const targetEmail  = params.targetEmail ?? null;
    const ip           = (req.ip as string | undefined) ?? null;
    const metadata     = params.metadata ?? {};
    const timestamp    = new Date();

    // FIX 🔴: schema sempre tra doppi apici per prevenire SQL injection
    const rows = await conn.query(
      `
      INSERT INTO "${schema}".audit_log
        (action, actor_email, actor_role, target_email, metadata, ip, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      RETURNING id
      `,
      [
        params.action,
        actorEmail,
        actorRole,
        targetEmail,
        JSON.stringify(metadata),
        ip,
        timestamp,
      ],
    );

    const newId = rows[0]?.id;

    // Broadcast real-time
    try {
      this.notifications.broadcastToTenant(schema, {
        type: 'activity_feed_update',
        payload: {
          id:           newId,
          action:       params.action,
          actor_email:  actorEmail,
          actor_role:   actorRole,
          target_email: targetEmail,
          metadata,
          ip,
          created_at:   timestamp.toISOString(),
        },
      });
    } catch (e) {
      this.logger.error('Failed to broadcast audit log via WebSocket', e);
    }
  }
}
