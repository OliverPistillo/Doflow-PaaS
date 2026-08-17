import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantProjectsTables } from './tenant-projects-schema';

export async function ensureDoflowTimelineSchema(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureDoflowTimelineSchema');
  await ensureTenantProjectsTables(ds, s);

  const columns = [
    'project_id UUID',
    'channel TEXT',
    'direction TEXT',
    'status TEXT',
    'outcome TEXT',
    "metadata JSONB DEFAULT '{}'::jsonb",
  ];
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS ${column}`);
  }

  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_project" ON "${s}".commercial_activities(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_timeline" ON "${s}".commercial_activities(created_at DESC, id DESC) WHERE deleted_at IS NULL`);
}
