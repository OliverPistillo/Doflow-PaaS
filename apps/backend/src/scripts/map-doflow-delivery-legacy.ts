import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { normalizeProjectStage } from '../tenant/project-stage-model';

export type LegacyMapOptions = { target: 'doflow'; apply: boolean; confirm?: string };
export type LegacyProjectRow = {
  id: string; status: string | null; company_id?: string | null; lead_id?: string | null;
  opportunity_id?: string | null; quote_id?: string | null; project_manager_id?: string | null;
};

const AMBIGUOUS = new Set([
  'kickoff', 'materials_collection', 'materials', 'strategy', 'ux_ui', 'copy_content',
  'design', 'seo_performance', 'training',
]);

export function parseLegacyMapOptions(args: string[]): LegacyMapOptions {
  const target = args.find((arg) => arg.startsWith('--target='))?.slice('--target='.length);
  if (target !== 'doflow') throw new Error('Legacy Delivery mapping target must be exactly doflow');
  const apply = args.includes('--apply');
  return { target: 'doflow', apply, confirm: args.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length) };
}

export function classifyLegacyStatus(status: unknown) {
  const raw = String(status ?? '').trim().toLowerCase();
  if (AMBIGUOUS.has(raw)) return { raw, classification: 'ambiguous' as const, mapped: null };
  const normalized = normalizeProjectStage(raw);
  return normalized.mapped
    ? { raw, classification: normalized.isLegacy ? 'mapped' as const : 'canonical' as const, mapped: normalized.stage }
    : { raw, classification: 'unknown' as const, mapped: null };
}

export function buildLegacyMapReport(rows: LegacyProjectRow[]) {
  const statusCounts: Record<string, number> = {};
  const mappings: Record<string, string> = {};
  const ambiguous: Array<{ id: string; status: string }> = [];
  const unknown: Array<{ id: string; status: string }> = [];
  const applicable: Array<{ id: string; from: string; to: string }> = [];
  for (const row of rows) {
    const result = classifyLegacyStatus(row.status);
    statusCounts[result.raw || '(empty)'] = (statusCounts[result.raw || '(empty)'] || 0) + 1;
    if (result.classification === 'ambiguous') ambiguous.push({ id: row.id, status: result.raw });
    else if (result.classification === 'unknown') unknown.push({ id: row.id, status: result.raw });
    else if (result.mapped) {
      mappings[result.raw] = result.mapped;
      if (result.raw !== result.mapped) applicable.push({ id: row.id, from: result.raw, to: result.mapped });
    }
  }
  return {
    target: 'doflow', total: rows.length, statusCounts, mappings,
    applicableCount: applicable.length, ambiguousCount: ambiguous.length, unknownCount: unknown.length,
    ambiguous, unknown, applicable,
    preservation: ['id', 'company_id', 'lead_id', 'opportunity_id', 'quote_id', 'project_manager_id'],
    inventedHistory: false, inventedQa: false, inventedTimers: false,
  };
}

export async function mapDoflowDeliveryLegacy(
  dataSource: DataSource,
  options: LegacyMapOptions,
) {
  const rows: LegacyProjectRow[] = await dataSource.query(
    `SELECT id::text, status, company_id::text, lead_id::text, opportunity_id::text,
            quote_id::text, project_manager_id::text
     FROM doflow.projects WHERE deleted_at IS NULL ORDER BY id`,
  );
  const report = buildLegacyMapReport(rows);
  if (options.apply) {
    await dataSource.transaction(async (manager) => {
      for (const item of report.applicable) {
        await manager.query(
          `UPDATE doflow.projects SET status = $1, version = version + 1, updated_at = now()
           WHERE id = $2 AND status = $3`, [item.to, item.id, item.from],
        );
      }
    });
  }
  return {
    ...report,
    mode: options.apply ? 'apply' as const : 'dry-run' as const,
    appliedCount: options.apply ? report.applicableCount : 0,
  };
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required');
  return value;
}

function assertApplySafety(options: LegacyMapOptions, url: string) {
  if (!options.apply) return;
  const parsed = new URL(url);
  if (process.env.NODE_ENV !== 'test' || String(process.env.DB_SYNC).toLowerCase() !== 'false') {
    throw new Error('Apply is allowed only with NODE_ENV=test and DB_SYNC=false');
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Apply refuses a non-local PostgreSQL host');
  if (options.confirm !== 'isolated-doflow-delivery-map') throw new Error('Apply confirmation is missing');
}

export async function runLegacyMap(options: LegacyMapOptions) {
  const url = databaseUrl();
  assertApplySafety(options, url);
  const dataSource = new DataSource({ type: 'postgres', url, synchronize: false });
  await dataSource.initialize();
  try {
    const output = await mapDoflowDeliveryLegacy(dataSource, options);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runLegacyMap(parseLegacyMapOptions(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`[delivery:legacy-map] ${error instanceof Error ? error.message : 'failed'}\n`);
    process.exitCode = 1;
  });
}
