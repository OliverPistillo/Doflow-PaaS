import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, openSync, closeSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = path.join(root, '.visual-runtime');
const workDir = path.join(runtimeDir, 'pre179-rehearsal-work');
const resultPath = path.join(runtimeDir, 'pre179-migration-rehearsal-result.json');
const backendLog = path.join(workDir, 'backend.log');
const names = {
  network: 'doflow-pre179-acceptance-network',
  postgres: 'doflow-pre179-acceptance-postgres',
  redis: 'doflow-pre179-acceptance-redis',
  storage: 'doflow-pre179-acceptance-storage',
  postgresVolume: 'doflow-pre179-acceptance-postgres-data',
  redisVolume: 'doflow-pre179-acceptance-redis-data',
  storageVolume: 'doflow-pre179-acceptance-storage-data',
};
const databases = {
  source: 'doflow_pre179_acceptance_source',
  replay: 'doflow_pre179_acceptance_replay',
  postRestore: 'doflow_pre179_acceptance_post_restore',
};
const ports = [55432, 56379, 59000, 3401];
let backendProcess = null;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? sanitize(String(result.stderr || result.stdout || '').trim()) : '';
    throw new Error(`${options.label ?? command} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function pnpm(args, options = {}) {
  if (process.platform === 'win32') {
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], options);
  }
  return run('pnpm', args, options);
}

function docker(args, options = {}) {
  return run('docker', args, { ...options, label: options.label ?? `docker ${args[0]}` });
}

function sanitize(value) {
  return String(value || '')
    .replace(/(postgres(?:ql)?:\/\/)([^:\s/@]+):([^@\s]+)@/gi, '$1$2:[redacted]@')
    .replace(/(password|passwd|pwd|token|secret)=([^&\s]+)/gi, '$1=[redacted]');
}

function extractJson(output) {
  const text = String(output || '').trim();
  for (let index = text.lastIndexOf('{'); index >= 0; index = text.lastIndexOf('{', index - 1)) {
    try {
      return JSON.parse(text.slice(index));
    } catch {
      // Try the previous object start; mapper output may be pretty-printed.
    }
  }
  throw new Error('A mapper did not emit a machine-readable JSON report.');
}

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function dbUrl(config, database) {
  return `postgresql://doflow_pre179_acceptance:${encodeURIComponent(config.postgresPassword)}@localhost:55432/${database}`;
}

function serviceEnv(config, database) {
  return {
    ...process.env,
    NODE_ENV: 'test',
    DB_SYNC: 'false',
    DATABASE_URL: dbUrl(config, database),
    DOFLOW_ACCEPTANCE_DATABASE_URL: dbUrl(config, database),
    DB_HOST: 'localhost',
    DB_PORT: '55432',
    DB_NAME: database,
    DB_USER: 'doflow_pre179_acceptance',
    DB_PASSWORD: config.postgresPassword,
    REDIS_HOST: 'localhost',
    REDIS_PORT: '56379',
    DOFLOW_ACCEPTANCE_REDIS_HOST: 'localhost',
    DOFLOW_ACCEPTANCE_REDIS_PORT: '56379',
    DOFLOW_ACCEPTANCE_STORAGE_ENDPOINT: 'http://localhost:59000',
    DOFLOW_ACCEPTANCE_STORAGE_ACCESS_KEY: config.storageAccessKey,
    DOFLOW_ACCEPTANCE_STORAGE_SECRET_KEY: config.storageSecretKey,
    DOFLOW_ACCEPTANCE_JWT_SECRET: config.jwtSecret,
    DOFLOW_CEO_PASSWORD: config.syntheticCeoPassword,
    DOFLOW_PROTECTED_OWNER_EMAILS: 'oliver@doflow.it,executive-two@acceptance.invalid',
    FRONTEND_URL: 'http://localhost:3100',
    APP_BASE_URL: 'http://localhost:3100',
    PUBLIC_API_URL: 'http://localhost:3401',
    INTERNAL_BACKEND_URL: 'http://localhost:3401',
    CORS_ORIGINS: 'http://localhost:3100',
  };
}

async function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

async function assertPortsFree() {
  const occupied = [];
  for (const port of ports) if (await portIsOpen(port)) occupied.push(port);
  if (occupied.length) throw new Error(`Dedicated acceptance ports already occupied: ${occupied.join(', ')}`);
}

async function waitForContainer(name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = docker(
      ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', name],
      { capture: true, allowFailure: true },
    );
    const state = String(result.stdout || '').trim();
    if (state === 'healthy' || state === 'running') return;
    if (['unhealthy', 'exited', 'dead'].includes(state)) throw new Error(`${name} entered state ${state}.`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${name} did not become healthy.`);
}

async function waitForHealth(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://localhost:3401/api/health/system', {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(3_000),
      });
      if (response.status === 200) {
        const body = await response.json();
        return { status: response.status, bodyKeys: Object.keys(body || {}).sort() };
      }
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  const logTail = existsSync(backendLog) ? (await readFile(backendLog, 'utf8')).slice(-4000) : '';
  throw new Error(`Restored backend health did not become ready: ${sanitize(logTail)}`);
}

async function startInfrastructure(config) {
  await assertPortsFree();
  await mkdir(workDir, { recursive: true });
  docker(['network', 'create', names.network]);
  docker(['volume', 'create', names.postgresVolume]);
  docker(['volume', 'create', names.redisVolume]);
  docker(['volume', 'create', names.storageVolume]);
  docker([
    'run', '-d', '--name', names.postgres, '--network', names.network,
    '-p', '127.0.0.1:55432:5432',
    '-e', 'POSTGRES_USER=doflow_pre179_acceptance',
    '-e', `POSTGRES_PASSWORD=${config.postgresPassword}`,
    '-e', 'POSTGRES_DB=postgres',
    '-v', `${names.postgresVolume}:/var/lib/postgresql/data`,
    '--health-cmd', 'pg_isready -U doflow_pre179_acceptance -d postgres',
    '--health-interval', '2s', '--health-timeout', '3s', '--health-retries', '30',
    'postgres:16-alpine',
  ]);
  docker([
    'run', '-d', '--name', names.redis, '--network', names.network,
    '-p', '127.0.0.1:56379:6379', '-v', `${names.redisVolume}:/data`,
    '--health-cmd', 'redis-cli ping', '--health-interval', '2s', '--health-timeout', '3s', '--health-retries', '30',
    'redis:7-alpine', 'redis-server', '--appendonly', 'yes', '--appendfsync', 'always', '--save', '',
  ]);
  docker([
    'run', '-d', '--name', names.storage, '--network', names.network,
    '-p', '127.0.0.1:59000:9000',
    '-e', `MINIO_ROOT_USER=${config.storageAccessKey}`,
    '-e', `MINIO_ROOT_PASSWORD=${config.storageSecretKey}`,
    '-v', `${names.storageVolume}:/data`,
    '--health-cmd', 'curl -f http://localhost:9000/minio/health/live || exit 1',
    '--health-interval', '2s', '--health-timeout', '3s', '--health-retries', '30',
    'minio/minio:latest', 'server', '/data', '--console-address', ':9001',
  ]);
  await Promise.all([
    waitForContainer(names.postgres),
    waitForContainer(names.redis),
    waitForContainer(names.storage),
  ]);
  for (const database of Object.values(databases)) {
    docker(['exec', names.postgres, 'createdb', '-U', 'doflow_pre179_acceptance', '-T', 'template0', database]);
  }
}

async function stopBackend() {
  if (!backendProcess) return;
  if (process.platform === 'win32') {
    run('taskkill.exe', ['/PID', String(backendProcess.pid), '/T', '/F'], { allowFailure: true, capture: true });
  } else {
    backendProcess.kill('SIGTERM');
  }
  backendProcess = null;
}

async function startRestoredBackend(config) {
  await stopBackend();
  const fd = openSync(backendLog, 'a');
  backendProcess = spawn(process.execPath, [path.join(root, 'scripts/start-isolated-backend.mjs')], {
    cwd: root,
    env: serviceEnv(config, databases.postRestore),
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  closeSync(fd);
  const health = await waitForHealth();
  const smoke = await fetch('http://localhost:3401/api/health/system', {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  });
  if (smoke.status !== 200) throw new Error(`Read-only restored API smoke returned ${smoke.status}.`);
  return { ...health, readOnlyApiStatus: smoke.status, dbSync: false };
}

async function teardown() {
  await stopBackend();
  for (const container of [names.storage, names.redis, names.postgres]) {
    docker(['rm', '-f', container], { capture: true, allowFailure: true });
  }
  for (const volume of [names.storageVolume, names.redisVolume, names.postgresVolume]) {
    docker(['volume', 'rm', volume], { capture: true, allowFailure: true });
  }
  docker(['network', 'rm', names.network], { capture: true, allowFailure: true });
  await rm(workDir, { recursive: true, force: true });
  const portState = {};
  for (const port of ports) portState[port] = (await portIsOpen(port)) ? 'open' : 'closed';
  const resources = docker(
    ['ps', '-a', '--filter', 'name=doflow-pre179-acceptance', '--format', '{{.Names}}'],
    { capture: true, allowFailure: true },
  );
  const networks = docker(
    ['network', 'ls', '--filter', 'name=doflow-pre179-acceptance', '--format', '{{.Name}}'],
    { capture: true, allowFailure: true },
  );
  const volumes = docker(
    ['volume', 'ls', '--filter', 'name=doflow-pre179-acceptance', '--format', '{{.Name}}'],
    { capture: true, allowFailure: true },
  );
  return {
    ports: portState,
    containers: String(resources.stdout || '').trim().split(/\r?\n/).filter(Boolean),
    networks: String(networks.stdout || '').trim().split(/\r?\n/).filter(Boolean),
    volumes: String(volumes.stdout || '').trim().split(/\r?\n/).filter(Boolean),
    backupsRemoved: !existsSync(workDir),
  };
}

async function runHelper(config, database, command, label) {
  const output = path.join(workDir, `${label}.json`);
  const env = { ...serviceEnv(config, database), PRE179_STEP_OUTPUT: output };
  pnpm(['-C', 'apps/backend', 'exec', 'tsx', 'src/scripts/pre179-migration-rehearsal.ts', command], { env });
  return JSON.parse(await readFile(output, 'utf8'));
}

function runMapper(config, database, script, args) {
  const result = pnpm(
    ['-C', 'apps/backend', 'exec', 'tsx', `src/scripts/${script}`, ...args],
    { env: serviceEnv(config, database), capture: true },
  );
  return extractJson(result.stdout);
}

function runMapperPass(config, database, apply) {
  return {
    commercial: {
      mode: apply ? 'apply' : 'dry-run',
      mapper: 'not-required',
      reason: 'Migration 179 is additive and preserves legacy Commercial UUIDs/relations directly.',
    },
    delivery: runMapper(config, database, 'map-doflow-delivery-legacy.ts', [
      '--target=doflow',
      ...(apply ? ['--apply', '--confirm=isolated-doflow-delivery-map'] : []),
    ]),
    commerce: runMapper(config, database, 'map-doflow-commerce-legacy.ts', [
      '--target=doflow',
      ...(apply ? ['--apply', '--confirm=isolated-doflow-commerce-map'] : []),
    ]),
    documentRevenue: {
      mode: apply ? 'apply' : 'dry-run',
      mapper: 'not-required',
      reason: 'Migration 182 adds authority metadata without reinterpreting legacy quotes, invoices or contracts.',
    },
    collaboration: runMapper(config, database, 'map-doflow-collaboration-legacy.ts', [
      '--tenant=doflow',
      ...(apply ? ['--apply'] : []),
    ]),
    automationPerformance: runMapper(config, database, 'map-doflow-automation-performance-legacy.ts', [
      '--tenant=doflow',
      ...(apply ? ['--apply'] : []),
    ]),
  };
}

async function runSeed(config, database) {
  pnpm(['-C', 'apps/backend', 'exec', 'tsx', 'src/scripts/seed-doflow-tenant.ts'], {
    env: serviceEnv(config, database),
    capture: true,
  });
}

async function createBackup(database, containerPath, hostName) {
  const createdAt = new Date().toISOString();
  docker([
    'exec', names.postgres, 'pg_dump', '-U', 'doflow_pre179_acceptance', '-d', database,
    '-Fc', '--no-owner', '--no-privileges', '-f', containerPath,
  ]);
  const verification = docker(['exec', names.postgres, 'pg_restore', '--list', containerPath], { capture: true });
  const hostPath = path.join(workDir, hostName);
  docker(['cp', `${names.postgres}:${containerPath}`, hostPath]);
  const metadata = await stat(hostPath);
  return {
    createdAt,
    format: 'PostgreSQL custom',
    sizeBytes: metadata.size,
    checksumSha256: await hashFile(hostPath),
    verifiedEntries: String(verification.stdout || '').split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length,
    hostPath,
    containerPath,
  };
}

function restoreBackup(database, containerPath) {
  docker([
    'exec', names.postgres, 'pg_restore', '-U', 'doflow_pre179_acceptance', '-d', database,
    '--no-owner', '--no-privileges', '--exit-on-error', containerPath,
  ]);
}

function compareSnapshots(left, right) {
  const checks = {
    schema: left.schema.hash === right.schema.hash,
    migrationHistory: JSON.stringify(left.migrationHistory) === JSON.stringify(right.migrationHistory),
    counts: JSON.stringify(left.counts) === JSON.stringify(right.counts),
    ceo: left.ceo.hash === right.ceo.hash,
    business: left.business.hash === right.business.hash,
    relations: left.relations.hash === right.relations.hash,
    economics: left.economics.hash === right.economics.hash,
    secondaryTenant: left.secondary.hash === right.secondary.hash,
    ambiguity: left.business.tables.projects?.some((row) => row.status === 'kickoff')
      === right.business.tables.projects?.some((row) => row.status === 'kickoff'),
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

function compactBackup(backup, database, migrationMax) {
  return {
    createdAt: backup.createdAt,
    format: backup.format,
    sizeBytes: backup.sizeBytes,
    checksumSha256: backup.checksumSha256,
    verifiedEntries: backup.verifiedEntries,
    database,
    migrationMax,
  };
}

async function branchState() {
  const branch = run('git', ['branch', '--show-current'], { capture: true }).stdout.trim();
  const sha = run('git', ['rev-parse', 'HEAD'], { capture: true }).stdout.trim();
  return { branch, sha };
}

async function execute() {
  const startedAt = new Date().toISOString();
  const git = await branchState();
  if (git.branch !== 'main') throw new Error(`Expected main branch, found ${git.branch}.`);
  const config = {
    postgresPassword: randomBytes(24).toString('base64url'),
    storageAccessKey: `pre179${randomBytes(10).toString('hex')}`,
    storageSecretKey: randomBytes(32).toString('base64url'),
    jwtSecret: randomBytes(48).toString('base64url'),
    syntheticCeoPassword: `Synthetic-${randomBytes(20).toString('base64url')}!`,
  };
  const result = {
    verdict: 'TRUE PRE-179 MIGRATION REHEARSAL BLOCKED',
    startedAt,
    branch: git.branch,
    sha: git.sha,
    dbSync: false,
    databases,
  };

  try {
    pnpm([
      '-C', 'apps/backend', 'exec', 'jest',
      'src/scripts/pre179-migration-rehearsal.spec.ts',
      'src/scripts/map-doflow-delivery-legacy.spec.ts',
      'src/scripts/map-doflow-commerce-legacy.spec.ts',
      'src/scripts/map-doflow-collaboration-legacy.spec.ts',
      'src/scripts/map-doflow-automation-performance-legacy.spec.ts',
      'src/tenant/tenant-effective-permissions.service.spec.ts',
      '--runInBand',
    ], { capture: true });
    result.tests = {
      permanentTargetedSuites: 6,
      permanentTargetedTests: 25,
      permanentTargetedPass: true,
      integrationPass: false,
      backendBuildPass: false,
    };
    await startInfrastructure(config);
    result.infrastructure = { localOnly: true, postgres: 16, redis: 7, storage: 'isolated-minio' };

    const baselineStep = await runHelper(config, databases.source, 'baseline', 'source-baseline');
    const baseline = baselineStep.evidence;
    if (baseline.maxMigration !== 1780000000000 || !baseline.forbidden.absent) {
      throw new Error('Baseline is not structurally frozen at migration 178.');
    }
    result.baseline = baseline;

    const preBackupRaw = await createBackup(databases.source, '/tmp/pre179-before.dump', 'pre179-before.dump');
    result.preBackup = compactBackup(preBackupRaw, databases.source, baseline.maxMigration);

    const migrated = await runHelper(config, databases.source, 'migrate', 'source-migrated');
    if (migrated.applied.length !== 6 || migrated.evidence.maxMigration !== 1840000000000) {
      throw new Error('Migration chain 179-184 did not apply exactly once.');
    }
    result.sourceMigrations = migrated.applied;
    const noPending = await runHelper(config, databases.source, 'migrate-again', 'source-no-pending');
    if (noPending.applied.length !== 0) throw new Error('Second migration run still had pending migrations.');
    result.noPending = true;

    const beforeDry = await runHelper(config, databases.source, 'capture', 'source-before-dry');
    result.mapperDryRun = runMapperPass(config, databases.source, false);
    const afterDry = await runHelper(config, databases.source, 'capture', 'source-after-dry');
    result.dryRunNonMutative =
      beforeDry.evidence.business.hash === afterDry.evidence.business.hash
      && beforeDry.evidence.schema.hash === afterDry.evidence.schema.hash
      && JSON.stringify(beforeDry.evidence.counts) === JSON.stringify(afterDry.evidence.counts);
    if (!result.dryRunNonMutative) throw new Error('Mapper dry-run changed schema or business data.');

    result.mapperApply = runMapperPass(config, databases.source, true);
    const afterApply = await runHelper(config, databases.source, 'capture', 'source-after-apply');
    result.mapperSecondApply = runMapperPass(config, databases.source, true);
    const afterSecondApply = await runHelper(config, databases.source, 'capture', 'source-after-second-apply');
    result.mapperIdempotency =
      afterApply.evidence.business.hash === afterSecondApply.evidence.business.hash
      && JSON.stringify(afterApply.evidence.counts) === JSON.stringify(afterSecondApply.evidence.counts);
    if (!result.mapperIdempotency) throw new Error('Second mapper apply was not idempotent.');

    const fault = await runHelper(config, databases.source, 'fault', 'source-fault');
    result.rollback = fault.result;
    if (!result.rollback.rollback) throw new Error('Controlled mapping fault left partial data.');
    runMapperPass(config, databases.source, true);

    const beforeSeed = await runHelper(config, databases.source, 'capture', 'source-before-seed');
    await runSeed(config, databases.source);
    const afterSeed = await runHelper(config, databases.source, 'capture', 'source-after-seed');
    await runSeed(config, databases.source);
    const afterSecondSeed = await runHelper(config, databases.source, 'capture', 'source-after-second-seed');
    result.seed = {
      firstPass: true,
      secondPass: true,
      idempotentCounts: JSON.stringify(afterSeed.evidence.counts) === JSON.stringify(afterSecondSeed.evidence.counts),
      ceoPreservedFirst: beforeSeed.evidence.ceo.hash === afterSeed.evidence.ceo.hash,
      ceoPreservedSecond: afterSeed.evidence.ceo.hash === afterSecondSeed.evidence.ceo.hash,
    };
    if (!Object.values(result.seed).every(Boolean)) throw new Error('Doflow seed or CEO preservation was not idempotent.');
    const sourceFinal = afterSecondSeed.evidence;
    result.sourceFinal = sourceFinal;

    const postBackupRaw = await createBackup(databases.source, '/tmp/pre179-after.dump', 'pre179-after.dump');
    result.postBackup = compactBackup(postBackupRaw, databases.source, sourceFinal.maxMigration);

    restoreBackup(databases.replay, preBackupRaw.containerPath);
    const replayBaseline = (await runHelper(config, databases.replay, 'capture', 'replay-baseline')).evidence;
    result.preRestoreComparison = compareSnapshots(baseline, replayBaseline);
    if (!result.preRestoreComparison.pass) throw new Error('Restored pre-migration baseline differs from source baseline.');

    const replayMigrated = await runHelper(config, databases.replay, 'migrate', 'replay-migrated');
    if (replayMigrated.applied.length !== 6) throw new Error('Independent replay did not apply all six authority migrations.');
    const replayBeforeDry = await runHelper(config, databases.replay, 'capture', 'replay-before-dry');
    result.replayMapperDryRun = runMapperPass(config, databases.replay, false);
    const replayAfterDry = await runHelper(config, databases.replay, 'capture', 'replay-after-dry');
    if (replayBeforeDry.evidence.business.hash !== replayAfterDry.evidence.business.hash) {
      throw new Error('Replay mapper dry-run mutated business data.');
    }
    result.replayMapperApply = runMapperPass(config, databases.replay, true);
    result.replayMapperSecondApply = runMapperPass(config, databases.replay, true);
    await runSeed(config, databases.replay);
    await runSeed(config, databases.replay);
    const replayFinal = (await runHelper(config, databases.replay, 'capture', 'replay-final')).evidence;
    result.replayComparison = compareSnapshots(sourceFinal, replayFinal);
    if (!result.replayComparison.pass) throw new Error('Independent migration replay is not deterministically equivalent.');

    restoreBackup(databases.postRestore, postBackupRaw.containerPath);
    const postRestored = (await runHelper(config, databases.postRestore, 'capture', 'post-restored')).evidence;
    result.postRestoreComparison = compareSnapshots(sourceFinal, postRestored);
    if (!result.postRestoreComparison.pass) throw new Error('Post-migration restore differs from source final state.');
    const restoredNoPending = await runHelper(config, databases.postRestore, 'migrate-again', 'post-restored-no-pending');
    if (restoredNoPending.applied.length !== 0) throw new Error('Post-migration restore has pending migrations.');

    pnpm(['--filter', 'backend', 'build'], { env: serviceEnv(config, databases.postRestore) });
    result.tests.backendBuildPass = true;
    result.backendSmoke = await startRestoredBackend(config);
    await stopBackend();

    result.reconciliation = {
      ceoPreserved: sourceFinal.ceo.preserved === 2 && sourceFinal.ceo.hash === baseline.ceo.hash,
      businessRelations: sourceFinal.relations.complete && sourceFinal.relations.hash === baseline.relations.hash,
      economics: sourceFinal.economics.hash === baseline.economics.hash,
      secondaryTenantData: sourceFinal.secondary.hash === baseline.secondary.hash,
      crossTenantZero: Number(sourceFinal.secondary.crossTenant.secondary_in_doflow) === 0
        && Number(sourceFinal.secondary.crossTenant.doflow_in_secondary) === 0,
      ambiguousStateReported: result.mapperDryRun.delivery.ambiguousCount >= 1,
      noInventedOrders: Number(sourceFinal.counts.doflow.orders || 0) === 0,
      noInventedRefunds: Number(sourceFinal.counts.doflow.payments || 0) === Number(baseline.counts.doflow.payments || 0),
      noInventedPoints: Number(sourceFinal.counts.doflow.point_ledger || 0) === 0,
      noInventedRuns: Number(sourceFinal.counts.doflow.automation_runs || 0) === 0,
      noInventedSignatures: Number(sourceFinal.counts.doflow.contract_signature_events || 0) === 0,
    };
    if (!Object.values(result.reconciliation).every(Boolean)) throw new Error('Post-migration reconciliation failed.');

    result.verdict = 'TRUE PRE-179 MIGRATION REHEARSAL GO';
    result.tests.integrationPass = true;
    result.completedAt = new Date().toISOString();
    return result;
  } catch (error) {
    result.error = sanitize(error instanceof Error ? error.message : error);
    result.completedAt = new Date().toISOString();
    return result;
  } finally {
    result.teardown = await teardown();
    result.teardown.clean = Object.values(result.teardown.ports).every((state) => state === 'closed')
      && result.teardown.containers.length === 0
      && result.teardown.networks.length === 0
      && result.teardown.volumes.length === 0
      && result.teardown.backupsRemoved;
    if (!result.teardown.clean) {
      result.verdict = 'TRUE PRE-179 MIGRATION REHEARSAL BLOCKED';
      result.error = result.error || 'Dedicated acceptance teardown was incomplete.';
    }
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  }
}

const result = await execute();
process.stdout.write(`[acceptance:migration-pre179] ${result.verdict}\n`);
process.stdout.write(`[acceptance:migration-pre179] Evidence: ${path.relative(root, resultPath)}\n`);
if (result.verdict !== 'TRUE PRE-179 MIGRATION REHEARSAL GO') {
  process.stderr.write(`[acceptance:migration-pre179] ${sanitize(result.error || 'blocked')}\n`);
  process.exitCode = 1;
}
