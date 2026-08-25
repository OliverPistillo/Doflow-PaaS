import { DataSource } from 'typeorm';
import { ensureDoflowCollaborationTables } from '../tenant/tenant-doflow-collaboration-schema';

export function parseCollaborationLegacyOptions(argv: string[]) {
  const apply = argv.includes('--apply');
  const tenant = (argv.find((arg) => arg.startsWith('--tenant='))?.slice(9) || 'doflow').toLowerCase();
  if (tenant !== 'doflow') throw new Error('Collaboration mapping is restricted to tenant doflow');
  return { tenant, apply };
}

export function buildCollaborationLegacyReport(source: number, mapped: number, ambiguous: number, target: number) {
  return { tenant: 'doflow', sourceProjectComments: source, eligible: mapped, ambiguous, alreadyMapped: target };
}

export type CollaborationLegacyMapOptions = {
  tenant: 'doflow';
  apply: boolean;
};

export async function mapDoflowCollaborationLegacy(
  dataSource: DataSource,
  options: CollaborationLegacyMapOptions,
) {
  const table = await dataSource.query(`SELECT to_regclass('"doflow".project_comments') AS name`);
  if (!table[0]?.name) {
    return {
      ...buildCollaborationLegacyReport(0, 0, 0, 0),
      mode: options.apply ? 'apply' as const : 'dry-run' as const,
    };
  }
  const counts = (await dataSource.query(`
    SELECT COUNT(*)::int AS source,
      COUNT(*) FILTER (WHERE pc.body IS NOT NULL AND btrim(pc.body) <> '' AND pc.created_by IS NOT NULL
        AND COALESCE(pc.project_id, t.project_id) IS NOT NULL)::int AS eligible,
      COUNT(*) FILTER (WHERE pc.body IS NULL OR btrim(pc.body) = '' OR pc.created_by IS NULL
        OR COALESCE(pc.project_id, t.project_id) IS NULL)::int AS ambiguous
    FROM "doflow".project_comments pc
    LEFT JOIN "doflow".tasks t ON t.id = pc.task_id AND t.deleted_at IS NULL
    WHERE pc.deleted_at IS NULL
  `))[0];
  const target = Number((await dataSource.query(`SELECT COUNT(*)::int AS count FROM "doflow".record_comments WHERE legacy_source_type = 'project_comment'`))[0]?.count || 0);
  const report = buildCollaborationLegacyReport(Number(counts.source), Number(counts.eligible), Number(counts.ambiguous), target);
  if (options.apply) {
    await dataSource.transaction(async (manager) => {
      await manager.query(`
        INSERT INTO "doflow".record_comments
          (id, record_type, record_id, author_id, body, visibility, created_at, updated_at, deleted_at,
           legacy_source_type, legacy_source_id)
        SELECT pc.id, 'project', COALESCE(pc.project_id, t.project_id), pc.created_by, pc.body,
               COALESCE(pc.visibility, 'internal'), pc.created_at, COALESCE(pc.updated_at, pc.created_at), NULL,
               'project_comment', pc.id
        FROM "doflow".project_comments pc
        LEFT JOIN "doflow".tasks t ON t.id = pc.task_id AND t.deleted_at IS NULL
        WHERE pc.deleted_at IS NULL AND pc.body IS NOT NULL AND btrim(pc.body) <> ''
          AND pc.created_by IS NOT NULL AND COALESCE(pc.project_id, t.project_id) IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
    });
  }
  return {
    ...report,
    mode: options.apply ? 'apply' as const : 'dry-run' as const,
  };
}

async function run() {
  const options = parseCollaborationLegacyOptions(process.argv.slice(2));
  if (process.env.NODE_ENV === 'production') throw new Error('Legacy mapping cannot run in production');
  const host = String(process.env.DB_HOST || '');
  const database = String(process.env.DB_NAME || '');
  if (!['localhost', '127.0.0.1', 'doflow-acceptance-postgres'].includes(host) || !/acceptance/i.test(database)) {
    throw new Error('Legacy mapping requires an isolated acceptance database');
  }
  const dataSource = new DataSource({
    type: 'postgres', host, port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER, password: process.env.DB_PASSWORD, database, synchronize: false,
  });
  await dataSource.initialize();
  try {
    await ensureDoflowCollaborationTables(dataSource, options.tenant);
    const output = await mapDoflowCollaborationLegacy(dataSource, {
      tenant: 'doflow',
      apply: options.apply,
    });
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return output;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) void run().catch((error) => {
  process.stderr.write(`[collaboration:legacy-map] ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
});
