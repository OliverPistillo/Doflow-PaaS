import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { BASE_PLANNING_VIEWS } from './tenant-calendar.types';

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantCalendarTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantCalendarTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL DEFAULT 'internal',
      status TEXT NOT NULL DEFAULT 'scheduled',
      priority TEXT NOT NULL DEFAULT 'medium',
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ,
      all_day BOOLEAN NOT NULL DEFAULT false,
      timezone TEXT DEFAULT 'Europe/Rome',
      location TEXT,
      meeting_url TEXT,
      color TEXT,
      visibility TEXT NOT NULL DEFAULT 'team',
      transparency TEXT NOT NULL DEFAULT 'busy',
      owner_user_id UUID,
      assigned_to_user_id UUID,
      created_by UUID,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_entity_type TEXT,
      source_entity_id UUID,
      source_fingerprint TEXT,
      is_system_generated BOOLEAN NOT NULL DEFAULT false,
      is_locked BOOLEAN NOT NULL DEFAULT false,
      recurrence_rule TEXT,
      recurrence_until TIMESTAMPTZ,
      parent_event_id UUID REFERENCES "${s}".calendar_events(id) ON DELETE SET NULL,
      reminders_config JSONB,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'calendar_events', [
    'title TEXT',
    'description TEXT',
    "event_type TEXT NOT NULL DEFAULT 'internal'",
    "status TEXT NOT NULL DEFAULT 'scheduled'",
    "priority TEXT NOT NULL DEFAULT 'medium'",
    'start_at TIMESTAMPTZ',
    'end_at TIMESTAMPTZ',
    'all_day BOOLEAN NOT NULL DEFAULT false',
    "timezone TEXT DEFAULT 'Europe/Rome'",
    'location TEXT',
    'meeting_url TEXT',
    'color TEXT',
    "visibility TEXT NOT NULL DEFAULT 'team'",
    "transparency TEXT NOT NULL DEFAULT 'busy'",
    'owner_user_id UUID',
    'assigned_to_user_id UUID',
    'created_by UUID',
    "source_type TEXT NOT NULL DEFAULT 'manual'",
    'source_entity_type TEXT',
    'source_entity_id UUID',
    'source_fingerprint TEXT',
    'is_system_generated BOOLEAN NOT NULL DEFAULT false',
    'is_locked BOOLEAN NOT NULL DEFAULT false',
    'recurrence_rule TEXT',
    'recurrence_until TIMESTAMPTZ',
    'parent_event_id UUID',
    'reminders_config JSONB',
    'metadata JSONB',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`ALTER TABLE "${s}".calendar_events ALTER COLUMN title SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".calendar_events ALTER COLUMN start_at SET NOT NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".calendar_event_attendees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES "${s}".calendar_events(id) ON DELETE CASCADE,
      user_id UUID,
      contact_id UUID,
      name TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'required',
      response_status TEXT NOT NULL DEFAULT 'needs_action',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".calendar_event_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES "${s}".calendar_events(id) ON DELETE CASCADE,
      remind_at TIMESTAMPTZ NOT NULL,
      method TEXT NOT NULL DEFAULT 'in_app',
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      dismissed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".calendar_event_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES "${s}".calendar_events(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(event_id, entity_type, entity_id, relation_type)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".planning_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      view_type TEXT NOT NULL DEFAULT 'calendar',
      filters JSONB,
      layout_config JSONB,
      is_default BOOLEAN NOT NULL DEFAULT false,
      is_system BOOLEAN NOT NULL DEFAULT false,
      is_shared BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".planning_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      event_id UUID REFERENCES "${s}".calendar_events(id) ON DELETE SET NULL,
      view_id UUID REFERENCES "${s}".planning_views(id) ON DELETE SET NULL,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_start" ON "${s}".calendar_events(start_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_end" ON "${s}".calendar_events(end_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_status" ON "${s}".calendar_events(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_type" ON "${s}".calendar_events(event_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_priority" ON "${s}".calendar_events(priority) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_owner" ON "${s}".calendar_events(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_assigned" ON "${s}".calendar_events(assigned_to_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_source_entity" ON "${s}".calendar_events(source_entity_type, source_entity_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_events_source_fingerprint" ON "${s}".calendar_events(source_fingerprint) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_calendar_events_fingerprint" ON "${s}".calendar_events(source_fingerprint) WHERE source_fingerprint IS NOT NULL AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_attendees_event" ON "${s}".calendar_event_attendees(event_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_attendees_user" ON "${s}".calendar_event_attendees(user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_attendees_contact" ON "${s}".calendar_event_attendees(contact_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_attendees_email" ON "${s}".calendar_event_attendees(lower(email))`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_attendees_response" ON "${s}".calendar_event_attendees(response_status)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_reminders_event" ON "${s}".calendar_event_reminders(event_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_reminders_due" ON "${s}".calendar_event_reminders(remind_at)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_reminders_status" ON "${s}".calendar_event_reminders(status)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_reminders_method" ON "${s}".calendar_event_reminders(method)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_links_event" ON "${s}".calendar_event_links(event_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_links_entity" ON "${s}".calendar_event_links(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_calendar_links_relation" ON "${s}".calendar_event_links(relation_type)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_views_type" ON "${s}".planning_views(view_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_views_default" ON "${s}".planning_views(is_default) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_views_system" ON "${s}".planning_views(is_system) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_action" ON "${s}".planning_activity(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_event" ON "${s}".planning_activity(event_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_view" ON "${s}".planning_activity(view_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_actor" ON "${s}".planning_activity(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_entity" ON "${s}".planning_activity(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_planning_activity_created" ON "${s}".planning_activity(created_at DESC)`,
  ];
  for (const sql of indexes) await ds.query(sql);
}

export async function seedTenantPlanningViews(ds: DataSource, schema: string, createdBy?: string | null) {
  const s = safeSchema(schema, 'seedTenantPlanningViews');
  await ensureTenantCalendarTables(ds, s);

  for (const view of BASE_PLANNING_VIEWS) {
    const rows = await ds.query(
      `SELECT id FROM "${s}".planning_views WHERE name = $1 AND view_type = $2 AND deleted_at IS NULL LIMIT 1`,
      [view.name, view.view_type],
    );
    if (rows[0]) {
      await ds.query(
        `UPDATE "${s}".planning_views
         SET filters = $3::jsonb,
             is_system = true,
             is_shared = true,
             updated_at = now()
         WHERE id = $4`,
        [view.name, view.view_type, JSON.stringify(view.filters || {}), rows[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".planning_views (
           name, view_type, filters, is_default, is_system, is_shared, created_by, created_at, updated_at
         )
         VALUES ($1, $2, $3::jsonb, false, true, true, $4, now(), now())`,
        [view.name, view.view_type, JSON.stringify(view.filters || {}), createdBy || null],
      );
    }
  }
}
