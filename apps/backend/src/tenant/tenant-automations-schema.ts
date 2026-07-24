import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { BASE_AUTOMATION_TEMPLATES } from './tenant-automations.types';

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}".${table} ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantAutomationsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantAutomationsTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      trigger_type TEXT NOT NULL,
      default_conditions JSONB,
      default_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_schedule JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_system BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'automation_templates', [
    'key TEXT',
    'name TEXT',
    'description TEXT',
    "category TEXT NOT NULL DEFAULT 'general'",
    'trigger_type TEXT',
    'default_conditions JSONB',
    "default_actions JSONB NOT NULL DEFAULT '[]'::jsonb",
    'default_schedule JSONB',
    'is_active BOOLEAN NOT NULL DEFAULT true',
    'is_system BOOLEAN NOT NULL DEFAULT true',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID REFERENCES "${s}".automation_templates(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      trigger_type TEXT NOT NULL,
      trigger_config JSONB,
      conditions JSONB,
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      schedule_config JSONB,
      is_enabled BOOLEAN NOT NULL DEFAULT false,
      run_mode TEXT NOT NULL DEFAULT 'manual',
      priority TEXT NOT NULL DEFAULT 'medium',
      cooldown_minutes INTEGER NOT NULL DEFAULT 60,
      max_runs_per_day INTEGER NOT NULL DEFAULT 50,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      last_success_at TIMESTAMPTZ,
      last_error_at TIMESTAMPTZ,
      last_error_message TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'automation_rules', [
    'template_id UUID',
    'name TEXT',
    'description TEXT',
    "category TEXT NOT NULL DEFAULT 'general'",
    'trigger_type TEXT',
    'trigger_config JSONB',
    'conditions JSONB',
    "actions JSONB NOT NULL DEFAULT '[]'::jsonb",
    'schedule_config JSONB',
    'is_enabled BOOLEAN NOT NULL DEFAULT false',
    "run_mode TEXT NOT NULL DEFAULT 'manual'",
    "priority TEXT NOT NULL DEFAULT 'medium'",
    'cooldown_minutes INTEGER NOT NULL DEFAULT 60',
    'max_runs_per_day INTEGER NOT NULL DEFAULT 50',
    'last_run_at TIMESTAMPTZ',
    'next_run_at TIMESTAMPTZ',
    'last_success_at TIMESTAMPTZ',
    'last_error_at TIMESTAMPTZ',
    'last_error_message TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES "${s}".automation_rules(id) ON DELETE SET NULL,
      trigger_type TEXT NOT NULL,
      trigger_source TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TIMESTAMPTZ DEFAULT now(),
      finished_at TIMESTAMPTZ,
      duration_ms INTEGER,
      matched_count INTEGER NOT NULL DEFAULT 0,
      actions_count INTEGER NOT NULL DEFAULT 0,
      actions_success_count INTEGER NOT NULL DEFAULT 0,
      actions_failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_reason TEXT,
      error_message TEXT,
      input_payload JSONB,
      result_payload JSONB,
      actor_user_id UUID,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_action_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL REFERENCES "${s}".automation_runs(id) ON DELETE CASCADE,
      rule_id UUID REFERENCES "${s}".automation_rules(id) ON DELETE SET NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      target_entity_type TEXT,
      target_entity_id UUID,
      dedupe_key TEXT,
      message TEXT,
      error_message TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_dedupe (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES "${s}".automation_rules(id) ON DELETE CASCADE,
      dedupe_key TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      action_type TEXT,
      first_seen_at TIMESTAMPTZ DEFAULT now(),
      last_seen_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ,
      hit_count INTEGER NOT NULL DEFAULT 1,
      UNIQUE(rule_id, dedupe_key)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      rule_id UUID REFERENCES "${s}".automation_rules(id) ON DELETE SET NULL,
      template_id UUID REFERENCES "${s}".automation_templates(id) ON DELETE SET NULL,
      actor_user_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_automation_templates_key_active" ON "${s}".automation_templates(key) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_templates_category" ON "${s}".automation_templates(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_templates_trigger" ON "${s}".automation_templates(trigger_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_templates_active" ON "${s}".automation_templates(is_active) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_template" ON "${s}".automation_rules(template_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_category" ON "${s}".automation_rules(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_trigger" ON "${s}".automation_rules(trigger_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_enabled" ON "${s}".automation_rules(is_enabled) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_mode" ON "${s}".automation_rules(run_mode) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_next_run" ON "${s}".automation_rules(next_run_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_rules_last_run" ON "${s}".automation_rules(last_run_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_runs_rule" ON "${s}".automation_runs(rule_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_runs_trigger" ON "${s}".automation_runs(trigger_type)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_runs_status" ON "${s}".automation_runs(status)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_runs_started" ON "${s}".automation_runs(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_runs_actor" ON "${s}".automation_runs(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_run" ON "${s}".automation_action_logs(run_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_rule" ON "${s}".automation_action_logs(rule_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_type" ON "${s}".automation_action_logs(action_type)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_status" ON "${s}".automation_action_logs(status)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_entity" ON "${s}".automation_action_logs(target_entity_type, target_entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_action_logs_dedupe" ON "${s}".automation_action_logs(dedupe_key)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_dedupe_key" ON "${s}".automation_dedupe(dedupe_key)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_dedupe_entity" ON "${s}".automation_dedupe(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_dedupe_expires" ON "${s}".automation_dedupe(expires_at)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_activity_action" ON "${s}".automation_activity(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_activity_rule" ON "${s}".automation_activity(rule_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_activity_template" ON "${s}".automation_activity(template_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_activity_actor" ON "${s}".automation_activity(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_activity_created" ON "${s}".automation_activity(created_at DESC)`,
  ];
  for (const sql of indexes) await ds.query(sql);
}

export async function seedTenantAutomationTemplatesAndRules(ds: DataSource, schema: string, createdBy?: string | null) {
  const s = safeSchema(schema, 'seedTenantAutomationTemplatesAndRules');
  await ensureTenantAutomationsTables(ds, s);

  for (const tpl of BASE_AUTOMATION_TEMPLATES) {
    const templateRows = await ds.query(
      `
      INSERT INTO "${s}".automation_templates (
        key, name, description, category, trigger_type, default_conditions,
        default_actions, default_schedule, is_active, is_system, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, true, true, now(), now())
      ON CONFLICT (key) WHERE deleted_at IS NULL DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            trigger_type = EXCLUDED.trigger_type,
            default_conditions = EXCLUDED.default_conditions,
            default_actions = EXCLUDED.default_actions,
            default_schedule = EXCLUDED.default_schedule,
            is_active = true,
            is_system = true,
            updated_at = now()
      RETURNING id
      `,
      [
        tpl.key,
        tpl.name,
        tpl.description,
        tpl.category,
        tpl.trigger_type,
        tpl.default_conditions === undefined ? null : JSON.stringify(tpl.default_conditions),
        JSON.stringify(tpl.default_actions || []),
        tpl.default_schedule === undefined ? null : JSON.stringify(tpl.default_schedule),
      ],
    );

    const existing = await ds.query(
      `SELECT id FROM "${s}".automation_rules WHERE template_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [templateRows[0].id],
    );
    if (existing[0]) {
      await ds.query(
        `UPDATE "${s}".automation_rules
         SET name = $2,
             description = $3,
             category = $4,
             trigger_type = $5,
             conditions = $6::jsonb,
             actions = $7::jsonb,
             schedule_config = $8::jsonb,
             run_mode = $9,
             priority = $10,
             cooldown_minutes = $11,
             updated_at = now()
         WHERE id = $1`,
        [
          existing[0].id,
          tpl.name,
          tpl.description,
          tpl.category,
          tpl.trigger_type,
          tpl.default_conditions === undefined ? null : JSON.stringify(tpl.default_conditions),
          JSON.stringify(tpl.default_actions || []),
          tpl.default_schedule === undefined ? null : JSON.stringify(tpl.default_schedule),
          tpl.run_mode || 'manual',
          tpl.priority || 'medium',
          tpl.cooldown_minutes ?? 60,
        ],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".automation_rules (
          template_id, name, description, category, trigger_type, trigger_config,
          conditions, actions, schedule_config, is_enabled, run_mode, priority,
          cooldown_minutes, max_runs_per_day, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11, $12, 50, $13, now(), now())`,
        [
          templateRows[0].id,
          tpl.name,
          tpl.description,
          tpl.category,
          tpl.trigger_type,
          tpl.default_conditions === undefined ? null : JSON.stringify(tpl.default_conditions),
          JSON.stringify(tpl.default_actions || []),
          tpl.default_schedule === undefined ? null : JSON.stringify(tpl.default_schedule),
          Boolean(tpl.default_enabled),
          tpl.run_mode || 'manual',
          tpl.priority || 'medium',
          tpl.cooldown_minutes ?? 60,
          createdBy || null,
        ],
      );
    }
  }
}
