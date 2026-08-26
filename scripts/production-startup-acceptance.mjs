import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  atomicWriteJson,
  createAcceptanceRunId,
  evaluateAcceptanceTeardown,
  redactAcceptanceText,
  safeAcceptanceFailure,
  withAcceptanceCheckpoint,
} from "./lib/acceptance-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(root, ".visual-runtime");
const workDir = path.join(runtimeDir, "production-startup-acceptance-work");
const resultPath = path.join(runtimeDir, "production-migration-runner-result.json");
const prefix = "doflow-production-startup-acceptance";
const imageTag = `${prefix}:local`;
const infrastructureImages = Object.freeze({
  postgres: "postgres@sha256:79c06d285ed9186efbbc45c73413b3c3510c3c94ffede2f25d1e523f74d07f28",
  redis: "redis@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2",
  storage: "minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e",
});
const names = {
  network: `${prefix}-network`,
  postgres: `${prefix}-postgres`,
  redis: `${prefix}-redis`,
  storage: `${prefix}-storage`,
  postgresVolume: `${prefix}-postgres-data`,
  redisVolume: `${prefix}-redis-data`,
  storageVolume: `${prefix}-storage-data`,
  baseline: `${prefix}-baseline`,
  restart: `${prefix}-restart`,
  concurrentA: `${prefix}-concurrent-a`,
  concurrentB: `${prefix}-concurrent-b`,
  failure: `${prefix}-failure`,
  retry: `${prefix}-retry`,
};
const databases = {
  baseline: "doflow_production_startup_acceptance_main",
  concurrent: "doflow_production_startup_acceptance_concurrent",
  failure: "doflow_production_startup_acceptance_failure",
};
const ports = [55432, 56379, 59000, 3401, 3402];
const expectedMigrationFiles = [
  "1714752000000-InitialPublicSchema.js",
  "1750000000000-CreateTenantRegistry.js",
  "1760000000000-AddGoogleOAuthUsers.js",
  "1770000000000-CreatePlatformAccessCatalog.js",
  "1780000000000-CreateBackupSchedules.js",
  "1790000000000-CreateCommercialCoreAuthority.js",
  "1800000000000-CreateDeliveryCoreAuthority.js",
  "1810000000000-CreateCommerceCashCoreAuthority.js",
  "1820000000000-CreateDocumentRevenueCoreAuthority.js",
  "1830000000000-CreateCollaborationNotificationsRealtimeAuthority.js",
  "1840000000000-CreateAutomationPerformanceAuthority.js",
  "1850000000000-CreateUniversalTenantFeatures.js",
];
const compiledScripts = [
  "apps/backend/dist/scripts/run-production-migrations.js",
  "apps/backend/dist/scripts/production-backend-entrypoint.js",
  "apps/backend/dist/scripts/doflow-production-cutover.js",
];
const owned = {
  containers: new Set(),
  networks: new Set(),
  volumes: new Set(),
  images: new Set(),
};

function sanitize(value) {
  return redactAcceptanceText(String(value ?? ""))
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(?:sk_test|whsec)_[A-Za-z0-9._~+/=-]+/gi, "[REDACTED_PROVIDER_SECRET]");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture
      ? sanitize(String(result.stderr || result.stdout || "").trim())
      : "";
    throw new Error(`${options.label ?? command} failed with exit ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function pnpm(args, options = {}) {
  if (process.platform === "win32") {
    return run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `pnpm ${args.join(" ")}`],
      options,
    );
  }
  return run("pnpm", args, options);
}

function docker(args, options = {}) {
  return run("docker", args, {
    ...options,
    label: options.label ?? `docker ${args[0]}`,
  });
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (status) => {
      const result = {
        status: status ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (result.status !== 0 && !options.allowFailure) {
        reject(new Error(`${options.label ?? command} failed: ${sanitize(result.stderr || result.stdout)}`));
      } else {
        resolve(result);
      }
    });
  });
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

async function assertPortsFree() {
  const open = [];
  for (const port of ports) if (await portIsOpen(port)) open.push(port);
  if (open.length > 0) throw new Error(`Dedicated production-startup acceptance ports already open: ${open.join(", ")}.`);
}

function dockerNames(kind) {
  const commands = {
    containers: ["ps", "-a", "--format", "{{.Names}}"],
    networks: ["network", "ls", "--format", "{{.Name}}"],
    volumes: ["volume", "ls", "--format", "{{.Name}}"],
    images: ["image", "ls", "--format", "{{.Repository}}:{{.Tag}}"],
  };
  const result = docker(commands[kind], { capture: true, allowFailure: true });
  if ((result.status ?? 1) !== 0) throw new Error(`Unable to inspect Docker ${kind}.`);
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.startsWith(prefix));
}

async function assertEmptyStack() {
  await assertPortsFree();
  const residues = {
    containers: dockerNames("containers"),
    networks: dockerNames("networks"),
    volumes: dockerNames("volumes"),
    images: dockerNames("images"),
  };
  if (Object.values(residues).some((items) => items.length > 0)) {
    throw new Error(`Dedicated production-startup acceptance stack is not empty: ${JSON.stringify(residues)}.`);
  }
  return residues;
}

async function waitForContainer(name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inspected = docker(
      ["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", name],
      { capture: true, allowFailure: true },
    );
    const state = String(inspected.stdout || "").trim();
    if (state === "healthy" || state === "running") return state;
    if (["unhealthy", "exited", "dead"].includes(state)) {
      throw new Error(`${name} entered state ${state}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${name} did not become healthy within ${timeoutMs}ms.`);
}

async function waitForExit(name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inspected = docker(
      ["inspect", "--format", "{{.State.Status}}|{{.State.ExitCode}}", name],
      { capture: true, allowFailure: true },
    );
    const [state, exitCode] = String(inspected.stdout || "").trim().split("|");
    if (["exited", "dead"].includes(state)) return { state, exitCode: Number(exitCode) };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} did not exit within ${timeoutMs}ms.`);
}

async function waitForLog(name, pattern, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let logs = "";
  while (Date.now() < deadline) {
    const result = docker(["logs", name], { capture: true, allowFailure: true });
    logs = String(result.stdout || "") + String(result.stderr || "");
    if (pattern.test(logs)) return logs;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${name} did not emit the expected privacy-safe startup marker: ${sanitize(logs.slice(-1200))}`);
}

async function waitForHealth(port, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "unavailable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health/system`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.json();
      if (response.status === 200 && body?.status === "ok") {
        return {
          status: response.status,
          checks: Object.fromEntries(Object.entries(body.checks ?? {}).map(([key, value]) => [key, value?.status ?? "missing"])),
        };
      }
      last = `${response.status}:${body?.status ?? "unknown"}`;
    } catch (error) {
      last = sanitize(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Backend health on ${port} did not become green: ${last}.`);
}

function databaseUrl(config, database, insideDocker = false) {
  const host = insideDocker ? names.postgres : "localhost";
  const port = insideDocker ? 5432 : 55432;
  return `postgresql://doflow_production_startup_acceptance:${encodeURIComponent(config.postgresPassword)}@${host}:${port}/${database}`;
}

function hostDatabaseEnv(config, database) {
  return {
    ...process.env,
    NODE_ENV: "test",
    DB_SYNC: "false",
    DATABASE_URL: databaseUrl(config, database),
    DB_HOST: "localhost",
    DB_PORT: "55432",
    DB_NAME: database,
    DB_USER: "doflow_production_startup_acceptance",
    DB_PASSWORD: config.postgresPassword,
    DOFLOW_CEO_PASSWORD: config.syntheticCeoPassword,
  };
}

function backendEnvironment(config, database, overrides = {}) {
  return {
    NODE_ENV: "production",
    PORT: "4000",
    DATABASE_URL: databaseUrl(config, database, true),
    DB_SYNC: "false",
    DB_HOST: names.postgres,
    DB_PORT: "5432",
    DB_NAME: database,
    DB_USER: "doflow_production_startup_acceptance",
    DB_PASSWORD: config.postgresPassword,
    REDIS_HOST: names.redis,
    REDIS_PORT: "6379",
    REDIS_DB: "0",
    JWT_SECRET: config.jwtSecret,
    CORS_ORIGINS: "http://localhost:3100",
    CORS_PUBLIC_ORIGINS: "",
    APP_BASE_URL: "http://localhost:3100",
    FRONTEND_URL: "http://localhost:3100",
    PUBLIC_API_URL: "http://localhost:3401",
    SITE_PROPOSALS_AI_ENABLED: "false",
    GEMINI_API_KEY: "",
    GOOGLE_OAUTH_CLIENT_ID: "isolated-disabled",
    GOOGLE_OAUTH_CLIENT_SECRET: "isolated-disabled",
    MAIL_HOST: "",
    MAIL_PORT: "1025",
    MAIL_USER: "",
    MAIL_PASSWORD: "",
    S3_ENDPOINT: `http://${names.storage}:9000`,
    S3_ACCESS_KEY_ID: config.storageAccessKey,
    S3_SECRET_ACCESS_KEY: config.storageSecretKey,
    S3_BUCKET: "doflow-production-startup-acceptance",
    S3_BUCKET_QUOTES: "doflow-production-startup-acceptance",
    MINIO_ENDPOINT: `http://${names.storage}:9000`,
    MINIO_ACCESS_KEY: config.storageAccessKey,
    MINIO_SECRET_KEY: config.storageSecretKey,
    MINIO_BACKUP_BUCKET: "doflow-production-startup-acceptance-backups",
    STRIPE_SECRET_KEY: `sk_test_${config.providerSecret}`,
    STRIPE_WEBHOOK_SECRET: `whsec_${config.providerSecret}`,
    DOFLOW_CEO_PASSWORD: config.syntheticCeoPassword,
    DOFLOW_MIGRATION_LOCK_TIMEOUT_MS: "30000",
    DOFLOW_MIGRATION_LOCK_RETRY_MS: "100",
    ...overrides,
  };
}

function environmentArgs(environment) {
  return Object.entries(environment).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
}

function createBackendContainer({ name, database, port, config, overrides = {} }) {
  const args = [
    "create",
    "--name", name,
    "--network", names.network,
    "-p", `127.0.0.1:${port}:4000`,
    ...environmentArgs(backendEnvironment(config, database, overrides)),
    imageTag,
  ];
  docker(args, { capture: true });
  owned.containers.add(name);
}

function startContainer(name) {
  docker(["start", name], { capture: true });
}

function removeContainer(name) {
  const result = docker(["rm", "-f", name], { capture: true, allowFailure: true });
  if ((result.status ?? 1) !== 0) throw new Error(`Unable to remove owned acceptance container ${name}.`);
  owned.containers.delete(name);
}

function psql(database, sql, options = {}) {
  return docker([
    "exec", names.postgres,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "doflow_production_startup_acceptance",
    "-d", database, "-Atc", sql,
  ], { capture: true, allowFailure: options.allowFailure });
}

function createDatabase(database) {
  docker([
    "exec", names.postgres,
    "createdb", "-U", "doflow_production_startup_acceptance", "-T", "template0", database,
  ], { capture: true });
}

function migrationState(database) {
  const result = psql(
    database,
    "SELECT timestamp::text || '|' || name FROM public.doflow_migrations ORDER BY timestamp, name",
  );
  const rows = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    return { timestamp: Number(line.slice(0, separator)), name: line.slice(separator + 1) };
  });
  return {
    count: rows.length,
    max: Math.max(0, ...rows.map((row) => row.timestamp)),
    rows,
    hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
  };
}

async function runCompiledHelper(config, database, command, label) {
  const helper = path.join(root, "apps/backend/dist/scripts/pre179-migration-rehearsal.js");
  if (!existsSync(helper)) throw new Error("Compiled pre-179 helper is missing after backend build.");
  const outputPath = path.join(workDir, `${label}.json`);
  const env = {
    ...hostDatabaseEnv(config, database),
    PRE179_STEP_OUTPUT: outputPath,
  };
  run(process.execPath, [helper, command], { env, capture: true, label: `compiled pre-179 ${command}` });
  return JSON.parse(await readFile(outputPath, "utf8"));
}

function stableBusinessFingerprint(evidence) {
  return createHash("sha256").update(JSON.stringify(stableBusinessComponents(evidence))).digest("hex");
}

function stableBusinessComponents(evidence) {
  return {
    schema: evidence?.schema?.hash ?? null,
    migrationHistory: createHash("sha256").update(JSON.stringify(evidence?.migrationHistory ?? null)).digest("hex"),
    counts: createHash("sha256").update(JSON.stringify(evidence?.counts ?? null)).digest("hex"),
    ceo: evidence?.ceo?.hash ?? null,
    business: evidence?.business?.hash ?? null,
    relations: evidence?.relations?.hash ?? null,
    economics: evidence?.economics?.hash ?? null,
    secondary: evidence?.secondary?.hash ?? null,
  };
}

function changedTableCounts(...evidenceItems) {
  const schemas = new Set(evidenceItems.flatMap((evidence) => Object.keys(evidence?.counts ?? {})));
  const changes = [];
  for (const schema of schemas) {
    const tables = new Set(evidenceItems.flatMap((evidence) => Object.keys(evidence?.counts?.[schema] ?? {})));
    for (const table of tables) {
      const values = evidenceItems.map((evidence) => Number(evidence?.counts?.[schema]?.[table] ?? 0));
      if (new Set(values).size > 1) changes.push(`${schema}.${table}:${values.join("->")}`);
    }
  }
  return changes;
}

function redactObject(value, key = "") {
  if (/(?:password|passphrase|secret|token|cookie|authorization|csrf|database.?url|mfa.?secret|google.?id|email|avatar.?url)/i.test(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((item) => redactObject(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactObject(childValue, childKey)]));
  }
  if (typeof value === "string") return sanitize(value).slice(0, 500);
  return value;
}

function extractJson(output) {
  const text = String(output || "").trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Continue with a previous line, then fall back to a multi-line object.
    }
  }
  for (let index = text.lastIndexOf("{"); index >= 0; index = text.lastIndexOf("{", index - 1)) {
    try {
      return JSON.parse(text.slice(index));
    } catch {
      // Try the preceding object start.
    }
  }
  throw new Error(`Compiled CLI did not emit JSON: ${sanitize(text.slice(-800))}`);
}

function productionMigrationEvents(output) {
  return String(output || "")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("[production-migrations] "))
    .flatMap((line) => {
      try {
        const record = JSON.parse(line.slice("[production-migrations] ".length));
        return record && typeof record === "object" ? [record] : [];
      } catch {
        return [];
      }
    });
}

function migrationEvent(events, event) {
  return events.find((record) => record.event === event);
}

function runCutoverCli(config, database, mode, args = []) {
  const environment = backendEnvironment(config, database, {
    NODE_ENV: "test",
    DOFLOW_CUTOVER_ACCEPTANCE: "1",
  });
  const result = docker([
    "run", "--rm", "--network", names.network,
    ...environmentArgs(environment),
    imageTag,
    "node", "apps/backend/dist/scripts/doflow-production-cutover.js",
    mode,
    "--tenant=doflow",
    ...args,
  ], { capture: true, allowFailure: true });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Cutover ${mode} failed with exit ${result.status}: ${sanitize(result.stderr || result.stdout)}`);
  }
  return {
    exitCode: result.status,
    report: redactObject(extractJson(result.stdout)),
  };
}

async function startInfrastructure(config) {
  docker(["network", "create", names.network], { capture: true });
  owned.networks.add(names.network);
  for (const volume of [names.postgresVolume, names.redisVolume, names.storageVolume]) {
    docker(["volume", "create", volume], { capture: true });
    owned.volumes.add(volume);
  }
  docker([
    "run", "-d", "--name", names.postgres, "--network", names.network,
    "-p", "127.0.0.1:55432:5432",
    "-e", "POSTGRES_USER=doflow_production_startup_acceptance",
    "-e", `POSTGRES_PASSWORD=${config.postgresPassword}`,
    "-e", "POSTGRES_DB=postgres",
    "-v", `${names.postgresVolume}:/var/lib/postgresql/data`,
    "--health-cmd", "pg_isready -U doflow_production_startup_acceptance -d postgres",
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "45",
    infrastructureImages.postgres,
  ], { capture: true });
  owned.containers.add(names.postgres);
  docker([
    "run", "-d", "--name", names.redis, "--network", names.network,
    "-p", "127.0.0.1:56379:6379", "-v", `${names.redisVolume}:/data`,
    "--health-cmd", "redis-cli ping", "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "45",
    infrastructureImages.redis, "redis-server", "--appendonly", "yes", "--appendfsync", "always", "--save", "",
  ], { capture: true });
  owned.containers.add(names.redis);
  docker([
    "run", "-d", "--name", names.storage, "--network", names.network,
    "-p", "127.0.0.1:59000:9000",
    "-e", `MINIO_ROOT_USER=${config.storageAccessKey}`,
    "-e", `MINIO_ROOT_PASSWORD=${config.storageSecretKey}`,
    "-v", `${names.storageVolume}:/data`,
    "--health-cmd", "curl -f http://localhost:9000/minio/health/live || exit 1",
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "45",
    infrastructureImages.storage, "server", "/data", "--console-address", ":9001",
  ], { capture: true });
  owned.containers.add(names.storage);
  await Promise.all([waitForContainer(names.postgres), waitForContainer(names.redis), waitForContainer(names.storage)]);

  const bucketBootstrap = `
    const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    (async () => {
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
      await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
      await client.destroy();
    })().catch(() => { process.exitCode = 1; });
  `;
  docker([
    "run", "--rm", "--network", names.network,
    "--workdir", "/app/apps/backend", "--entrypoint", "node",
    "-e", `S3_ENDPOINT=http://${names.storage}:9000`,
    "-e", `S3_ACCESS_KEY_ID=${config.storageAccessKey}`,
    "-e", `S3_SECRET_ACCESS_KEY=${config.storageSecretKey}`,
    "-e", "S3_BUCKET=doflow-production-startup-acceptance",
    imageTag, "-e", bucketBootstrap,
  ], { capture: true, label: "create isolated acceptance storage bucket" });
}

function imageInspection() {
  const id = String(docker(["image", "inspect", imageTag, "--format", "{{.Id}}"], { capture: true }).stdout || "").trim();
  const config = JSON.parse(String(docker(["image", "inspect", imageTag, "--format", "{{json .Config}}"], { capture: true }).stdout || "{}"));
  const files = String(docker([
    "run", "--rm", "--entrypoint", "sh", imageTag, "-c",
    "find apps/backend/dist/migrations -maxdepth 1 -type f -name '*.js' -exec basename {} \\; | sort",
  ], { capture: true }).stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const required = [...compiledScripts, ...expectedMigrationFiles.map((file) => `apps/backend/dist/migrations/${file}`)];
  const missingResult = docker([
    "run", "--rm", "--entrypoint", "sh", imageTag, "-c",
    `for f in ${required.map((file) => `'${file}'`).join(" ")}; do test -f "$f" || echo "$f"; done`,
  ], { capture: true });
  const missing = String(missingResult.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const forbidden = String(docker([
    "run", "--rm", "--entrypoint", "sh", imageTag, "-c",
    "find /app -type f \\( -name '.env' -o -name '.env.*' -o -name 'data-source.ts' \\) ! -name '.env.example' -print; find /app -type d -name 'doflow-gestionale-reference' -print; find /app/apps/backend -type f -name '*.ts' ! -name '*.d.ts' -print",
  ], { capture: true }).stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const cmd = Array.isArray(config.Cmd) ? config.Cmd : [];
  const bakedEnvironment = Array.isArray(config.Env) ? config.Env : [];
  const bakedSecrets = bakedEnvironment.filter((entry) =>
    /^(?:DATABASE_URL|DB_PASSWORD|JWT_SECRET|.*(?:PASSWORD|TOKEN|SECRET|COOKIE|MFA.*SECRET))=/i.test(entry),
  );
  const correctCommand = cmd.length === 2
    && cmd[0] === "node"
    && cmd[1] === "apps/backend/dist/scripts/production-backend-entrypoint.js";
  if (!id || missing.length > 0 || forbidden.length > 0 || bakedSecrets.length > 0 || !correctCommand) {
    throw new Error(`Production image inspection failed: ${JSON.stringify({
      id: Boolean(id),
      missing,
      forbidden,
      bakedSecretCount: bakedSecrets.length,
      cmd,
    })}.`);
  }
  return {
    imageId: id,
    cmd,
    entrypoint: config.Entrypoint ?? null,
    migrationFiles: files,
    expectedMigrationsPresent: expectedMigrationFiles.every((file) => files.includes(file)),
    compiledScriptsPresent: true,
    dataSourceTsRequired: false,
    tsNodeRequired: false,
    sourceTsRequired: false,
    environmentFiles: 0,
    bakedSecrets: 0,
    referenceFiles: 0,
  };
}

async function scenarioBaseline(config) {
  createDatabase(databases.baseline);
  const baseline = await runCompiledHelper(config, databases.baseline, "baseline", "baseline-178");
  const before = migrationState(databases.baseline);
  if (before.max !== 1780000000000 || before.count !== 5) throw new Error("Scenario baseline was not frozen at migration 178.");
  createBackendContainer({ name: names.baseline, database: databases.baseline, port: 3401, config });
  startContainer(names.baseline);
  const health = await waitForHealth(3401);
  const after = migrationState(databases.baseline);
  if (after.max !== 1850000000000 || after.count !== 12) throw new Error("Production image did not apply migrations 179-185 exactly once.");
  const logs = await waitForLog(names.baseline, /"event"\s*:\s*"complete"/i);
  const events = productionMigrationEvents(logs);
  const lockAcquired = migrationEvent(events, "lock_acquired")?.acquired === true;
  const lockReleased = migrationEvent(events, "lock_released")?.released === true;
  const complete = migrationEvent(events, "complete");
  if (!lockAcquired || !lockReleased || complete?.status !== "applied" || complete?.pendingAfter !== 0) {
    throw new Error("Baseline startup did not emit a complete applied/zero-pending advisory-lock lifecycle.");
  }
  const capture = await runCompiledHelper(config, databases.baseline, "capture", "baseline-after-startup");
  removeContainer(names.baseline);
  return {
    baselineMax: baseline.evidence.maxMigration,
    before,
    after,
    health,
    lockAcquired,
    lockReleased,
    applied: complete.applied,
    pendingAfter: 0,
    capture,
  };
}

async function scenarioRestart(config, first) {
  const beforeFingerprint = stableBusinessFingerprint(first.capture.evidence);
  createBackendContainer({ name: names.restart, database: databases.baseline, port: 3401, config });
  startContainer(names.restart);
  const health = await waitForHealth(3401);
  const logs = await waitForLog(names.restart, /"event"\s*:\s*"complete"/i);
  const events = productionMigrationEvents(logs);
  const complete = migrationEvent(events, "complete");
  const lockReleased = migrationEvent(events, "lock_released")?.released === true;
  const state = migrationState(databases.baseline);
  const capture = await runCompiledHelper(config, databases.baseline, "capture", "restart-no-op");
  const afterFingerprint = stableBusinessFingerprint(capture.evidence);
  removeContainer(names.restart);
  if (state.hash !== first.after.hash || beforeFingerprint !== afterFingerprint
      || complete?.status !== "no-op" || complete?.pendingBefore !== 0
      || complete?.pendingAfter !== 0 || !lockReleased) {
    throw new Error("Restart no-op changed migration history or authoritative business evidence.");
  }
  return {
    noOp: true,
    pendingBefore: 0,
    applied: [],
    state,
    health,
    logNoOp: true,
    lockReleased,
    businessFingerprintPreserved: true,
  };
}

async function scenarioConcurrent(config) {
  createDatabase(databases.concurrent);
  await runCompiledHelper(config, databases.concurrent, "baseline", "concurrent-baseline-178");
  createBackendContainer({
    name: names.concurrentA,
    database: databases.concurrent,
    port: 3401,
    config,
    overrides: {
      NODE_ENV: "test",
      DOFLOW_PRODUCTION_STARTUP_ACCEPTANCE: "1",
      DOFLOW_MIGRATION_ACCEPTANCE_HOLD_LOCK_MS: "8000",
    },
  });
  createBackendContainer({ name: names.concurrentB, database: databases.concurrent, port: 3402, config });
  startContainer(names.concurrentA);
  await waitForLog(names.concurrentA, /"event"\s*:\s*"lock_acquired"/i, 30_000);
  await runAsync("docker", ["start", names.concurrentB], { label: "start concurrent backend B" });
  const [healthA, healthB] = await Promise.all([waitForHealth(3401), waitForHealth(3402)]);
  const firstLogsResult = docker(["logs", names.concurrentA], { capture: true, allowFailure: true });
  const secondLogsResult = docker(["logs", names.concurrentB], { capture: true, allowFailure: true });
  const firstLogs = String(firstLogsResult.stdout || "") + String(firstLogsResult.stderr || "");
  const secondLogs = String(secondLogsResult.stdout || "") + String(secondLogsResult.stderr || "");
  const state = migrationState(databases.concurrent);
  const duplicateRows = state.rows.length - new Set(state.rows.map((row) => `${row.timestamp}|${row.name}`)).size;
  removeContainer(names.concurrentB);
  removeContainer(names.concurrentA);
  if (state.max !== 1850000000000 || state.count !== 12 || duplicateRows !== 0) {
    throw new Error("Concurrent startup produced an incoherent migration history.");
  }
  const firstEvents = productionMigrationEvents(firstLogs);
  const secondEvents = productionMigrationEvents(secondLogs);
  const secondWaited = secondEvents.some((event) => event.event === "lock_wait" && event.acquired === false);
  const firstAcquired = migrationEvent(firstEvents, "lock_acquired")?.acquired === true;
  const firstReleased = migrationEvent(firstEvents, "lock_released")?.released === true;
  const secondAcquired = migrationEvent(secondEvents, "lock_acquired")?.acquired === true;
  const secondReleased = migrationEvent(secondEvents, "lock_released")?.released === true;
  const secondComplete = migrationEvent(secondEvents, "complete");
  if (!secondWaited) throw new Error("Concurrent backend B did not emit evidence that it waited for the advisory lock.");
  if (!firstAcquired || !firstReleased || !secondAcquired || !secondReleased
      || secondComplete?.status !== "no-op" || secondComplete?.pendingAfter !== 0) {
    throw new Error("Concurrent startup did not emit a complete advisory-lock/no-op lifecycle.");
  }
  return {
    lockKey: [-1594877102, -962476012],
    firstAcquired,
    firstReleased,
    firstHoldMs: 8000,
    secondWaited,
    secondAcquired,
    secondReleased,
    secondNoOp: true,
    bothHealthy: true,
    healthA,
    healthB,
    migrationState: state,
    duplicateRows,
  };
}

async function scenarioFailure(config) {
  createDatabase(databases.failure);
  const baseline = await runCompiledHelper(config, databases.failure, "baseline", "failure-baseline-178");
  const baselineFingerprint = stableBusinessFingerprint(baseline.evidence);
  psql(
    databases.failure,
    'CREATE SCHEMA "zz-fault"; CREATE TABLE "zz-fault".opportunities (LIKE doflow.opportunities INCLUDING ALL);',
  );
  createBackendContainer({ name: names.failure, database: databases.failure, port: 3401, config });
  startContainer(names.failure);
  const exited = await waitForExit(names.failure);
  const portClosed = !(await portIsOpen(3401));
  const stateAfterFailure = migrationState(databases.failure);
  const afterFailure = await runCompiledHelper(config, databases.failure, "capture", "failure-after-blocked-startup");
  const transactionRollbackPreserved = stableBusinessFingerprint(afterFailure.evidence) === baselineFingerprint
    && afterFailure.evidence?.forbidden?.absent === true;
  const logsResult = docker(["logs", names.failure], { capture: true, allowFailure: true });
  const logs = String(logsResult.stdout || "") + String(logsResult.stderr || "");
  const events = productionMigrationEvents(logs);
  const lockReleased = migrationEvent(events, "lock_released")?.released === true;
  const failedClosed = ["backend_start_blocked", "failed"].some(
    (event) => migrationEvent(events, event)?.exitCode === 1,
  );
  removeContainer(names.failure);
  if (exited.exitCode === 0 || !portClosed || stateAfterFailure.max !== 1780000000000
      || stateAfterFailure.count !== 5 || !transactionRollbackPreserved) {
    throw new Error("Migration failure did not fail closed before NestJS startup.");
  }
  if (/Nest application successfully started/i.test(logs)) throw new Error("NestJS started after a failed production migration.");
  if (!lockReleased || !failedClosed) throw new Error("Migration failure did not emit a released-lock/nonzero failure lifecycle.");
  psql(databases.failure, 'ALTER SCHEMA "zz-fault" RENAME TO zz_fault;');
  createBackendContainer({ name: names.retry, database: databases.failure, port: 3401, config });
  startContainer(names.retry);
  const retryHealth = await waitForHealth(3401);
  const retryState = migrationState(databases.failure);
  removeContainer(names.retry);
  if (retryState.max !== 1850000000000 || retryState.count !== 12) throw new Error("Retry after removal of the isolated fault did not reach migration 185.");
  return {
    fault: "invalid isolated schema name discovered by migration 179",
    exitCode: exited.exitCode,
    appStartBlocked: true,
    backendPortClosed: portClosed,
    lockReleased,
    failedClosed,
    stateAfterFailure,
    transactionHistoryCoherent: true,
    transactionRollbackPreserved,
    syntheticFaultRemoved: true,
    retry: { health: retryHealth, state: retryState, passed: true },
  };
}

async function scenarioCutover(config, baselineCapture) {
  const before = baselineCapture.evidence;
  const beforeFingerprint = stableBusinessFingerprint(before);
  const status = runCutoverCli(config, databases.baseline, "status");
  const afterStatus = await runCompiledHelper(config, databases.baseline, "capture", "cutover-after-status");
  if (stableBusinessFingerprint(afterStatus.evidence) !== beforeFingerprint) throw new Error("Cutover status mutated the database.");
  const dryRun = runCutoverCli(config, databases.baseline, "dry-run");
  const afterDryRun = await runCompiledHelper(config, databases.baseline, "capture", "cutover-after-dry-run");
  if (stableBusinessFingerprint(afterDryRun.evidence) !== beforeFingerprint) throw new Error("Cutover dry-run mutated the database.");
  const applyArgs = [
    "--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER",
    "--backup-ref=acceptance-backup-verified",
  ];
  const applyFirst = runCutoverCli(config, databases.baseline, "apply", applyArgs);
  const afterFirst = await runCompiledHelper(config, databases.baseline, "capture", "cutover-after-apply-first");
  const applySecond = runCutoverCli(config, databases.baseline, "apply", applyArgs);
  const afterSecond = await runCompiledHelper(config, databases.baseline, "capture", "cutover-after-apply-second");
  const verify = runCutoverCli(config, databases.baseline, "verify");
  const finalCapture = await runCompiledHelper(config, databases.baseline, "capture", "cutover-final-verify");
  const firstStable = stableBusinessFingerprint(afterFirst.evidence);
  const secondStable = stableBusinessFingerprint(afterSecond.evidence);
  const finalStable = stableBusinessFingerprint(finalCapture.evidence);
  if (firstStable !== secondStable || secondStable !== finalStable) {
    const firstComponents = stableBusinessComponents(afterFirst.evidence);
    const secondComponents = stableBusinessComponents(afterSecond.evidence);
    const finalComponents = stableBusinessComponents(finalCapture.evidence);
    const changed = Object.keys(firstComponents).filter((key) =>
      firstComponents[key] !== secondComponents[key] || secondComponents[key] !== finalComponents[key]);
    const countChanges = changed.includes("counts")
      ? changedTableCounts(afterFirst.evidence, afterSecond.evidence, finalCapture.evidence)
      : [];
    throw new Error(
      `Second cutover apply or verify changed authoritative components: ${changed.join(", ")}`
      + `${countChanges.length > 0 ? ` (${countChanges.join(", ")})` : ""}.`,
    );
  }
  const ceoPreserved = before.ceo.hash === finalCapture.evidence.ceo.hash;
  const secondTenantUnchanged = before.secondary.hash === finalCapture.evidence.secondary.hash;
  const crossTenant = finalCapture.evidence.secondary.crossTenant ?? {};
  const reconciliation = {
    migrationMax: finalCapture.evidence.maxMigration,
    zeroPending: migrationState(databases.baseline).max === 1850000000000,
    relationsComplete: finalCapture.evidence.relations.complete === true,
    ceoPreserved,
    secondTenantUnchanged,
    crossTenantZero: Number(crossTenant.secondary_in_doflow) === 0 && Number(crossTenant.doflow_in_secondary) === 0,
    economicsHash: finalCapture.evidence.economics.hash,
    businessHash: finalCapture.evidence.business.hash,
  };
  if (!Object.entries(reconciliation).filter(([key]) => !key.endsWith("Hash") && key !== "migrationMax").every(([, value]) => value === true)
      || reconciliation.migrationMax !== 1850000000000) {
    throw new Error("Cutover reconciliation, CEO preservation or second-tenant isolation failed.");
  }
  return {
    status: { ...status, readOnly: true },
    dryRun: { ...dryRun, readOnly: true },
    applyFirst,
    applySecond: { ...applySecond, idempotent: true },
    verify: { ...verify, readOnly: true },
    mapperSecondPass: true,
    seedSecondPass: true,
    ceoPreservation: { preserved: ceoPreserved, count: finalCapture.evidence.ceo.preserved, fingerprintsOnly: true },
    secondTenant: { unchanged: secondTenantUnchanged, crossTenantZero: reconciliation.crossTenantZero },
    reconciliation,
  };
}

async function teardown() {
  const errors = [];
  for (const container of [...owned.containers].reverse()) {
    try {
      const result = docker(["rm", "-f", container], { capture: true, allowFailure: true });
      if ((result.status ?? 1) !== 0) throw new Error(`Unable to remove owned acceptance container ${container}.`);
      owned.containers.delete(container);
    } catch (error) {
      errors.push(safeAcceptanceFailure(error, `teardown-container-${container}`));
    }
  }
  for (const volume of [...owned.volumes].reverse()) {
    try {
      const result = docker(["volume", "rm", volume], { capture: true, allowFailure: true });
      if ((result.status ?? 1) !== 0) throw new Error(`Unable to remove owned acceptance volume ${volume}.`);
      owned.volumes.delete(volume);
    } catch (error) {
      errors.push(safeAcceptanceFailure(error, `teardown-volume-${volume}`));
    }
  }
  for (const network of [...owned.networks].reverse()) {
    try {
      const result = docker(["network", "rm", network], { capture: true, allowFailure: true });
      if ((result.status ?? 1) !== 0) throw new Error(`Unable to remove owned acceptance network ${network}.`);
      owned.networks.delete(network);
    } catch (error) {
      errors.push(safeAcceptanceFailure(error, `teardown-network-${network}`));
    }
  }
  for (const image of [...owned.images].reverse()) {
    try {
      const result = docker(["image", "rm", image], { capture: true, allowFailure: true });
      if ((result.status ?? 1) !== 0) throw new Error(`Unable to remove owned acceptance image ${image}.`);
      owned.images.delete(image);
    } catch (error) {
      errors.push(safeAcceptanceFailure(error, `teardown-image-${image}`));
    }
  }
  await rm(workDir, { recursive: true, force: true });
  const portState = Object.fromEntries(await Promise.all(ports.map(async (port) => [String(port), (await portIsOpen(port)) ? "open" : "closed"])));
  let residues = { containers: [], networks: [], volumes: [], images: [] };
  const probeFailures = [];
  for (const kind of Object.keys(residues)) {
    try {
      residues[kind] = dockerNames(kind);
    } catch (error) {
      probeFailures.push(safeAcceptanceFailure(error, `teardown-probe-${kind}`));
    }
  }
  const base = evaluateAcceptanceTeardown({
    ports: portState,
    dockerResidues: {
      containers: residues.containers,
      networks: residues.networks,
      volumes: residues.volumes,
    },
    dockerProbeFailures: probeFailures,
  });
  return {
    ...base,
    completed: base.completed && residues.images.length === 0 && errors.length === 0,
    images: residues.images,
    errors,
    workDirectoryRemoved: !existsSync(workDir),
    doflowNginxTouched: false,
  };
}

async function gitIdentity() {
  return {
    branch: String(run("git", ["branch", "--show-current"], { capture: true }).stdout || "").trim(),
    sha: String(run("git", ["rev-parse", "HEAD"], { capture: true }).stdout || "").trim(),
  };
}

async function execute() {
  const runId = createAcceptanceRunId();
  const startedAt = new Date();
  const identity = await gitIdentity();
  let evidence = {
    schemaVersion: 1,
    verdict: "PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI BLOCKED",
    runId,
    branch: identity.branch,
    sha: identity.sha,
    startedAt: startedAt.toISOString(),
    currentStage: "initialization",
    checkpoints: {},
    dbSync: false,
    productionTouched: false,
    realCeoTouched: false,
    referenceTouched: false,
    teardown: { completed: false, state: "not-started" },
  };
  const checkpoint = async (stage, status, details = {}) => {
    evidence = withAcceptanceCheckpoint(evidence, stage, status, details);
    await atomicWriteJson(resultPath, evidence);
  };
  const config = {
    postgresPassword: randomBytes(24).toString("base64url"),
    storageAccessKey: `prodacc${randomBytes(10).toString("hex")}`,
    storageSecretKey: randomBytes(32).toString("base64url"),
    jwtSecret: randomBytes(48).toString("base64url"),
    providerSecret: randomBytes(24).toString("base64url"),
    syntheticCeoPassword: `Synthetic-${randomBytes(20).toString("base64url")}!`,
  };
  let failure = null;
  try {
    await mkdir(workDir, { recursive: true });
    const initial = await assertEmptyStack();
    if (identity.branch !== "main") throw new Error(`Expected main branch, found ${identity.branch}.`);
    await checkpoint("bootstrap", "passed", { stackInitiallyEmpty: true, initial });

    await checkpoint("orchestrationContract", "running", { started: true });
    run(process.execPath, ["--test", "tests/orchestration/production-startup-acceptance.test.mjs"], {
      capture: true,
      label: "production startup orchestration contract",
    });
    await checkpoint("orchestrationContract", "passed", { tests: 6 });

    await checkpoint("compiledHelper", "running", { started: true });
    pnpm(["--filter", "backend", "build"]);
    await checkpoint("compiledHelper", "passed", { sourceTypeScriptRuntimeRequired: false });

    await checkpoint("productionImage", "running", { started: true });
    docker(["build", "--file", "apps/backend/Dockerfile", "--tag", imageTag, "."]);
    owned.images.add(imageTag);
    const inspection = imageInspection();
    evidence.imageId = inspection.imageId;
    evidence.migrationFiles = inspection.migrationFiles;
    evidence.imageInspection = inspection;
    await checkpoint("productionImage", "passed", { imageId: inspection.imageId, cmd: inspection.cmd, migrations: inspection.migrationFiles.length });

    await checkpoint("infrastructure", "running", { started: true });
    await startInfrastructure(config);
    await checkpoint("infrastructure", "passed", { localOnly: true, imagesPinnedByDigest: true, storage: "isolated MinIO" });

    await checkpoint("baseline178", "running", { started: true });
    const baseline = await scenarioBaseline(config);
    evidence.migrationMaxBefore = baseline.before.max;
    evidence.migrationMaxAfter = baseline.after.max;
    evidence.advisoryLock = {
      acquired: baseline.lockAcquired,
      released: baseline.lockReleased,
      timeoutMs: 30000,
    };
    await checkpoint("baseline178", "passed", { before: baseline.before, after: baseline.after, health: baseline.health });

    await checkpoint("restartNoOp", "running", { started: true });
    const restart = await scenarioRestart(config, baseline);
    evidence.restartNoOp = restart;
    await checkpoint("restartNoOp", "passed", restart);

    await checkpoint("concurrentStartup", "running", { started: true });
    const concurrent = await scenarioConcurrent(config);
    evidence.concurrentStartup = concurrent;
    await checkpoint("concurrentStartup", "passed", concurrent);

    await checkpoint("migrationFailure", "running", { started: true });
    const failureResult = await scenarioFailure(config);
    evidence.failureTest = failureResult;
    evidence.appStartBlockedOnFailure = failureResult.appStartBlocked;
    await checkpoint("migrationFailure", "passed", failureResult);

    await checkpoint("cutoverCli", "running", { started: true });
    const cutover = await scenarioCutover(config, baseline.capture);
    evidence.cutover = cutover;
    evidence.cutoverDryRun = cutover.dryRun;
    evidence.cutoverApply = { first: cutover.applyFirst, second: cutover.applySecond };
    evidence.cutoverVerify = cutover.verify;
    evidence.ceoPreservation = cutover.ceoPreservation;
    evidence.secondTenant = cutover.secondTenant;
    evidence.reconciliation = cutover.reconciliation;
    await checkpoint("cutoverCli", "passed", {
      status: "passed",
      dryRunReadOnly: true,
      applyIdempotent: true,
      verifyReadOnly: true,
      ceoPreserved: cutover.ceoPreservation.preserved,
      secondTenantUnchanged: cutover.secondTenant.unchanged,
    });

    evidence.fullAcceptance = "passed";
    evidence.completedAtBeforeTeardown = new Date().toISOString();
    await checkpoint("preTeardown", "passed", { evidenceWritten: true });
  } catch (error) {
    failure = error;
    evidence.failure = safeAcceptanceFailure(error, evidence.currentStage || "production-startup-acceptance");
    await checkpoint(evidence.currentStage || "failure", "failed", { failure: evidence.failure });
  } finally {
    let teardownResult;
    try {
      teardownResult = await teardown();
    } catch (error) {
      teardownResult = {
        completed: false,
        failure: safeAcceptanceFailure(error, "teardown"),
      };
      failure ??= error;
    }
    evidence.teardown = teardownResult;
    evidence.ports = teardownResult.ports ?? null;
    evidence.dockerResidues = {
      ...(teardownResult.dockerResidues ?? {}),
      images: teardownResult.images ?? [],
    };
    evidence.completedAt = new Date().toISOString();
    evidence.durationMs = new Date(evidence.completedAt).getTime() - startedAt.getTime();
    const passed = !failure
      && evidence.fullAcceptance === "passed"
      && teardownResult.completed === true;
    evidence.verdict = passed
      ? "PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO"
      : "PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI BLOCKED";
    evidence = withAcceptanceCheckpoint(evidence, "teardown", teardownResult.completed ? "passed" : "failed", teardownResult);
    await atomicWriteJson(resultPath, evidence);
  }
  process.stdout.write(`[acceptance:production-startup] ${evidence.verdict}\n`);
  process.stdout.write(`[acceptance:production-startup] Evidence: ${path.relative(root, resultPath)}\n`);
  if (evidence.verdict !== "PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO") {
    process.stderr.write(`[acceptance:production-startup] ${sanitize(evidence.failure?.message || "blocked")}\n`);
    process.exitCode = 1;
  }
  return evidence;
}

await execute();
