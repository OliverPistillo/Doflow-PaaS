export const DOFLOW_TENANT_SCHEMA = 'doflow';

export function isDoflowTenant(schema: string | undefined | null): boolean {
  return String(schema || '').trim().toLowerCase() === DOFLOW_TENANT_SCHEMA;
}
