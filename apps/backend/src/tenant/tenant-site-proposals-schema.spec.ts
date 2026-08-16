import { DataSource } from 'typeorm';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { COLSOVA_TEMPLATE } from './tenant-site-proposals.constants';

function createRunner(queryImplementation?: (sql: string, params?: unknown[]) => Promise<unknown>) {
  const runner: any = { isTransactionActive: false };
  runner.connect = jest.fn().mockResolvedValue(undefined);
  runner.startTransaction = jest.fn().mockImplementation(async () => {
    runner.isTransactionActive = true;
  });
  runner.query = jest.fn().mockImplementation(queryImplementation || (async () => []));
  runner.commitTransaction = jest.fn().mockImplementation(async () => {
    runner.isTransactionActive = false;
  });
  runner.rollbackTransaction = jest.fn().mockImplementation(async () => {
    runner.isTransactionActive = false;
  });
  runner.release = jest.fn().mockResolvedValue(undefined);
  return runner;
}

function createDataSource(...runners: any[]) {
  const createQueryRunner = jest.fn();
  runners.forEach((runner) => createQueryRunner.mockReturnValueOnce(runner));
  return {
    dataSource: { createQueryRunner } as unknown as DataSource,
    createQueryRunner,
  };
}

describe('ensureDoflowSiteProposalTables', () => {
  it.each(['acme', 'public'])('rejects %s before creating a QueryRunner', (schema) => {
    const { dataSource, createQueryRunner } = createDataSource();
    expect(() => ensureDoflowSiteProposalTables(dataSource, schema)).toThrow('only for doflow');
    expect(createQueryRunner).not.toHaveBeenCalled();
  });

  it('locks before DDL and commits the canonical manifest in one transaction', async () => {
    const runner = createRunner();
    const { dataSource } = createDataSource(runner);

    await ensureDoflowSiteProposalTables(dataSource, 'doflow');

    expect(runner.connect).toHaveBeenCalledTimes(1);
    expect(runner.startTransaction).toHaveBeenCalledTimes(1);
    const lockCall = runner.query.mock.calls[0];
    expect(lockCall[0]).toBe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))');
    expect(lockCall[1]).toEqual(['doflow', 'site-proposals-schema-v1']);
    const firstCreateIndex = runner.query.mock.calls.findIndex(([sql]: [string]) => /CREATE (?:EXTENSION|TABLE|INDEX)/.test(sql));
    expect(firstCreateIndex).toBeGreaterThan(0);
    const archiveColumn = runner.query.mock.calls.find(([sql]: [string]) =>
      sql.includes('ALTER TABLE "doflow".site_proposals ADD COLUMN IF NOT EXISTS archived_from_status TEXT'),
    );
    expect(archiveColumn).toBeDefined();
    const ddl = runner.query.mock.calls.map(([sql]: [string]) => sql).join('\n');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "doflow".site_proposal_personalizations');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS personalization_status TEXT');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS latest_personalization_id UUID');
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS last_personalized_at TIMESTAMPTZ');
    expect(ddl).toContain('site_proposal_personalizations(proposal_id)');
    expect(ddl).toContain('site_proposal_personalizations(snapshot_hash)');
    expect(ddl).toContain('site_proposal_preparation_runs');
    expect(ddl).toContain('site_proposal_theme_storage_cleanup');
    expect(ddl).toContain('site_proposal_preparation_runs_active');
    expect(ddl).toContain("site_proposal_generations_running");
    expect(ddl).toContain('site_proposal_themes_global_default');
    expect(ddl).toContain("g.proposal_version=p.current_version");
    expect(ddl).not.toContain('WHERE p.preparation_status IS NULL');

    const seedCall = runner.query.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO "doflow".site_proposal_templates'));
    expect(seedCall).toBeDefined();
    expect(seedCall[0]).toContain('ON CONFLICT (slug, version) DO UPDATE');
    expect(seedCall[0]).not.toContain('DO NOTHING');
    const versionSeed = runner.query.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO "doflow".site_proposal_theme_versions'));
    expect(versionSeed[0]).toContain('WHERE "doflow".site_proposal_theme_versions.deleted_at IS NULL');
    expect(versionSeed[0]).not.toContain("status='active'");
    const manifest = JSON.parse(seedCall[1][5]);
    expect(manifest).toMatchObject({
      name: 'Tema Colsova',
      slug: 'colsova',
      version: '1.0.0',
      sourceSha256: COLSOVA_TEMPLATE.sourceSha256,
      fixedCounts: { treatmentCards: 3, productPoints: 3, reviews: 6, faqs: 6 },
    });
    expect(manifest.imageSlots).toHaveLength(10);
    expect(manifest.routes).toContain('bookingPage');
    expect(runner.startTransaction.mock.invocationCallOrder[0]).toBeLessThan(runner.query.mock.invocationCallOrder[0]);
    expect(runner.query.mock.invocationCallOrder.at(-1)).toBeLessThan(runner.commitTransaction.mock.invocationCallOrder[0]);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('shares one Promise and one provisioning run across 10 concurrent calls', async () => {
    const runner = createRunner();
    const { dataSource, createQueryRunner } = createDataSource(runner);

    const calls = Array.from({ length: 10 }, () => ensureDoflowSiteProposalTables(dataSource, 'doflow'));
    expect(new Set(calls).size).toBe(1);
    await expect(Promise.all(calls)).resolves.toHaveLength(10);

    expect(createQueryRunner).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    const templateInserts = runner.query.mock.calls.filter(([sql]: [string]) => sql.includes('INSERT INTO "doflow".site_proposal_templates'));
    expect(templateInserts).toHaveLength(5);
    expect(templateInserts.map((call: any[]) => `${call[1][0]}@${call[1][2]}`)).toEqual([
      'colsova@1.0.0',
      'colsova@2.0.0',
      'colsova@2.4.1',
      'aurea@1.2.0',
      'luce@1.2.0',
    ]);
  });

  it('keeps provisioning isolated between different DataSources', async () => {
    const runnerA = createRunner();
    const runnerB = createRunner();
    const sourceA = createDataSource(runnerA);
    const sourceB = createDataSource(runnerB);

    await Promise.all([
      ensureDoflowSiteProposalTables(sourceA.dataSource, 'doflow'),
      ensureDoflowSiteProposalTables(sourceB.dataSource, 'doflow'),
    ]);

    expect(sourceA.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(sourceB.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(runnerA.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runnerB.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('backfills legacy NULL progress and hardens the run percentage idempotently', async () => {
    let legacyRunProgress: number | null = null;
    const runner = createRunner(async (sql) => {
      if (sql.includes('UPDATE "doflow".site_proposal_preparation_runs') && sql.includes('progress_percent=COALESCE')) legacyRunProgress = legacyRunProgress ?? 0;
      return [];
    });
    const { dataSource } = createDataSource(runner);

    await ensureDoflowSiteProposalTables(dataSource, 'doflow');
    await ensureDoflowSiteProposalTables(dataSource, 'doflow');

    expect(legacyRunProgress).toBe(0);
    const ddl = runner.query.mock.calls.map(([sql]: [string]) => sql).join('\n');
    expect(ddl).toContain("progress_stage=COALESCE(NULLIF(BTRIM(progress_stage),''),CASE WHEN status='failed' THEN 'failed' ELSE 'waiting' END)");
    expect(ddl).toContain('progress_updated_at=COALESCE(progress_updated_at,updated_at,created_at,now())');
    expect(ddl).toContain('ALTER COLUMN progress_percent SET DEFAULT 0');
    expect(ddl).toContain('ALTER COLUMN progress_percent SET NOT NULL');
    expect(ddl).toContain("ALTER COLUMN progress_stage SET DEFAULT 'waiting'");
    expect(ddl).toContain('ALTER COLUMN progress_stage SET NOT NULL');
    expect(ddl).toContain("ALTER COLUMN progress_message SET DEFAULT 'In attesa'");
    expect(ddl).toContain('ALTER COLUMN progress_message SET NOT NULL');
    expect(runner.query.mock.calls.filter(([sql]: [string]) => sql.includes('UPDATE "doflow".site_proposal_preparation_runs') && sql.includes('progress_percent=COALESCE'))).toHaveLength(1);
  });

  it('repairs only NULL proposal progress fields with status-coherent defaults', async () => {
    const runner = createRunner();
    const { dataSource } = createDataSource(runner);
    await ensureDoflowSiteProposalTables(dataSource, 'doflow');
    const repair = runner.query.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE "doflow".site_proposals') && sql.includes('progress_percent=COALESCE'));
    expect(repair).toBeDefined();
    expect(repair[0]).toContain("WHEN preparation_status='failed' THEN 'failed'");
    expect(repair[0]).toContain("WHEN preparation_status IN ('ready','fallback') THEN 'ready'");
    expect(repair[0]).toContain("WHERE progress_percent IS NULL OR progress_stage IS NULL OR BTRIM(progress_stage)=''");
    const ddl = runner.query.mock.calls.map(([sql]: [string]) => sql).join('\n');
    expect(ddl.match(/site_proposals ALTER COLUMN progress_percent SET DEFAULT 0/g)).toHaveLength(1);
    expect(ddl.match(/site_proposals ALTER COLUMN progress_percent SET NOT NULL/g)).toHaveLength(1);
    expect(ddl.match(/site_proposals ALTER COLUMN progress_stage SET DEFAULT 'waiting'/g)).toHaveLength(1);
    expect(ddl.match(/site_proposals ALTER COLUMN progress_stage SET NOT NULL/g)).toHaveLength(1);
    expect(ddl.match(/site_proposals ALTER COLUMN progress_message SET DEFAULT 'In attesa'/g)).toHaveLength(1);
    expect(ddl.match(/site_proposals ALTER COLUMN progress_message SET NOT NULL/g)).toHaveLength(1);
  });

  it('removes a failed Promise from cache and retries with a new QueryRunner', async () => {
    const ddlError = new Error('DDL failed');
    const firstRunner = createRunner(async (sql) => {
      if (sql.includes('site_proposal_import_batches')) throw ddlError;
      return [];
    });
    const retryRunner = createRunner();
    const { dataSource, createQueryRunner } = createDataSource(firstRunner, retryRunner);

    await expect(ensureDoflowSiteProposalTables(dataSource, 'doflow')).rejects.toBe(ddlError);
    expect(firstRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(firstRunner.release).toHaveBeenCalledTimes(1);

    await expect(ensureDoflowSiteProposalTables(dataSource, 'doflow')).resolves.toBeUndefined();
    expect(createQueryRunner).toHaveBeenCalledTimes(2);
    expect(retryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('preserves the original DDL error when rollback and release also fail', async () => {
    const ddlError = new Error('original DDL failure');
    const runner = createRunner(async (sql) => {
      if (sql.includes('CREATE EXTENSION')) throw ddlError;
      return [];
    });
    runner.rollbackTransaction.mockRejectedValue(new Error('rollback failure'));
    runner.release.mockRejectedValue(new Error('release failure'));
    const { dataSource } = createDataSource(runner);

    await expect(ensureDoflowSiteProposalTables(dataSource, 'doflow')).rejects.toBe(ddlError);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});
