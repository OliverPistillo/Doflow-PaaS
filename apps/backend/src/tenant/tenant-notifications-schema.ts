import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export type NotificationRuleSeed = {
  key: string;
  name: string;
  description: string;
  category: 'crm' | 'quotes' | 'briefing' | 'projects' | 'finance' | 'renewals' | 'system';
  severity: 'low' | 'medium' | 'high' | 'urgent';
  targetRoles?: string[];
  config?: Record<string, unknown>;
};

export const BASE_NOTIFICATION_RULES: NotificationRuleSeed[] = [
  { key: 'task_overdue', name: 'Task scaduti', description: 'Avvisa quando un task assegnato e aperto e scaduto.', category: 'projects', severity: 'high' },
  { key: 'task_due_today', name: 'Task in scadenza oggi', description: 'Avvisa sui task aperti con scadenza nella giornata corrente.', category: 'projects', severity: 'medium' },
  { key: 'milestone_overdue', name: 'Milestone scadute', description: 'Avvisa i responsabili quando una milestone non completata e scaduta.', category: 'projects', severity: 'high', targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'milestone_due_soon', name: 'Milestone in scadenza', description: 'Avvisa sulle milestone in scadenza entro 7 giorni.', category: 'projects', severity: 'medium', config: { days: 7 }, targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'project_blocked', name: 'Progetti bloccati', description: 'Avvisa PM e direzione quando un progetto e bloccato.', category: 'projects', severity: 'urgent', targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'project_due_soon', name: 'Progetti in consegna', description: 'Avvisa sui progetti con due date entro 7 giorni.', category: 'projects', severity: 'medium', config: { days: 7 }, targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'quote_sent_follow_up_7_days', name: 'Follow-up preventivi inviati', description: 'Avvisa sui preventivi inviati senza risposta da almeno 7 giorni.', category: 'quotes', severity: 'medium', config: { days: 7 }, targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'quote_draft_stale_14_days', name: 'Preventivi bozza fermi', description: 'Avvisa sui preventivi in bozza da oltre 14 giorni.', category: 'quotes', severity: 'low', config: { days: 14 }, targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'briefing_incomplete_3_days', name: 'Briefing incompleti', description: 'Avvisa sui briefing incompleti da oltre 3 giorni.', category: 'briefing', severity: 'medium', config: { days: 3 }, targetRoles: ['manager', 'owner', 'admin', 'superadmin'] },
  { key: 'invoice_overdue', name: 'Fatture scadute', description: 'Avvisa CEO/Admin sulle fatture scadute non saldate.', category: 'finance', severity: 'urgent', targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'invoice_due_soon', name: 'Fatture in scadenza', description: 'Avvisa CEO/Admin sulle fatture in scadenza entro 7 giorni.', category: 'finance', severity: 'high', config: { days: 7 }, targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'financial_deadline_due_soon', name: 'Scadenze economiche prossime', description: 'Avvisa CEO/Admin sulle scadenze finance aperte entro 7 giorni.', category: 'finance', severity: 'high', config: { days: 7 }, targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'renewal_due_30_days', name: 'Rinnovi in scadenza', description: 'Avvisa CEO/Admin sui rinnovi entro 30 giorni.', category: 'renewals', severity: 'medium', config: { days: 30 }, targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'recurring_service_due_30_days', name: 'Servizi ricorrenti in scadenza', description: 'Avvisa CEO/Admin sui servizi ricorrenti entro 30 giorni.', category: 'renewals', severity: 'medium', config: { days: 30 }, targetRoles: ['owner', 'admin', 'superadmin'] },
  { key: 'daily_digest', name: 'Digest giornaliero', description: 'Genera un riepilogo interno giornaliero, senza inviare email.', category: 'system', severity: 'low', targetRoles: ['owner', 'admin', 'superadmin', 'manager'] },
];

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}".${table} ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantNotificationsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantNotificationsTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      recipient_user_id UUID,
      recipient_role TEXT,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'unread',
      entity_type TEXT,
      entity_id UUID,
      link_url TEXT,
      fingerprint TEXT,
      metadata JSONB,
      read_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'notifications', [
    'recipient_user_id UUID',
    'recipient_role TEXT',
    'title TEXT',
    'body TEXT',
    'type TEXT',
    "priority TEXT NOT NULL DEFAULT 'medium'",
    "status TEXT NOT NULL DEFAULT 'unread'",
    'entity_type TEXT',
    'entity_id UUID',
    'link_url TEXT',
    'fingerprint TEXT',
    'metadata JSONB',
    'read_at TIMESTAMPTZ',
    'archived_at TIMESTAMPTZ',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".notification_rules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'system',
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      severity TEXT NOT NULL DEFAULT 'medium',
      target_roles TEXT[],
      config JSONB,
      last_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'notification_rules', [
    'key TEXT',
    'name TEXT',
    'description TEXT',
    "category TEXT NOT NULL DEFAULT 'system'",
    'is_enabled BOOLEAN NOT NULL DEFAULT true',
    "severity TEXT NOT NULL DEFAULT 'medium'",
    'target_roles TEXT[]',
    'config JSONB',
    'last_run_at TIMESTAMPTZ',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".notification_rule_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      rule_key TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      notifications_created INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT now(),
      finished_at TIMESTAMPTZ,
      error_message TEXT,
      metadata JSONB
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".notification_preferences (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      muted_types TEXT[],
      muted_priorities TEXT[],
      daily_digest_enabled BOOLEAN NOT NULL DEFAULT true,
      digest_time TEXT DEFAULT '08:30',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".notification_digests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      role TEXT,
      digest_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      title TEXT NOT NULL,
      summary JSONB,
      notification_ids UUID[],
      created_at TIMESTAMPTZ DEFAULT now(),
      read_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_notifications_fingerprint_active" ON "${s}".notifications(fingerprint) WHERE fingerprint IS NOT NULL AND deleted_at IS NULL AND status <> 'archived'`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_user_status" ON "${s}".notifications(recipient_user_id, status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_role_status" ON "${s}".notifications(recipient_role, status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_type" ON "${s}".notifications(type) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_priority" ON "${s}".notifications(priority) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_entity" ON "${s}".notifications(entity_type, entity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notifications_fingerprint" ON "${s}".notifications(fingerprint) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_notification_rules_key_active" ON "${s}".notification_rules(key) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notification_rules_enabled" ON "${s}".notification_rules(is_enabled) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notification_rule_runs_key_started" ON "${s}".notification_rule_runs(rule_key, started_at DESC)`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_notification_preferences_user_active" ON "${s}".notification_preferences(user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notification_digests_user_date" ON "${s}".notification_digests(user_id, digest_date DESC) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_notification_digests_role_date" ON "${s}".notification_digests(role, digest_date DESC) WHERE deleted_at IS NULL`);
}

export async function seedTenantNotificationRules(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedTenantNotificationRules');
  await ensureTenantNotificationsTables(ds, s);

  for (const rule of BASE_NOTIFICATION_RULES) {
    await ds.query(
      `
      INSERT INTO "${s}".notification_rules (
        key, name, description, category, is_enabled, severity, target_roles, config,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, true, $5, $6, $7::jsonb, now(), now())
      ON CONFLICT (key) WHERE deleted_at IS NULL DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            severity = EXCLUDED.severity,
            target_roles = EXCLUDED.target_roles,
            config = COALESCE("${s}".notification_rules.config, EXCLUDED.config),
            updated_at = now()
      `,
      [
        rule.key,
        rule.name,
        rule.description,
        rule.category,
        rule.severity,
        rule.targetRoles || null,
        JSON.stringify(rule.config || {}),
      ],
    );
  }
}
