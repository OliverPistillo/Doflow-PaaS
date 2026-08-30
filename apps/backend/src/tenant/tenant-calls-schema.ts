import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';

type Queryable = { query(sql: string, parameters?: unknown[]): Promise<any> };

async function provisionPublic(target: Queryable) {
  await target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await target.query(`
    INSERT INTO public.platform_modules
      (id, key, name, description, category, "minTier", "priceMonthly", "isBeta", "createdAt", "updatedAt")
    VALUES (
      uuid_generate_v4(), 'collab.calls', 'Doflow Calls',
      'Chiamate audio/video Desktop e meeting guest con LiveKit',
      'SERVICES', 'PRO', 0, true, now(), now()
    )
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      "minTier" = EXCLUDED."minTier",
      "isBeta" = EXCLUDED."isBeta",
      "updatedAt" = now()
  `);
  await target.query(`
    CREATE TABLE IF NOT EXISTS public.desktop_call_room_index (
      room_key TEXT PRIMARY KEY,
      tenant_schema TEXT NOT NULL,
      call_id UUID NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ
    )
  `);
  await target.query(`
    CREATE TABLE IF NOT EXISTS public.desktop_call_guest_invite_index (
      token_digest TEXT PRIMARY KEY,
      tenant_schema TEXT NOT NULL,
      invite_id UUID NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_desktop_call_room_tenant ON public.desktop_call_room_index(tenant_schema, call_id)`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_desktop_call_guest_expiry ON public.desktop_call_guest_invite_index(expires_at) WHERE revoked_at IS NULL`);
}

async function provisionTenant(target: Queryable, schemaValue: string) {
  const s = safeSchema(schemaValue, 'ensureTenantCallTables');
  if (s === 'public') throw new Error('Desktop call tables cannot be provisioned in public');
  await target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      conversation_id UUID,
      room_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'created',
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ
    )
  `);
  const columns = [
    'call_type TEXT NOT NULL DEFAULT \'audio\'',
    'caller_user_id UUID',
    'callee_user_id UUID',
    'ringing_at TIMESTAMPTZ',
    'accepted_at TIMESTAMPTZ',
    'connecting_at TIMESTAMPTZ',
    'started_at TIMESTAMPTZ',
    'expires_at TIMESTAMPTZ',
    'duration_seconds INTEGER',
    'outcome TEXT',
    'termination_reason TEXT',
    'crm_context_type TEXT',
    'crm_context_id UUID',
    "metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
    'idempotency_key TEXT',
    'idempotency_hash TEXT',
    'optimistic_version INTEGER NOT NULL DEFAULT 1',
    'accepted_device_id TEXT',
    'last_state_event_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'activity_recorded_at TIMESTAMPTZ',
    'guest_mode BOOLEAN NOT NULL DEFAULT false',
  ];
  for (const column of columns) {
    await target.query(`ALTER TABLE "${s}".tenant_call_sessions ADD COLUMN IF NOT EXISTS ${column}`);
  }
  await target.query(`ALTER TABLE "${s}".tenant_call_sessions ALTER COLUMN conversation_id DROP NOT NULL`);
  await target.query(`UPDATE "${s}".tenant_call_sessions SET caller_user_id=created_by WHERE caller_user_id IS NULL`);
  await target.query(`UPDATE "${s}".tenant_call_sessions SET expires_at=COALESCE(expires_at,created_at + interval '2 hours') WHERE expires_at IS NULL`);
  await target.query(`ALTER TABLE "${s}".tenant_call_sessions ALTER COLUMN caller_user_id SET NOT NULL`);
  await target.query(`ALTER TABLE "${s}".tenant_call_sessions ALTER COLUMN expires_at SET NOT NULL`);

  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_user_locks (
      user_id UUID PRIMARY KEY,
      call_id UUID NOT NULL REFERENCES "${s}".tenant_call_sessions(id) ON DELETE CASCADE,
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await target.query(`ALTER TABLE "${s}".tenant_call_user_locks DROP CONSTRAINT IF EXISTS tenant_call_user_locks_call_id_key`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_tenant_call_user_locks_call ON "${s}".tenant_call_user_locks(call_id)`);
  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_guest_invites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      call_id UUID NOT NULL REFERENCES "${s}".tenant_call_sessions(id) ON DELETE CASCADE,
      token_digest TEXT NOT NULL UNIQUE,
      guest_session_digest TEXT,
      guest_identity TEXT,
      display_name TEXT,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      last_token_at TIMESTAMPTZ
    )
  `);
  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_webhook_events (
      event_id TEXT PRIMARY KEY,
      call_id UUID REFERENCES "${s}".tenant_call_sessions(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      participant_identity_hash TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_activities (
      call_id UUID PRIMARY KEY REFERENCES "${s}".tenant_call_sessions(id) ON DELETE CASCADE,
      activity_id UUID,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await target.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tenant_call_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      call_id UUID NOT NULL REFERENCES "${s}".tenant_call_sessions(id) ON DELETE CASCADE,
      actor_user_id UUID,
      action TEXT NOT NULL,
      event_key TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await target.query(`ALTER TABLE "${s}".tenant_call_audit ALTER COLUMN actor_user_id DROP NOT NULL`);
  await target.query(`ALTER TABLE "${s}".tenant_call_audit ADD COLUMN IF NOT EXISTS event_key TEXT`);
  await target.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_call_audit_event ON "${s}".tenant_call_audit(event_key) WHERE event_key IS NOT NULL`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_tenant_call_status ON "${s}".tenant_call_sessions(status, created_at DESC)`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_tenant_call_caller ON "${s}".tenant_call_sessions(caller_user_id, created_at DESC)`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_tenant_call_callee ON "${s}".tenant_call_sessions(callee_user_id, created_at DESC) WHERE callee_user_id IS NOT NULL`);
  await target.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_call_idempotency ON "${s}".tenant_call_sessions(created_by,idempotency_key) WHERE idempotency_key IS NOT NULL`);
  await target.query(`CREATE INDEX IF NOT EXISTS idx_tenant_call_invite_expiry ON "${s}".tenant_call_guest_invites(expires_at) WHERE revoked_at IS NULL`);
}

export async function ensureTenantCallActivityProjection(target: Queryable, schemaValue: string): Promise<boolean> {
  const s = safeSchema(schemaValue, 'ensureTenantCallActivityProjection');
  const table = await target.query('SELECT to_regclass($1) AS name', [`${s}.commercial_activities`]);
  if (!table[0]?.name) return false;
  const requiredColumns = [
    ['project_id', 'project_id UUID'],
    ['channel', 'channel TEXT'],
    ['direction', 'direction TEXT'],
    ['status', 'status TEXT'],
    ['outcome', 'outcome TEXT'],
    ['metadata', "metadata JSONB DEFAULT '{}'::jsonb"],
  ] as const;
  const present = await target.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=$1 AND table_name='commercial_activities' AND column_name=ANY($2::text[])`,
    [s, requiredColumns.map(([name]) => name)],
  );
  const existing = new Set(present.map((row: { column_name?: unknown }) => String(row.column_name || '')));
  for (const [name, definition] of requiredColumns) {
    if (!existing.has(name)) {
      await target.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS ${definition}`);
    }
  }
  const projectIndex = await target.query('SELECT to_regclass($1) AS name', [`${s}.idx_commercial_activities_project`]);
  if (!projectIndex[0]?.name) {
    await target.query(`CREATE INDEX IF NOT EXISTS idx_commercial_activities_project ON "${s}".commercial_activities(project_id)`);
  }
  return true;
}

export function ensurePublicTenantCallTables(target: Queryable): Promise<void> {
  return provisionSchemaOnce(target as object, 'desktop-calls:public', () => provisionPublic(target));
}

export function ensureTenantCallTables(target: Queryable, schema: string): Promise<void> {
  const safe = safeSchema(schema, 'ensureTenantCallTables');
  return provisionSchemaOnce(target as object, `desktop-calls:${safe}`, async () => {
    await provisionPublic(target);
    await provisionTenant(target, safe);
    await ensureTenantCallActivityProjection(target, safe);
  });
}
