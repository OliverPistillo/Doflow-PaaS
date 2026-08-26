import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { safeSchema } from '../common/schema.utils';

export const UNIVERSAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantActor = {
  id: string;
  email: string;
  role: string;
  schema: string;
};

export function tenantActor(request: any, context: string): TenantActor {
  const source = request?.user || request?.authUser;
  const schema = safeSchema(
    source?.tenantId || source?.tenant_id || 'public',
    context,
  );
  const id = String(source?.sub || source?.id || source?.userId || '');
  if (schema === 'public' || !UNIVERSAL_UUID_RE.test(id)) {
    throw new ForbiddenException('Questa funzione richiede un utente tenant autenticato.');
  }
  const tenantHeader = String(request?.headers?.['x-doflow-tenant-id'] || '').trim().toLowerCase();
  const tenantSlug = String(source?.tenantSlug || source?.tenant_slug || '').trim().toLowerCase();
  if (tenantHeader && tenantHeader !== schema && tenantHeader !== tenantSlug) {
    throw new ForbiddenException('Il tenant richiesto non coincide con la sessione autenticata.');
  }
  return {
    id,
    email: String(source?.email || ''),
    role: String(source?.role || 'user').trim().toLowerCase().replace('super_admin', 'superadmin'),
    schema,
  };
}

export function rejectTenantOverride(input: Record<string, unknown> | undefined) {
  if (!input) return;
  if (input.tenantId !== undefined || input.tenant_id !== undefined || input.tenant !== undefined || input.schema !== undefined) {
    throw new BadRequestException('Il tenant e determinato dalla sessione autenticata.');
  }
}

export function rejectActorOverride(input: Record<string, unknown> | undefined) {
  rejectTenantOverride(input);
  if (!input) return;
  if (input.userId !== undefined || input.user_id !== undefined || input.actorId !== undefined || input.actor_id !== undefined) {
    throw new BadRequestException('L’utente e determinato dalla sessione autenticata.');
  }
}

export function tenantUuid(value: unknown, label = 'ID'): string {
  const id = String(value || '').trim();
  if (!UNIVERSAL_UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
  return id;
}

export function isTenantAdministrator(actor: TenantActor): boolean {
  return actor.role === 'owner' || actor.role === 'admin';
}

export function boundedText(value: unknown, label: string, max: number, required = false): string {
  const text = String(value ?? '').trim();
  if (required && !text) throw new BadRequestException(`${label} obbligatorio`);
  if (text.length > max) throw new BadRequestException(`${label} troppo lungo`);
  return text;
}
