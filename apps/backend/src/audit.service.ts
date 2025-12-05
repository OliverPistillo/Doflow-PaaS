import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';

type AuditMetadata = Record<string, unknown>;

@Injectable()
export class AuditService {
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

    await conn.query(
      `
      insert into ${tenantId}.audit_log
      (action, actor_email, actor_role, target_email, metadata, ip)
      values ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        params.action,
        actorEmail,
        actorRole,
        targetEmail,
        JSON.stringify(metadata),
        ip,
      ],
    );
  }
}
