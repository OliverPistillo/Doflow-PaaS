import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { NotificationsService } from './realtime/notifications.service';

type AuditMetadata = Record<string, unknown>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly notifications: NotificationsService) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return tenantId ?? 'public';
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
    const tenantId = this.getTenantId(req);

    const authUser = (req as any).authUser as
      | { email?: string; role?: string }
      | undefined;

    const actorEmail = authUser?.email ?? null;
    const actorRole = authUser?.role ?? null;
    const targetEmail = params.targetEmail ?? null;
    const ip = (req.ip as string | undefined) ?? null;
    const metadata = params.metadata ?? {};
    const timestamp = new Date(); // Timestamp coerente per DB e WS

    // 1. Salvataggio su DB (Persistenza)
    // Nota: INSERT RETURNING id ci serve per avere l'ID reale nel frontend
    const rows = await conn.query(
      `
      insert into ${tenantId}.audit_log
      (action, actor_email, actor_role, target_email, metadata, ip, created_at)
      values ($1, $2, $3, $4, $5::jsonb, $6, $7)
      returning id
      `,
      [
        params.action,
        actorEmail,
        actorRole,
        targetEmail,
        JSON.stringify(metadata),
        ip,
        timestamp
      ],
    );

    const newId = rows[0]?.id;

    // 2. Broadcast Real-time (Live Feed)
    // Inviamo l'evento a tutti gli utenti connessi a questo tenant
    const payload = {
        id: newId,
        action: params.action,
        actor_email: actorEmail,
        actor_role: actorRole,
        target_email: targetEmail,
        metadata,
        ip,
        created_at: timestamp.toISOString()
    };

    try {
        // Usa il canale del tenant per inviare l'update
        // channel pattern: tenant:{tenantId}
        // Il metodo broadcastToTenant si occupa di serializzare e pubblicare su Redis
        this.notifications.broadcastToTenant(tenantId, {
            type: 'activity_feed_update',
            payload: payload
        });
    } catch (e) {
        this.logger.error('Failed to broadcast audit log via WS', e);
    }
  }
}