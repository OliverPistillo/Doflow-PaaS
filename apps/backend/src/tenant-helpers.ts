import { Request } from 'express';
import { DataSource } from 'typeorm';

export const FEDERICA_TENANT = 'federicanerone';

export function getTenantId(req: Request): string {
  return ((req as any).tenantId as string | undefined) ?? 'public';
}

export function getTenantConn(req: Request): DataSource {
  const conn = (req as any).tenantConnection as DataSource | undefined;
  if (!conn) throw new Error('No tenant connection on request');
  return conn;
}

export function getAuthUser(req: Request) {
  return (req as any).authUser ?? (req as any).user;
}

export function assertAuthenticated(req: Request) {
  const u = getAuthUser(req);
  if (!u) {
    const err: any = new Error('Not authenticated');
    err.statusCode = 401;
    throw err;
  }
  return u;
}

/**
 * Federica-only gate:
 * per gli altri tenant la feature “non esiste” (404).
 */
export function assertFedericaTenant(req: Request) {
  const tenantId = getTenantId(req);
  if (tenantId !== FEDERICA_TENANT) {
    const err: any = new Error('Not Found');
    err.statusCode = 404;
    throw err;
  }
  return tenantId;
}

/**
 * helper standard per rispondere bene in controller "manuali"
 */
export function respondError(res: any, e: any) {
  const status = e?.statusCode ?? 500;
  const msg = e?.message ?? 'error';
  return res.status(status).json({ error: msg });
}
