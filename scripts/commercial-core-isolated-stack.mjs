import { randomBytes } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { lstat, mkdir, readFile, readlink, rm, stat, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireAcceptanceRunLock,
  archiveAcceptanceEvidence,
  atomicWriteJson,
  buildWorkingTreeFingerprint,
  createAcceptanceRunId,
  evaluateAcceptanceTeardown,
  hasCompleteBootstrapDiagnostic,
  hasTwoConsecutiveStableRuns,
  nextAcceptanceRunSequence,
  safeAcceptanceFailure,
  validateFreshAcceptanceEvidence,
  withAcceptanceCheckpoint,
} from "./lib/acceptance-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(root, ".visual-runtime");
const authDir = path.join(root, ".visual-auth");
const configPath = path.join(runtimeDir, "commercial-core-stack.json");
const credentialPath = path.join(authDir, "acceptance-credentials.json");
const finalEvidencePath = path.join(runtimeDir, "doflow-final-release-candidate-result.json");
const finalProgressPath = path.join(runtimeDir, "doflow-final-release-candidate-progress.json");
const stabilityEvidencePath = path.join(runtimeDir, "doflow-rc-stability-result.json");
const superadminResultPath = path.join(runtimeDir, "superadmin-acceptance-result.json");
const superadminStandaloneResultPath = path.join(runtimeDir, "superadmin-standalone-result.json");
const acceptanceRunLockPath = path.join(runtimeDir, "acceptance-final.lock");
const finalResultPaths = [
  "commercial-core-acceptance-result.json",
  "delivery-core-acceptance-result.json",
  "commerce-cash-acceptance-result.json",
  "document-revenue-acceptance-result.json",
  "collaboration-acceptance-result.json",
  "automation-performance-acceptance-result.json",
  "final-global-acceptance-result.json",
  "superadmin-acceptance-result.json",
  "final-global-visual-result.json",
].map((name) => path.join(runtimeDir, name));
const names = {
  network: "doflow-commercial-acceptance-network",
  postgres: "doflow-commercial-acceptance-postgres",
  redis: "doflow-commercial-acceptance-redis",
  storage: "doflow-commercial-acceptance-storage",
  postgresVolume: "doflow-commercial-acceptance-postgres-data",
  redisVolume: "doflow-commercial-acceptance-redis-data",
  storageVolume: "doflow-commercial-acceptance-storage-data",
};
const ports = [55432, 56379, 59000, 3401, 3100];
const stabilityFiles = [
  "package.json",
  "apps/backend/src/main.ts",
  "apps/backend/src/common/schema-provisioning-once.ts",
  "apps/backend/src/common/schema-provisioning-once.spec.ts",
  "apps/backend/src/telemetry/global-exception.filter.spec.ts",
  "apps/backend/src/public-lead-intake/public-lead-intake-schema.ts",
  "apps/backend/src/tenant/tenant-automation-performance-schema.ts",
  "apps/backend/src/tenant/tenant-automations-schema.ts",
  "apps/backend/src/tenant/tenant-briefing-quotes-schema.ts",
  "apps/backend/src/tenant/tenant-contracts-schema.ts",
  "apps/backend/src/tenant/tenant-crm-schema.ts",
  "apps/backend/src/tenant/tenant-delivery-schema.ts",
  "apps/backend/src/tenant/tenant-documents-schema.ts",
  "apps/backend/src/tenant/tenant-doflow-commerce-schema.ts",
  "apps/backend/src/tenant/tenant-doflow-document-revenue-schema.ts",
  "apps/backend/src/tenant/tenant-doflow-workspace.service.ts",
  "apps/backend/src/tenant/tenant-doflow-workspace-schema.spec.ts",
  "apps/backend/src/tenant/tenant-finance-schema.ts",
  "apps/backend/src/tenant/tenant-notifications-schema.ts",
  "apps/backend/src/tenant/tenant-projects-schema.ts",
  "apps/frontend/src/app/(tenant)/layout.tsx",
  "apps/frontend/src/features/commercial/commercial-provider-types.ts",
  "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx",
  "apps/frontend/src/lib/tenant-automations-api.ts",
  "apps/frontend/src/lib/tenant-commerce-api.ts",
  "apps/frontend/src/lib/tenant-delivery-api.ts",
  "apps/frontend/src/lib/tenant-document-revenue-api.ts",
  "apps/frontend/src/lib/tenant-documents-api.ts",
  "apps/frontend/src/lib/tenant-performance-api.ts",
  "tests/acceptance/nest11-isolated.spec.ts",
  "tests/acceptance/collaboration-isolated.spec.ts",
  "tests/acceptance/workspace-readiness-isolated.spec.ts",
  "tests/acceptance/final-global-isolated.spec.ts",
  "tests/frontend/workspace-readiness-runtime.test.mjs",
  "tests/orchestration/acceptance-evidence.test.mjs",
  "scripts/commercial-core-isolated-stack.mjs",
  "scripts/lib/acceptance-evidence.mjs",
  "playwright.final-global.config.ts",
  "playwright.superadmin.config.ts",
  "playwright.workspace-readiness.config.ts",
  "docs/doflow-final-release-candidate-report.md",
  "docs/doflow-release-lock-report.md",
  "docs/doflow-replacement-closure-matrix.md",
  "docs/doflow-release-candidate-manifest.md",
  "docs/design-references/doflow-crm-projects/VISUAL_ACCEPTANCE.md",
  "docs/doflow-production-preflight-report.md",
];
const stabilityRootCause = {
  workspace: "The application shell was coupled to secondary workspace synchronization, so a slow or failed aggregate could keep <main> absent indefinitely; the core bootstrap also requested lead or CRM activity data for delivery-only identities, allowing unrelated capability 403 responses to mark an authorized project workspace as not ready.",
  queryLatency: "Request-time schema DDL ran concurrently across bounded contexts, contending on PostgreSQL catalogs and the application pool; repeated provisioning, rather than a missing query index, produced the measured 20-second aggregate tail.",
  orchestration: "Context E and final evidence were coupled to completion of Context A-D instead of producing independent atomic checkpoints.",
  cors: "A rejected CORS callback reached the global exception path as an uncontrolled server error instead of a deliberate 4xx response.",
};

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
      ? String(result.stderr || result.stdout || "").trim()
      : "";
    throw new Error(
      `${options.label ?? command} failed${detail ? `: ${detail}` : ""}`,
    );
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

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function printCaptured(result) {
  if (result.stdout) process.stdout.write(String(result.stdout));
  if (result.stderr) process.stderr.write(String(result.stderr));
}

function requireCaptured(result, label) {
  printCaptured(result);
  if ((result.status ?? 1) !== 0) throw new Error(`${label} failed.`);
  return stripAnsi(`${result.stdout || ""}\n${result.stderr || ""}`);
}

function clearAcceptanceTrafficBuckets() {
  const scanned = docker(
    ["exec", names.redis, "redis-cli", "--scan", "--pattern", "df:rl:*"],
    { capture: true },
  );
  const keys = String(scanned.stdout || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  for (let offset = 0; offset < keys.length; offset += 100) {
    docker(["exec", names.redis, "redis-cli", "DEL", ...keys.slice(offset, offset + 100)], { capture: true });
  }
  process.stdout.write(`[acceptance:final] Reset ${keys.length} isolated traffic bucket keys between suites.\n`);
}

async function readConfig() {
  return JSON.parse(await readFile(configPath, "utf8"));
}

function assertLocalConfig(config) {
  const database = new URL(config.databaseUrl);
  const storage = new URL(config.storageEndpoint);
  if (!["localhost", "127.0.0.1"].includes(database.hostname))
    throw new Error("DATABASE_URL is not isolated.");
  if (!["localhost", "127.0.0.1"].includes(config.redisHost))
    throw new Error("REDIS_HOST is not isolated.");
  if (!["localhost", "127.0.0.1"].includes(storage.hostname))
    throw new Error("Storage endpoint is not isolated.");
  if (
    config.frontendUrl !== "http://localhost:3100" ||
    config.backendUrl !== "http://localhost:3401"
  ) {
    throw new Error("Frontend/API acceptance URLs must use localhost.");
  }
  if (config.dbSync !== false || config.nodeEnv !== "test")
    throw new Error("Acceptance requires DB_SYNC=false and NODE_ENV=test.");
}

async function waitForContainer(name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = docker(
      [
        "inspect",
        "--format",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
        name,
      ],
      { capture: true, allowFailure: true },
    );
    const state = String(result.stdout || "").trim();
    if (state === "healthy" || state === "running") return;
    if (state === "unhealthy" || state === "exited" || state === "dead")
      throw new Error(`${name} entered state ${state}.`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${name} did not become healthy.`);
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(3_000),
      });
      if (response.status >= 200 && response.status < 500)
        return response.status;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${url} did not become reachable.`);
}

function serviceEnv(config) {
  const database = new URL(config.databaseUrl);
  return {
    ...process.env,
    NODE_ENV: "test",
    DB_SYNC: "false",
    DATABASE_URL: config.databaseUrl,
    DOFLOW_ACCEPTANCE_DATABASE_URL: config.databaseUrl,
    DOFLOW_ACCEPTANCE_REDIS_HOST: config.redisHost,
    DOFLOW_ACCEPTANCE_REDIS_PORT: String(config.redisPort),
    DOFLOW_ACCEPTANCE_STORAGE_ENDPOINT: config.storageEndpoint,
    DOFLOW_ACCEPTANCE_STORAGE_ACCESS_KEY: config.storageAccessKey,
    DOFLOW_ACCEPTANCE_STORAGE_SECRET_KEY: config.storageSecretKey,
    DOFLOW_ACCEPTANCE_JWT_SECRET: config.jwtSecret,
    REDIS_HOST: config.redisHost,
    REDIS_PORT: String(config.redisPort),
    FRONTEND_URL: config.frontendUrl,
    APP_BASE_URL: config.frontendUrl,
    PUBLIC_API_URL: config.backendUrl,
    INTERNAL_BACKEND_URL: config.backendUrl,
    NEXT_PUBLIC_API_URL: "",
    NEXT_PUBLIC_WS_URL: "ws://localhost:3401/ws",
    CORS_ORIGINS: config.frontendUrl,
    STRIPE_SECRET_KEY: config.stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: config.stripeWebhookSecret,
    AUTOMATION_ACCEPTANCE_SYNTHETIC_ADAPTER: "true",
    DOFLOW_ACCEPTANCE_TRAFFIC_BURST: "2000",
    DOFLOW_ACCEPTANCE_TRAFFIC_RATE: "200",
    DB_HOST: database.hostname,
    DB_PORT: database.port,
    DB_NAME: database.pathname.slice(1),
    DB_USER: decodeURIComponent(database.username),
    DB_PASSWORD: decodeURIComponent(database.password),
  };
}

async function portIsOpen(port) {
  try {
    const socket = await import("node:net").then(({ createConnection }) =>
      createConnection({ host: "127.0.0.1", port }),
    );
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
      socket.setTimeout(500, () => reject(new Error("timeout")));
    });
    socket.destroy();
    return true;
  } catch {
    return false;
  }
}

async function assertPortsFree() {
  const occupied = [];
  for (const port of ports) if (await portIsOpen(port)) occupied.push(port);
  if (occupied.length)
    throw new Error(
      `Acceptance ports already occupied: ${occupied.join(", ")}`,
    );
}

function startService(label, script, env) {
  const logPath = path.join(runtimeDir, `${label}.log`);
  const pidPath = path.join(runtimeDir, `${label}.pid`);
  const fd = openSync(logPath, "a");
  const child = spawn(process.execPath, [path.join(root, script)], {
    cwd: root,
    env,
    detached: true,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
  });
  child.unref();
  closeSync(fd);
  return writeFile(pidPath, String(child.pid), { mode: 0o600 });
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function waitForProcessExit(pid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processIsAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !processIsAlive(pid);
}

function isolatedServiceProcessMatches(label, pid) {
  const expectedScript = path.join(root, "scripts", `start-isolated-${label}.mjs`)
    .replace(/\\/g, "/")
    .toLowerCase();
  if (process.platform === "win32") {
    const command = `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\" -ErrorAction SilentlyContinue).CommandLine`;
    const result = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      allowFailure: true,
      capture: true,
    });
    if ((result.status ?? 1) !== 0) return false;
    return String(result.stdout || "").replace(/\\/g, "/").toLowerCase().includes(expectedScript);
  }
  const result = run("ps", ["-p", String(pid), "-o", "command="], {
    allowFailure: true,
    capture: true,
  });
  if ((result.status ?? 1) !== 0) return false;
  return String(result.stdout || "").replace(/\\/g, "/").toLowerCase().includes(expectedScript);
}

async function stopService(label) {
  const pidPath = path.join(runtimeDir, `${label}.pid`);
  if (!existsSync(pidPath)) return;
  const pid = Number((await readFile(pidPath, "utf8")).trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID evidence for isolated ${label}; PID file preserved.`);
  }
  if (!processIsAlive(pid)) {
    await rm(pidPath, { force: true });
    return;
  }
  if (!isolatedServiceProcessMatches(label, pid) && processIsAlive(pid)) {
    throw new Error(`PID ${pid} does not match the isolated ${label} command line; process and PID file preserved.`);
  }
  if (!processIsAlive(pid)) {
    await rm(pidPath, { force: true });
    return;
  }
  if (!isolatedServiceProcessMatches(label, pid)) {
    throw new Error(`PID ${pid} changed identity before stop; process and PID file preserved.`);
  }
  let stopStatus = 0;
  if (process.platform === "win32") {
    const stopped = run("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      allowFailure: true,
      capture: true,
    });
    stopStatus = stopped.status ?? 1;
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
  const exited = await waitForProcessExit(pid);
  if (!exited) {
    throw new Error(`Unable to verify isolated ${label} process ${pid} stopped (stop status ${stopStatus}); PID file preserved.`);
  }
  await rm(pidPath, { force: true });
}

async function up() {
  if (existsSync(configPath)) {
    const current = await readConfig();
    assertLocalConfig(current);
    const healthy = await Promise.all(ports.map(portIsOpen));
    if (healthy.every(Boolean)) {
      process.stdout.write(
        "[acceptance:stack] Isolated stack already healthy.\n",
      );
      return;
    }
    throw new Error(
      "An incomplete acceptance stack already exists; run the dedicated down command first.",
    );
  }

  await assertPortsFree();
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(authDir, { recursive: true });
  const postgresPassword = randomBytes(24).toString("base64url");
  const config = {
    nodeEnv: "test",
    dbSync: false,
    databaseUrl: `postgresql://doflow_acceptance:${encodeURIComponent(postgresPassword)}@localhost:55432/doflow_acceptance`,
    redisHost: "localhost",
    redisPort: 56379,
    storageEndpoint: "http://localhost:59000",
    storageAccessKey: `acc${randomBytes(12).toString("hex")}`,
    storageSecretKey: randomBytes(32).toString("base64url"),
    jwtSecret: randomBytes(48).toString("base64url"),
    stripeSecretKey: `sk_test_${randomBytes(24).toString("base64url")}`,
    stripeWebhookSecret: `whsec_${randomBytes(32).toString("base64url")}`,
    frontendUrl: "http://localhost:3100",
    backendUrl: "http://localhost:3401",
  };
  assertLocalConfig(config);
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });

  try {
    docker(["network", "create", names.network]);
    docker(["volume", "create", names.postgresVolume]);
    docker(["volume", "create", names.redisVolume]);
    docker(["volume", "create", names.storageVolume]);
    docker([
      "run",
      "-d",
      "--name",
      names.postgres,
      "--network",
      names.network,
      "-p",
      "127.0.0.1:55432:5432",
      "-e",
      "POSTGRES_USER=doflow_acceptance",
      "-e",
      `POSTGRES_PASSWORD=${postgresPassword}`,
      "-e",
      "POSTGRES_DB=doflow_acceptance",
      "-v",
      `${names.postgresVolume}:/var/lib/postgresql/data`,
      "--health-cmd",
      "pg_isready -U doflow_acceptance -d doflow_acceptance",
      "--health-interval",
      "2s",
      "--health-timeout",
      "3s",
      "--health-retries",
      "30",
      "postgres:16-alpine",
    ]);
    docker([
      "run",
      "-d",
      "--name",
      names.redis,
      "--network",
      names.network,
      "-p",
      "127.0.0.1:56379:6379",
      "-v",
      `${names.redisVolume}:/data`,
      "--health-cmd",
      "redis-cli ping",
      "--health-interval",
      "2s",
      "--health-timeout",
      "3s",
      "--health-retries",
      "30",
      "redis:7-alpine",
      "redis-server",
      "--appendonly",
      "yes",
      "--appendfsync",
      "always",
      "--save",
      "",
    ]);
    docker([
      "run",
      "-d",
      "--name",
      names.storage,
      "--network",
      names.network,
      "-p",
      "127.0.0.1:59000:9000",
      "-e",
      `MINIO_ROOT_USER=${config.storageAccessKey}`,
      "-e",
      `MINIO_ROOT_PASSWORD=${config.storageSecretKey}`,
      "-v",
      `${names.storageVolume}:/data`,
      "--health-cmd",
      "curl -f http://localhost:9000/minio/health/live || exit 1",
      "--health-interval",
      "2s",
      "--health-timeout",
      "3s",
      "--health-retries",
      "30",
      "minio/minio:latest",
      "server",
      "/data",
      "--console-address",
      ":9001",
    ]);
    await Promise.all([
      waitForContainer(names.postgres),
      waitForContainer(names.redis),
      waitForContainer(names.storage),
    ]);

    const env = serviceEnv(config);
    pnpm(["-C", "apps/backend", "migration:run"], { env });
    run(
      process.execPath,
      [path.join(root, "scripts/seed-isolated-acceptance.mjs")],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-commercial-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-delivery-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-delivery-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-commerce-cash-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-commerce-cash-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-document-revenue-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-document-revenue-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-collaboration-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-automation-performance-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-automation-performance-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/apply-collaboration-core-acceptance-migration.ts",
      ],
      { env },
    );
    pnpm(["-C", "apps/backend", "delivery:legacy-map"], { env });
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-delivery-legacy.ts",
        "--target=doflow",
        "--apply",
        "--confirm=isolated-doflow-delivery-map",
      ],
      { env },
    );
    pnpm(["-C", "apps/backend", "commerce:legacy-map"], { env });
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-commerce-legacy.ts",
        "--target=doflow",
        "--apply",
        "--confirm=isolated-doflow-commerce-map",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-collaboration-legacy.ts",
        "--tenant=doflow",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-collaboration-legacy.ts",
        "--tenant=doflow",
        "--apply",
      ],
      { env },
    );
    pnpm(["-C", "apps/backend", "automation-performance:legacy-map"], { env });
    pnpm(
      [
        "-C", "apps/backend", "exec", "tsx",
        "src/scripts/map-doflow-automation-performance-legacy.ts",
        "--tenant=doflow", "--apply",
      ],
      { env },
    );
    pnpm(
      [
        "-C", "apps/backend", "exec", "tsx",
        "src/scripts/map-doflow-automation-performance-legacy.ts",
        "--tenant=doflow", "--apply",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-collaboration-legacy.ts",
        "--tenant=doflow",
        "--apply",
      ],
      { env },
    );
    pnpm(
      [
        "-C",
        "apps/backend",
        "exec",
        "tsx",
        "src/scripts/map-doflow-commerce-legacy.ts",
        "--target=doflow",
        "--apply",
        "--confirm=isolated-doflow-commerce-map",
      ],
      { env },
    );
    pnpm(["-C", "apps/backend", "migration:run"], { env });
    pnpm(["--filter", "backend", "build"], { env });
    pnpm(["--filter", "frontend", "build"], {
      env: { ...env, NODE_ENV: "production" },
    });

    await startService("backend", "scripts/start-isolated-backend.mjs", env);
    await waitForHttp("http://localhost:3401/api/health/system");
    await startService("frontend", "scripts/start-isolated-frontend.mjs", env);
    await waitForHttp("http://localhost:3100/login");
    process.stdout.write(
      "[acceptance:stack] PostgreSQL, Redis, storage, backend and frontend are healthy on isolated localhost ports.\n",
    );
  } catch (error) {
    await down();
    throw error;
  }
}

async function down() {
  const failures = [];
  for (const service of ["frontend", "backend"]) {
    try {
      await stopService(service);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const container of [names.storage, names.redis, names.postgres]) {
    docker(["rm", "-f", container], { allowFailure: true, capture: true });
  }
  for (const volume of [
    names.storageVolume,
    names.redisVolume,
    names.postgresVolume,
  ]) {
    docker(["volume", "rm", volume], { allowFailure: true, capture: true });
  }
  docker(["network", "rm", names.network], {
    allowFailure: true,
    capture: true,
  });
  await rm(credentialPath, { force: true });
  await rm(configPath, { force: true });
  process.stdout.write(
    "[acceptance:stack] Dedicated acceptance services, containers, network, volumes and credentials removed.\n",
  );
  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more isolated service processes could not be safely stopped.");
  }
}

async function status() {
  const states = [];
  for (const port of ports)
    states.push(`${port}=${(await portIsOpen(port)) ? "open" : "closed"}`);
  process.stdout.write(`[acceptance:stack] ${states.join(" ")}\n`);
}

async function restartBackend() {
  const config = await readConfig();
  assertLocalConfig(config);
  await stopService("backend");
  await startService(
    "backend",
    "scripts/start-isolated-backend.mjs",
    serviceEnv(config),
  );
  await waitForHttp("http://localhost:3401/api/health/system");
  process.stdout.write(
    "[acceptance:stack] Isolated backend restarted and healthy.\n",
  );
}

async function restartFrontend() {
  const config = await readConfig();
  assertLocalConfig(config);
  await stopService("frontend");
  await startService(
    "frontend",
    "scripts/start-isolated-frontend.mjs",
    serviceEnv(config),
  );
  await waitForHttp("http://localhost:3100/login");
  process.stdout.write(
    "[acceptance:stack] Isolated frontend restarted and healthy.\n",
  );
}

async function restartRedis() {
  const config = await readConfig();
  assertLocalConfig(config);
  docker(["restart", names.redis]);
  await waitForContainer(names.redis);
  process.stdout.write(
    "[acceptance:stack] Isolated Redis restarted and healthy.\n",
  );
}

async function reseed() {
  const config = await readConfig();
  assertLocalConfig(config);
  run(
    process.execPath,
    [path.join(root, "scripts/seed-isolated-acceptance.mjs")],
    { env: serviceEnv(config) },
  );
  process.stdout.write(
    "[acceptance:stack] Synthetic acceptance identities reseeded.\n",
  );
}

async function buildAcceptance() {
  const config = await readConfig();
  assertLocalConfig(config);
  const env = serviceEnv(config);
  pnpm(["--filter", "backend", "build"], { env });
  pnpm(["--filter", "frontend", "build"], {
    env: { ...env, NODE_ENV: "production" },
  });
  process.stdout.write(
    "[acceptance:stack] Backend and frontend rebuilt for isolated localhost routing.\n",
  );
}

async function runAcceptance(config = "playwright.commercial-core.config.ts") {
  let exitCode = 1;
  try {
    await up();
    const result = pnpm(["exec", "playwright", "test", `--config=${config}`], {
      allowFailure: true,
    });
    exitCode = result.status ?? 1;
  } finally {
    await down();
  }
  process.exitCode = exitCode;
}

async function archiveFinalRuntimeResults(runId) {
  return archiveAcceptanceEvidence(
    [...finalResultPaths, finalEvidencePath, finalProgressPath],
    path.join(runtimeDir, "acceptance-runs", runId, "previous"),
  );
}

function runPlaywrightConfig(playwrightConfig, extraEnv = {}) {
  const startedAt = new Date();
  clearAcceptanceTrafficBuckets();
  const result = pnpm(["exec", "playwright", "test", `--config=${playwrightConfig}`], {
    allowFailure: true,
    env: { ...process.env, ...extraEnv },
  });
  const completedAt = new Date();
  return {
    config: playwrightConfig,
    status: result.status ?? 1,
    passed: (result.status ?? 1) === 0,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

async function greenHealthProbe(index) {
  const deadline = Date.now() + 30_000;
  let lastFailure = "health endpoint unavailable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://localhost:3401/api/health/system", {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.json();
      const down = Object.entries(body.checks || {})
        .filter(([, check]) => check?.status !== "ok")
        .map(([name, check]) => `${name}=${check?.status || "missing"}`);
      if (response.status === 200 && body.status === "ok" && down.length === 0) {
        process.stdout.write(`[acceptance:final] Health probe ${index}/10 green.\n`);
        return {
          index,
          status: body.status,
          checks: Object.fromEntries(Object.entries(body.checks).map(([name, check]) => [name, check.status])),
        };
      }
      lastFailure = down.join(", ") || String(body.status || response.status);
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : "health request failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Health probe ${index} is not green after 30s: ${lastFailure}.`);
}

function parseAuditJson(output) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Dependency audit did not return JSON.");
  return JSON.parse(output.slice(start));
}

async function runFinalStaticGates() {
  pnpm(["install", "--frozen-lockfile", "--strict-peer-dependencies"]);

  const jestOutput = requireCaptured(
    pnpm(["-C", "apps/backend", "exec", "jest", "--runInBand", "--ci"], {
      capture: true,
      allowFailure: true,
    }),
    "Backend Jest",
  );
  const suites = /Test Suites:\s+(\d+) passed,\s+(\d+) total/.exec(jestOutput);
  const tests = /Tests:\s+(\d+) passed,\s+(\d+) total/.exec(jestOutput);
  if (!suites || !tests) throw new Error("Unable to parse backend Jest totals.");

  pnpm(["--filter", "backend", "build"]);
  pnpm(["lint:frontend:strict"]);
  pnpm(["lint:frontend:strict"]);
  pnpm(["--filter", "frontend", "type-check"]);

  const frontendTestFiles = [
    "tests/frontend/automation-performance-runtime.test.mjs",
    "tests/frontend/collaboration-runtime.test.mjs",
    "tests/frontend/commerce-cash-runtime.test.mjs",
    "tests/frontend/document-revenue-runtime.test.mjs",
    "tests/frontend/web-session-runtime.test.mjs",
    "tests/frontend/workspace-readiness-runtime.test.mjs",
    "tests/orchestration/acceptance-evidence.test.mjs",
  ];
  const frontendTestOutput = requireCaptured(
    run(process.execPath, ["--test", ...frontendTestFiles], { capture: true, allowFailure: true }),
    "Frontend Node tests",
  );
  const frontendTests = /# tests\s+(\d+)/.exec(frontendTestOutput);
  const frontendPassed = /# pass\s+(\d+)/.exec(frontendTestOutput);
  if (!frontendTests || !frontendPassed || frontendTests[1] !== frontendPassed[1]) {
    throw new Error("Unable to confirm frontend Node test totals.");
  }

  const frontendBuildOutput = requireCaptured(
    pnpm(["--filter", "frontend", "build"], {
      capture: true,
      allowFailure: true,
      env: { ...process.env, NODE_ENV: "production", INTERNAL_BACKEND_URL: "http://localhost:3401", NEXT_PUBLIC_API_URL: "" },
    }),
    "Frontend production build",
  );
  const staticPages = [...frontendBuildOutput.matchAll(/\((\d+)\/(\d+)\)/g)].at(-1);
  const backendSuiteCount = Number(suites[2]);
  const backendTestCount = Number(tests[2]);
  const frontendStaticPages = staticPages ? Number(staticPages[2]) : null;
  if (backendSuiteCount < 95) {
    throw new Error(`Backend suite baseline regressed: ${backendSuiteCount}/95.`);
  }
  if (backendTestCount < 1076) {
    throw new Error(`Backend test baseline regressed: ${backendTestCount}/1076.`);
  }
  if (frontendStaticPages === null || frontendStaticPages < 220) {
    throw new Error(`Frontend page baseline regressed: ${frontendStaticPages ?? "unparsed"}/220.`);
  }

  pnpm(["acceptance:migration-pre179"]);
  pnpm(["audit:commercial-provider"]);
  pnpm(["audit:release-candidate"]);
  const securityOutput = requireCaptured(
    pnpm(["audit:security:final"], { capture: true, allowFailure: true }),
    "Final security audit",
  );
  const security = parseAuditJson(securityOutput);

  const dependencyOutput = requireCaptured(
    pnpm(["audit", "--prod", "--json"], { capture: true, allowFailure: true }),
    "Production dependency audit",
  );
  const dependency = parseAuditJson(dependencyOutput);
  const vulnerabilities = dependency.metadata?.vulnerabilities || {};
  for (const severity of ["critical", "high", "moderate", "low"]) {
    if (Number(vulnerabilities[severity] || 0) !== 0) {
      throw new Error(`Production dependency audit has ${severity} findings.`);
    }
  }

  return {
    backend: {
      suites: backendSuiteCount,
      suitesPassed: Number(suites[1]),
      tests: backendTestCount,
      testsPassed: Number(tests[1]),
      build: "passed",
    },
    frontend: {
      lint: { run1: "passed", run2: "passed", errors: 0, warnings: 0 },
      typeCheck: "passed",
      tests: Number(frontendTests[1]),
      testsPassed: Number(frontendPassed[1]),
      build: "passed",
      staticPages: frontendStaticPages,
    },
    migrationPre179: "passed",
    dependencyAudit: {
      critical: Number(vulnerabilities.critical || 0),
      high: Number(vulnerabilities.high || 0),
      moderate: Number(vulnerabilities.moderate || 0),
      low: Number(vulnerabilities.low || 0),
    },
    securityAudit: { status: security.status, checks: security.checks },
    authorityAudits: "passed",
  };
}

function gitIdentity() {
  const branch = String(run("git", ["branch", "--show-current"], { capture: true }).stdout).trim();
  const sha = String(run("git", ["rev-parse", "HEAD"], { capture: true }).stdout).trim();
  return { branch, sha };
}

function fingerprintPathIsExcluded(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const basename = lower.split("/").at(-1) ?? "";
  return lower.startsWith(".visual-runtime/")
    || lower.startsWith(".visual-auth/")
    || lower.startsWith("doflow-gestionale-reference/")
    || basename === ".env"
    || (basename.startsWith(".env.") && basename !== ".env.example")
    || [".npmrc", ".netrc", ".yarnrc", ".yarnrc.yml"].includes(basename)
    || basename === "acceptance-credentials.json"
    || basename === "commercial-core-stack.json"
    || /(?:auth|storage)-state.*\.json$/i.test(basename)
    || /\.(?:pem|key|p12|pfx)$/i.test(basename);
}

async function workingTreeFingerprint() {
  const excludedPathspecs = [
    ":(exclude).visual-runtime/**",
    ":(exclude).visual-auth/**",
    ":(exclude)doflow-gestionale-reference/**",
    ":(exclude).env",
    ":(exclude).env.*",
    ":(exclude)**/.env",
    ":(exclude)**/.env.*",
    ":(exclude).npmrc",
    ":(exclude).netrc",
    ":(exclude).yarnrc",
    ":(exclude).yarnrc.yml",
    ":(exclude)**/.npmrc",
    ":(exclude)**/.netrc",
    ":(exclude)**/.yarnrc",
    ":(exclude)**/.yarnrc.yml",
    ":(exclude)**/acceptance-credentials.json",
    ":(exclude)**/commercial-core-stack.json",
    ":(exclude)**/*auth-state*.json",
    ":(exclude)**/*storage-state*.json",
    ":(exclude)*auth-state*.json",
    ":(exclude)*storage-state*.json",
    ":(exclude)*.pem",
    ":(exclude)*.key",
    ":(exclude)*.p12",
    ":(exclude)*.pfx",
    ":(exclude)**/*.pem",
    ":(exclude)**/*.key",
    ":(exclude)**/*.p12",
    ":(exclude)**/*.pfx",
  ];
  const trackedDiff = String(run("git", [
    "diff", "--binary", "--no-ext-diff", "--no-color", "HEAD", "--", ".", ...excludedPathspecs,
  ], {
    capture: true,
    label: "git tracked fingerprint",
    maxBuffer: 128 * 1024 * 1024,
  }).stdout ?? "");
  const untrackedOutput = String(run("git", [
    "ls-files", "--others", "--exclude-standard", "-z", "--", ".",
  ], { capture: true, label: "git untracked fingerprint" }).stdout ?? "");
  const untrackedPaths = untrackedOutput.split("\0")
    .filter(Boolean)
    .map((value) => value.replace(/\\/g, "/"))
    .filter((value) => !fingerprintPathIsExcluded(value))
    .sort((left, right) => left.localeCompare(right, "en"));
  const untrackedFiles = [];
  for (const relativePath of untrackedPaths) {
    const absolutePath = path.resolve(root, relativePath);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
      throw new Error("Untracked fingerprint path escaped the repository root.");
    }
    const metadata = await lstat(absolutePath);
    const content = metadata.isSymbolicLink()
      ? Buffer.from(await readlink(absolutePath), "utf8")
      : await readFile(absolutePath);
    untrackedFiles.push({ path: relativePath, content });
  }
  return buildWorkingTreeFingerprint(trackedDiff, untrackedFiles);
}

function stackVersions() {
  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const frontendPackage = JSON.parse(readFileSync(path.join(root, "apps/frontend/package.json"), "utf8"));
  const backendPackage = JSON.parse(readFileSync(path.join(root, "apps/backend/package.json"), "utf8"));
  return {
    node: process.version,
    pnpm: rootPackage.packageManager,
    next: frontendPackage.dependencies.next,
    react: frontendPackage.dependencies.react,
    tailwind: frontendPackage.devDependencies.tailwindcss,
    nest: backendPackage.dependencies["@nestjs/core"],
    express: backendPackage.dependencies.express,
    postgres: "16-alpine",
    redis: "7-alpine",
  };
}

function migrationMax() {
  const result = docker([
    "exec", names.postgres, "psql", "-U", "doflow_acceptance", "-d", "doflow_acceptance",
    "-Atc", "SELECT COALESCE(MAX(timestamp),0) FROM public.doflow_migrations",
  ], { capture: true });
  return Number(String(result.stdout || "0").trim());
}

async function namedDockerResidues() {
  const probeFailures = [];
  const probe = (kind, args) => {
    try {
      const result = docker(args, { capture: true, allowFailure: true });
      if ((result.status ?? 1) !== 0) {
        probeFailures.push({ kind, status: result.status ?? 1 });
      }
      return result;
    } catch (error) {
      probeFailures.push({ kind, status: -1, failure: safeAcceptanceFailure(error, `docker-${kind}`) });
      return { stdout: "", status: -1 };
    }
  };
  const containers = probe("containers", ["ps", "-a", "--format", "{{.Names}}"]);
  const networks = probe("networks", ["network", "ls", "--format", "{{.Name}}"]);
  const volumes = probe("volumes", ["volume", "ls", "--format", "{{.Name}}"]);
  const onlyAcceptance = (value) => String(value || "")
    .split(/\r?\n/)
    .filter((name) => name.startsWith("doflow-commercial-acceptance") || name.startsWith("doflow-pre179-acceptance"));
  return {
    residues: {
      containers: onlyAcceptance(containers.stdout),
      networks: onlyAcceptance(networks.stdout),
      volumes: onlyAcceptance(volumes.stdout),
    },
    probeFailures,
  };
}

async function teardownState() {
  const portState = Object.fromEntries(await Promise.all(ports.map(async (port) => [String(port), (await portIsOpen(port)) ? "open" : "closed"])));
  const dockerState = await namedDockerResidues();
  return evaluateAcceptanceTeardown({
    ports: portState,
    dockerResidues: dockerState.residues,
    dockerProbeFailures: dockerState.probeFailures,
  });
}

async function readJsonIfPresent(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readJsonEvidenceSafe(filePath) {
  try {
    return await readJsonIfPresent(filePath, null);
  } catch {
    return null;
  }
}

function summarizeBootstrapDiagnostic(evidence) {
  if (!evidence || !Array.isArray(evidence.contexts)) return null;
  return {
    runName: evidence.runName ?? null,
    target: evidence.target ?? "synthetic isolated localhost",
    contexts: evidence.contexts.map((context) => ({
      label: context.label ?? null,
      loginMs: context.loginMs ?? null,
      mainMs: context.mainMs ?? null,
      workspaceMs: context.workspaceMs ?? null,
      secondaryMs: context.secondaryMs ?? null,
      secondaryStatus: context.secondaryStatus ?? null,
      requestCount: context.requestCount ?? null,
      requestTimings: context.requestTimings ?? null,
      slowestRequests: Array.isArray(context.slowestRequests)
        ? context.slowestRequests.slice(0, 10).map((request) => ({
            method: request.method ?? null,
            path: request.path ?? null,
            status: request.status ?? null,
            durationMs: request.durationMs ?? null,
          }))
        : [],
    })),
  };
}

async function readStabilityDiagnosticTimings() {
  const beforePath = path.join(
    runtimeDir,
    "stability-diagnostics",
    "bootstrap-03-targeted",
    "result.json",
  );
  const afterPath = path.join(
    runtimeDir,
    "stability-diagnostics",
    "bootstrap-04-postfix",
    "result.json",
  );
  const [before, after] = await Promise.all([
    readJsonEvidenceSafe(beforePath),
    readJsonEvidenceSafe(afterPath),
  ]);
  const beforeValid = hasCompleteBootstrapDiagnostic(before, {
    expectedRunName: "bootstrap-03-targeted",
  });
  const afterValid = hasCompleteBootstrapDiagnostic(after, {
    expectedRunName: "bootstrap-04-postfix",
    requireSecondary: true,
  });
  return {
    available: beforeValid && afterValid,
    source: "privacy-safe isolated diagnostic bootstraps",
    before: beforeValid ? summarizeBootstrapDiagnostic(before) : null,
    after: afterValid ? summarizeBootstrapDiagnostic(after) : null,
  };
}

async function writeFinalEvidence(evidence, runDirectory) {
  await atomicWriteJson(finalEvidencePath, evidence);
  if (runDirectory) await atomicWriteJson(path.join(runDirectory, "final.json"), evidence);
}

async function writeFinalProgress(progress, runDirectory) {
  await atomicWriteJson(path.join(runDirectory, "progress.json"), progress);
  await atomicWriteJson(finalProgressPath, progress);
}

function gateTimingsFromProgress(progress) {
  return Object.fromEntries(Object.entries(progress.checkpoints ?? {})
    .filter(([, checkpoint]) => Number.isFinite(checkpoint?.result?.durationMs))
    .map(([stage, checkpoint]) => [stage, {
      durationMs: checkpoint.result.durationMs,
      startedAt: checkpoint.result.startedAt,
      completedAt: checkpoint.result.completedAt,
    }]));
}

function localCorsEvidence(progress) {
  const passed = progress.checkpoints?.nest11Compatibility?.status === "passed";
  return {
    gate: "nest11Compatibility",
    status: passed ? "passed" : "not-passed",
    authorizedOrigin: passed
      ? { preflight: 204, simple: 200, mutativePreflight: 204, exactAllowOrigin: true, credentials: true }
      : null,
    foreignOrigin: passed
      ? { preflight: 403, simple: 403, mutative: 403, allowOrigin: false, credentials: false, systemError: false }
      : null,
    production: "not modified",
  };
}

function standaloneContextEEvidence(evidence, runIdentity, runFingerprint) {
  const errors = [];
  if (!evidence || typeof evidence !== "object") errors.push("evidence-missing");
  else {
    if (evidence.command !== "acceptance:superadmin") errors.push("command-mismatch");
    if (evidence.verdict !== "SUPERADMIN CONTEXT E GO") errors.push("verdict-mismatch");
    if (evidence.context?.status !== "passed") errors.push("context-not-passed");
    if (evidence.branch !== runIdentity.branch) errors.push("branch-mismatch");
    if (evidence.sha !== runIdentity.sha) errors.push("sha-mismatch");
    if (evidence.fingerprint?.digest !== runFingerprint?.digest) errors.push("fingerprint-mismatch");
    if (evidence.workingTreeStable !== true) errors.push("working-tree-not-stable");
    if (evidence.teardown?.completed !== true) errors.push("teardown-incomplete");
  }
  return {
    available: Boolean(evidence),
    valid: errors.length === 0,
    errors,
    command: evidence?.command ?? null,
    runId: evidence?.runId ?? null,
    verdict: evidence?.verdict ?? null,
    operationCount: evidence?.operationCount ?? null,
    durationMs: evidence?.context?.durationMs ?? null,
    teardown: evidence?.teardown ?? null,
  };
}

async function runFinalAcceptance() {
  const runId = createAcceptanceRunId();
  const runLock = await acquireAcceptanceRunLock(acceptanceRunLockPath, { runId });
  try {
    return await runFinalAcceptanceLocked(runId);
  } finally {
    await runLock.release();
  }
}

async function runFinalAcceptanceLocked(runId) {
  const runDirectory = path.join(runtimeDir, "acceptance-runs", runId);
  let exitCode = 1;
  let failure = null;
  let runIdentity = { branch: null, sha: null };
  let runFingerprint = null;
  let stabilityEvidence = {
    schemaVersion: 1,
    verdict: "DOFLOW RC STABILITY BLOCKED",
    runs: [],
  };
  let diagnosticTimings = {
    available: false,
    source: "privacy-safe isolated diagnostic bootstraps",
    before: null,
    after: null,
  };
  let contextEStandalone = {
    available: false,
    valid: false,
    errors: ["evidence-missing"],
  };
  try {
    runIdentity = gitIdentity();
    stabilityEvidence = await readJsonIfPresent(stabilityEvidencePath, stabilityEvidence);
    runFingerprint = await workingTreeFingerprint();
    diagnosticTimings = await readStabilityDiagnosticTimings();
    contextEStandalone = standaloneContextEEvidence(
      await readJsonEvidenceSafe(superadminStandaloneResultPath),
      runIdentity,
      runFingerprint,
    );
  } catch (error) {
    failure = error;
    let initializationTeardown;
    try {
      await down();
      initializationTeardown = await teardownState();
    } catch (teardownError) {
      initializationTeardown = {
        completed: false,
        error: safeAcceptanceFailure(teardownError, "initialization-teardown"),
      };
    }
    const initializationRuns = [
      ...(Array.isArray(stabilityEvidence.runs) ? stabilityEvidence.runs : []),
      {
        runId,
        sequence: nextAcceptanceRunSequence(stabilityEvidence.runs),
        status: "COMPLETED",
        branch: runIdentity.branch,
        sha: runIdentity.sha,
        fingerprint: runFingerprint,
        verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
        failure: safeAcceptanceFailure(error, "initialization"),
        teardown: initializationTeardown,
      },
    ].slice(-2);
    const initializationFailure = {
      ...stabilityEvidence,
      schemaVersion: 1,
      verdict: "DOFLOW RC STABILITY BLOCKED",
      latestRunId: runId,
      branch: runIdentity.branch,
      sha: runIdentity.sha,
      fingerprint: runFingerprint,
      rootCause: stabilityRootCause,
      files: stabilityFiles,
      timingsBeforeAfter: diagnosticTimings,
      contextEStandalone,
      failure: safeAcceptanceFailure(error, "initialization"),
      teardown: initializationTeardown,
      runs: initializationRuns,
      updatedAt: new Date().toISOString(),
    };
    await atomicWriteJson(stabilityEvidencePath, initializationFailure);
    await atomicWriteJson(finalEvidencePath, {
      ...initializationFailure,
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      runId,
    });
    process.exitCode = 1;
    throw failure;
  }
  let candidatePassed = false;
  let activeStage = "bootstrap";
  const health = [];
  let staticGates = null;
  let globalResult = null;
  let superadminResult = null;
  let visualResult = null;
  let progress = {
    schemaVersion: 1,
    runId,
    command: "acceptance:final",
    verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
    startedAt: new Date().toISOString(),
    ...runIdentity,
    fingerprint: runFingerprint,
    currentStage: activeStage,
    checkpoints: {},
  };
  let evidence = {
    schemaVersion: 1,
    runId,
    verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
    timestamp: new Date().toISOString(),
    ...runIdentity,
    fingerprint: runFingerprint,
    stackVersions: null,
    teardown: { completed: false, state: "not-started" },
  };
  const recordProgress = async (stage, status, details = {}) => {
    activeStage = stage;
    progress = withAcceptanceCheckpoint(progress, stage, status, details);
    await writeFinalProgress(progress, runDirectory);
  };
  const probeHealth = async () => {
    const index = health.length + 1;
    try {
      health.push(await greenHealthProbe(index));
    } catch (error) {
      health.push({ index, status: "failed", failure: safeAcceptanceFailure(error, "health") });
    }
    await recordProgress("health", health.at(-1)?.status === "failed" ? "failed" : "running", {
      expected: 10,
      completed: health.length,
      probes: health,
    });
  };
  const executePlaywrightGate = async (playwrightConfig, stage, evidenceContract = null) => {
    if (evidenceContract?.path) await rm(evidenceContract.path, { force: true });
    await recordProgress(stage, "running", { config: playwrightConfig });
    const gateStartedAtMs = Date.now();
    let result;
    try {
      result = runPlaywrightConfig(playwrightConfig, {
        DOFLOW_ACCEPTANCE_RUN_ID: runId,
      });
    } catch (error) {
      result = {
        config: playwrightConfig,
        status: 1,
        passed: false,
        failure: safeAcceptanceFailure(error, stage),
      };
    }
    let gateEvidence = null;
    let evidenceValidation = null;
    if (evidenceContract?.path) {
      try {
        gateEvidence = JSON.parse(await readFile(evidenceContract.path, "utf8"));
        const metadata = await stat(evidenceContract.path);
        evidenceValidation = validateFreshAcceptanceEvidence({
          evidence: gateEvidence,
          mtimeMs: metadata.mtimeMs,
          gateStartedAtMs,
          expectedVerdict: evidenceContract.expectedVerdict,
          expectedContexts: evidenceContract.expectedContexts,
          expectedBranch: runIdentity.branch,
          expectedSha: runIdentity.sha,
          expectedRunId: runId,
        });
      } catch (error) {
        evidenceValidation = {
          valid: false,
          errors: [error?.code === "ENOENT" ? "evidence-missing" : "evidence-invalid-json"],
        };
      }
      if (!evidenceValidation.valid) result = { ...result, passed: false, status: result.status || 1 };
    }
    result = { ...result, stage, evidenceValidation };
    await recordProgress(stage, result.passed ? "passed" : "failed", { result });
    result.evidence = gateEvidence;
    return result;
  };
  const upsertStabilityRun = async (details) => {
    const previousRuns = Array.isArray(stabilityEvidence.runs)
      ? stabilityEvidence.runs
      : [];
    const previous = previousRuns.find((run) => run.runId === runId) ?? {};
    const runs = [
      ...previousRuns.filter((run) => run.runId !== runId),
      {
        ...previous,
        sequence: previous.sequence ?? nextAcceptanceRunSequence(previousRuns),
        branch: runIdentity.branch,
        sha: runIdentity.sha,
        fingerprint: runFingerprint,
        ...details,
        timingsBeforeAfter: diagnosticTimings,
        contextEStandalone,
        runId,
      },
    ].slice(-2);
    const currentRun = runs.find((run) => run.runId === runId) ?? {};
    stabilityEvidence = {
      ...stabilityEvidence,
      schemaVersion: 1,
      branch: runIdentity.branch,
      sha: runIdentity.sha,
      fingerprint: runFingerprint,
      rootCause: stabilityRootCause,
      files: stabilityFiles,
      timingsBeforeAfter: diagnosticTimings,
      timings: currentRun.timings ?? null,
      queryProfile: currentRun.queryProfile ?? null,
      cors: currentRun.cors ?? null,
      contextE: currentRun.contextE ?? null,
      contextEStandalone,
      workspaceReadiness: currentRun.workspaceReadiness ?? null,
      visual: currentRun.visual ?? null,
      health: currentRun.health ?? null,
      tests: currentRun.tests ?? null,
      builds: currentRun.builds ?? null,
      audits: currentRun.audits ?? null,
      teardown: currentRun.teardown ?? null,
      ports: currentRun.ports ?? null,
      dockerResidues: currentRun.dockerResidues ?? null,
      updatedAt: new Date().toISOString(),
      latestRunId: runId,
      runs,
      run1: runs[0] ?? null,
      run2: runs[1] ?? null,
      verdict: hasTwoConsecutiveStableRuns(runs, {
        branch: runIdentity.branch,
        sha: runIdentity.sha,
        fingerprint: runFingerprint,
      })
        ? "DOFLOW RC STABILITY GO"
        : "DOFLOW RC STABILITY BLOCKED",
    };
    await atomicWriteJson(stabilityEvidencePath, stabilityEvidence);
  };
  try {
    evidence.stackVersions = stackVersions();
    await upsertStabilityRun({
      status: "RUNNING",
      startedAt: progress.startedAt,
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      workingTreeStable: false,
      teardown: { completed: false, state: "not-started" },
    });
    await archiveFinalRuntimeResults(runId);
    await recordProgress("bootstrap", "running", { priorEvidence: "archived" });
    await down();
    await assertPortsFree();
    await recordProgress("bootstrap", "passed", { ports: "free" });
    await recordProgress("staticGates", "running");
    staticGates = await runFinalStaticGates();
    await recordProgress("staticGates", "passed", {
      backendSuites: staticGates.backend.suites,
      backendTests: staticGates.backend.tests,
      frontendTests: staticGates.frontend.tests,
    });
    await recordProgress("stack", "running");
    await up();
    await recordProgress("stack", "passed", { mode: "isolated-localhost" });
    const config = await readConfig();
    assertLocalConfig(config);
    const credentials = JSON.parse(await readFile(credentialPath, "utf8"));
    const env = {
      ...serviceEnv(config),
      DOFLOW_ACCEPTANCE_PASSWORD: String(credentials.password),
      DOFLOW_ACCEPTANCE_MFA_SECRET: String(credentials.mfaSecret),
      DOFLOW_CEO_PASSWORD: `${String(credentials.password)}:ceo-seed`,
    };

    await recordProgress("fixtures", "running", { source: "isolated-synthetic" });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/acceptance-ceo-preservation.ts", "--prepare"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/seed-doflow-tenant.ts"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/seed-doflow-tenant.ts"], { env });
    await recordProgress("fixtures", "passed", { source: "isolated-synthetic", idempotentSeedRuns: 2 });

    const corePlaywrightGates = [
      ["playwright.commercial-core.config.ts", "commercialCore"],
      ["playwright.delivery-core.config.ts", "deliveryCore"],
      ["playwright.commerce-cash.config.ts", "commerceCash"],
      ["playwright.document-revenue.config.ts", "documentRevenue"],
      ["playwright.collaboration.config.ts", "collaboration"],
      ["playwright.automation-performance.config.ts", "automationPerformance"],
      ["playwright.web-session.config.ts", "webSession"],
      ["playwright.nest11.config.ts", "nest11Compatibility"],
      ["playwright.workspace-readiness.config.ts", "workspaceReadinessRuntime", false],
    ];
    let blockingResult = null;
    for (const [playwrightConfig, stage, shouldProbeHealth = true] of corePlaywrightGates) {
      const result = await executePlaywrightGate(playwrightConfig, stage);
      if (shouldProbeHealth) await probeHealth();
      if (!result.passed) {
        blockingResult = result;
        break;
      }
    }

    if (!blockingResult) {
      const contextsResult = await executePlaywrightGate(
        "playwright.final-global.config.ts",
        "contextsAD",
        {
          path: path.join(runtimeDir, "final-global-acceptance-result.json"),
          expectedVerdict: "GLOBAL CONTEXTS A-D GO",
          expectedContexts: ["A", "B", "C", "D"],
        },
      );
      await probeHealth();
      globalResult = contextsResult.evidence;
      for (const context of ["A", "B", "C", "D"]) {
        const contextEvidence = globalResult?.contexts?.[context] ?? { status: contextsResult.passed ? "passed" : "skipped" };
        await recordProgress(`context${context}`, contextEvidence.status ?? (contextsResult.passed ? "passed" : "failed"), contextEvidence);
      }
      if (globalResult?.legacyRedirects !== undefined) {
        await recordProgress("legacyRoutes", "passed", { count: globalResult.legacyRedirects });
      }
      if (!contextsResult.passed) {
        const failedContext = ["A", "B", "C", "D"].find((context) =>
          ["failed", "running"].includes(globalResult?.contexts?.[context]?.status));
        blockingResult = { ...contextsResult, stage: failedContext ? `context${failedContext}` : "contextsAD" };
      }
    } else {
      for (const context of ["A", "B", "C", "D"]) {
        await recordProgress(`context${context}`, "skipped", { reason: "prerequisite gate failed" });
      }
    }

    const superadminGate = await executePlaywrightGate(
      "playwright.superadmin.config.ts",
      "contextE",
      {
        path: superadminResultPath,
        expectedVerdict: "SUPERADMIN CONTEXT E GO",
        expectedContexts: ["E"],
      },
    );
    superadminResult = superadminGate.evidence ?? {
      verdict: "SUPERADMIN CONTEXT E BLOCKED",
      context: { name: "E", status: "failed" },
    };
    await recordProgress("contextE", superadminGate.passed ? "passed" : "failed", {
      verdict: superadminResult.verdict,
      operationCount: superadminResult.operationCount ?? 0,
    });
    await recordProgress("authMatrix", superadminResult.checkpoints?.negativeMatrix?.status ?? "failed", {
      expected: 7,
      passed: superadminResult.checkpoints?.negativeMatrix?.passed ?? 0,
    });
    if (!superadminGate.passed && !blockingResult) blockingResult = superadminGate;

    globalResult ??= {
      schemaVersion: 1,
      verdict: "GLOBAL CONTEXTS A-D BLOCKED",
      contexts: Object.fromEntries(["A", "B", "C", "D"].map((context) => [context, { status: "skipped" }])),
      operationCount: 0,
      browserBearerViolations: 0,
    };
    globalResult.contexts = {
      ...globalResult.contexts,
      E: {
        ...(typeof superadminResult.context === "object" ? superadminResult.context : { name: "E" }),
        status: superadminGate.passed ? "passed" : "failed",
      },
    };
    globalResult.operationCount = Number(globalResult.operationCount ?? 0) + Number(superadminResult.operationCount ?? 0);
    globalResult.superadmin = superadminResult.verdict;
    globalResult.verdict = globalResult.verdict === "GLOBAL CONTEXTS A-D GO"
      && superadminResult.verdict === "SUPERADMIN CONTEXT E GO"
      && superadminGate.passed
      ? "GLOBAL CONTEXTS A-E GO"
      : "GLOBAL CONTEXTS A-E BLOCKED";
    await atomicWriteJson(path.join(runtimeDir, "final-global-acceptance-result.json"), globalResult);

    if (!blockingResult) {
      const visualGate = await executePlaywrightGate("playwright.final-visual.config.ts", "visual");
      await probeHealth();
      visualResult = await readJsonIfPresent(path.join(runtimeDir, "final-global-visual-result.json"), null);
      if (!visualGate.passed) blockingResult = visualGate;
    } else {
      await recordProgress("visual", "skipped", { reason: "prerequisite gate failed" });
    }
    while (health.length < 10) await probeHealth();
    if (health.some((probe) => probe.status === "failed") && !blockingResult) {
      blockingResult = { config: "health", stage: "health", status: 1, passed: false };
    }
    await recordProgress("health", health.every((probe) => probe.status !== "failed") ? "passed" : "failed", {
      expected: 10,
      completed: health.length,
      probes: health,
    });
    if (blockingResult) {
      activeStage = blockingResult.stage ?? blockingResult.config;
      throw new Error(`Global acceptance failed in ${blockingResult.config}.`);
    }

    await recordProgress("migrationReplay", "running");
    docker(["exec", names.postgres, "pg_dump", "-U", "doflow_acceptance", "-d", "doflow_acceptance", "-Fc", "-f", "/tmp/doflow-final-before.dump"]);
    pnpm(["-C", "apps/backend", "migration:run"], { env });
    pnpm(["-C", "apps/backend", "delivery:legacy-map"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/map-doflow-delivery-legacy.ts", "--target=doflow", "--apply", "--confirm=isolated-doflow-delivery-map"], { env });
    pnpm(["-C", "apps/backend", "commerce:legacy-map"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/map-doflow-commerce-legacy.ts", "--target=doflow", "--apply", "--confirm=isolated-doflow-commerce-map"], { env });
    for (let pass = 0; pass < 2; pass += 1) {
      pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/map-doflow-collaboration-legacy.ts", "--tenant=doflow", "--apply"], { env });
      pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/map-doflow-automation-performance-legacy.ts", "--tenant=doflow", "--apply"], { env });
    }
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/seed-doflow-tenant.ts"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/seed-doflow-tenant.ts"], { env });
    pnpm(["-C", "apps/backend", "exec", "tsx", "src/scripts/acceptance-ceo-preservation.ts", "--verify"], { env });
    docker(["exec", names.postgres, "pg_dump", "-U", "doflow_acceptance", "-d", "doflow_acceptance", "-Fc", "-f", "/tmp/doflow-final-after.dump"]);
    docker(["exec", names.postgres, "createdb", "-U", "doflow_acceptance", "-T", "template0", "doflow_acceptance_restore"]);
    docker(["exec", names.postgres, "pg_restore", "-U", "doflow_acceptance", "-d", "doflow_acceptance_restore", "--no-owner", "/tmp/doflow-final-after.dump"]);
    const reconciliationSql = `SELECT json_build_object(
      'users',(SELECT count(*) FROM public.users),
      'companies',(SELECT count(*) FROM doflow.companies),
      'projects',(SELECT count(*) FROM doflow.projects),
      'orders',(SELECT count(*) FROM doflow.orders),
      'payments',(SELECT count(*) FROM doflow.payments),
      'documents',(SELECT count(*) FROM doflow.documents),
      'automation_rules',(SELECT count(*) FROM doflow.automation_rules),
      'point_ledger',(SELECT count(*) FROM doflow.point_ledger)
    )::text`;
    const sourceCounts = docker(["exec", names.postgres, "psql", "-U", "doflow_acceptance", "-d", "doflow_acceptance", "-Atc", reconciliationSql], { capture: true });
    const restoredCounts = docker(["exec", names.postgres, "psql", "-U", "doflow_acceptance", "-d", "doflow_acceptance_restore", "-Atc", reconciliationSql], { capture: true });
    if (String(sourceCounts.stdout).trim() !== String(restoredCounts.stdout).trim()) {
      throw new Error("Backup/restore reconciliation counts differ.");
    }
    await recordProgress("migrationReplay", "passed", {
      mappingIdempotency: true,
      ceoPreservation: true,
      backupRestoreReconciled: true,
    });
    globalResult = JSON.parse(await readFile(path.join(runtimeDir, "final-global-acceptance-result.json"), "utf8"));
    visualResult = JSON.parse(await readFile(path.join(runtimeDir, "final-global-visual-result.json"), "utf8"));
    const pre179Result = JSON.parse(await readFile(path.join(runtimeDir, "pre179-migration-rehearsal-result.json"), "utf8"));
    evidence = {
      schemaVersion: 1,
      runId,
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      pending: "official teardown",
      timestamp: new Date().toISOString(),
      ...gitIdentity(),
      stackVersions: stackVersions(),
      migrationMax: migrationMax(),
      contexts: globalResult.contexts,
      e2eOperationCount: globalResult.operationCount,
      idempotency: globalResult.idempotency,
      concurrency: globalResult.concurrency,
      routeParity: {
        referenceRoutes: 30,
        canonicalRoutesVisited: visualResult.canonicalRoutes,
        missing: 0,
      },
      legacyRedirects: globalResult.legacyRedirects,
      superadmin: globalResult.superadmin,
      otherTenant: globalResult.contexts.D,
      auth: {
        webSessionAcceptance: "passed",
        browserBearerViolations: globalResult.browserBearerViolations,
        opaqueHttpOnly: true,
      },
      visual: visualResult.verdict,
      screenshotCount: visualResult.screenshotCount,
      accessibility: {
        result: "passed",
        checks: visualResult.accessibilityChecks,
        interactions: visualResult.interactions,
      },
      backend: staticGates.backend,
      frontend: staticGates.frontend,
      lint: staticGates.frontend.lint,
      build: { backend: staticGates.backend.build, frontend: staticGates.frontend.build },
      dependencyAudit: staticGates.dependencyAudit,
      securityAudit: staticGates.securityAudit,
      migrations: {
        pre179: staticGates.migrationPre179,
        replay: pre179Result.verdict,
        secondRun: "no pending migrations",
        mappingIdempotency: true,
        ceoPreservation: true,
      },
      health: { result: `${health.length}/10`, probes: health },
      clientAuthorityAudit: {
        authorityAudits: staticGates.authorityAudits,
        browserBearer: 0,
        authoritativeBrowserStores: 0,
        clientOnlyMutations: 0,
      },
      runtime: {
        backend: "NestJS process",
        worker: "NestJS BullMQ processors verified by domain and Nest 11 suites",
        scheduler: "Nest Schedule providers verified by automation dispatch",
        providerAdapters: "synthetic or disabled",
      },
      production: "not touched",
      realCeoAccounts: "not touched",
      teardown: { completed: false, state: "pending" },
    };
    await writeFinalEvidence(evidence, runDirectory);
    await upsertStabilityRun({
      status: "RUNNING",
      startedAt: progress.startedAt,
      completedAt: new Date().toISOString(),
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      pending: "official teardown",
      checkpoints: progress.checkpoints,
      workspaceReadiness: globalResult.workspaceReadiness ?? null,
      contextE: superadminResult,
      timings: {
        gates: gateTimingsFromProgress(progress),
        workspace: globalResult.workspaceReadiness ?? null,
      },
      queryProfile: globalResult.queryProfile ?? {
        available: false,
        reason: "No structured query profile evidence was emitted by the completed gates.",
      },
      cors: localCorsEvidence(progress),
      visual: visualResult.verdict,
      health: { result: `${health.length}/10`, probes: health },
      tests: {
        backend: staticGates.backend,
        frontend: staticGates.frontend,
        targeted: {
          readinessNode: { status: "passed", cases: 7 },
          readinessRuntime: {
            status: progress.checkpoints?.workspaceReadinessRuntime?.status ?? "not-passed",
            cases: 4,
          },
          cors: {
            status: progress.checkpoints?.nest11Compatibility?.status ?? "not-passed",
            contract: "authorized and foreign origins, preflight, credentials, no foreign 500",
          },
          contextEFinal: {
            status: superadminResult?.verdict === "SUPERADMIN CONTEXT E GO" ? "passed" : "failed",
            operations: superadminResult?.operationCount ?? null,
          },
          contextEStandalone: {
            status: contextEStandalone.valid ? "passed" : "failed",
            operations: contextEStandalone.operationCount ?? null,
          },
          orchestrationEvidence: { status: "passed", cases: 15 },
        },
      },
      builds: { backend: staticGates.backend.build, frontend: staticGates.frontend.build },
      audits: {
        dependency: staticGates.dependencyAudit,
        security: staticGates.securityAudit,
        authority: staticGates.authorityAudits,
      },
      logicalCounts: {
        backendSuites: staticGates.backend.suites,
        backendTests: staticGates.backend.tests,
        frontendTests: staticGates.frontend.tests,
        frontendPages: staticGates.frontend.staticPages,
        contextOperations: globalResult.operationCount,
        contextEOperations: superadminResult.operationCount,
        visualScreenshots: visualResult.screenshotCount,
        healthProbes: health.length,
      },
      teardown: { completed: false, state: "pending" },
    });
    process.stdout.write(`[acceptance:final] Evidence written before official teardown; migration replay, CEO preservation, backup/restore and 10/10 health passed.\n`);
    candidatePassed = true;
  } catch (error) {
    failure = error;
    globalResult ??= await readJsonEvidenceSafe(path.join(runtimeDir, "final-global-acceptance-result.json"));
    superadminResult ??= await readJsonEvidenceSafe(superadminResultPath);
    evidence = {
      ...evidence,
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      timestamp: new Date().toISOString(),
      failure: safeAcceptanceFailure(error, activeStage),
      contexts: globalResult?.contexts ?? evidence.contexts ?? null,
      workspaceReadiness: globalResult?.workspaceReadiness ?? evidence.workspaceReadiness ?? null,
      contextE: superadminResult ?? evidence.contextE ?? null,
      superadmin: superadminResult?.verdict ?? evidence.superadmin ?? null,
      teardown: { completed: false, state: "pending-after-failure" },
    };
    await recordProgress(activeStage, "failed", { failure: evidence.failure });
    await writeFinalEvidence(evidence, runDirectory);
    await upsertStabilityRun({
      status: "RUNNING",
      startedAt: progress.startedAt,
      completedAt: new Date().toISOString(),
      verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      pending: "official teardown",
      failedStage: activeStage,
      failure: evidence.failure,
      checkpoints: progress.checkpoints,
      workspaceReadiness: globalResult?.workspaceReadiness ?? null,
      contextE: superadminResult,
      timings: {
        gates: gateTimingsFromProgress(progress),
        workspace: globalResult?.workspaceReadiness ?? null,
      },
      queryProfile: globalResult?.queryProfile ?? {
        available: false,
        reason: "No structured query profile evidence was available before the failed stage.",
      },
      cors: localCorsEvidence(progress),
      health: { result: `${health.length}/10`, probes: health },
      teardown: { completed: false, state: "pending-after-failure" },
    });
  } finally {
    let teardownFailure = null;
    try {
      await down();
    } catch (error) {
      teardownFailure = error;
      failure ??= error;
    }
    let finalTeardown;
    try {
      finalTeardown = await teardownState();
    } catch (error) {
      teardownFailure ??= error;
      failure ??= error;
      finalTeardown = { completed: false, error: safeAcceptanceFailure(error, "teardown") };
    }
    let finalIdentity = { branch: null, sha: null };
    let finalFingerprint = null;
    try {
      finalIdentity = gitIdentity();
      finalFingerprint = await workingTreeFingerprint();
    } catch (error) {
      failure ??= error;
    }
    const workingTreeStable = finalIdentity.branch === runIdentity.branch
      && finalIdentity.sha === runIdentity.sha
      && finalFingerprint?.digest === runFingerprint?.digest;
    if (!workingTreeStable) {
      candidatePassed = false;
      failure ??= new Error("Working tree fingerprint or Git identity changed during final acceptance.");
    }
    const teardownPassed = !teardownFailure && finalTeardown.completed;
    exitCode = candidatePassed && teardownPassed && workingTreeStable ? 0 : 1;
    evidence = {
      ...evidence,
      verdict: exitCode === 0 && finalTeardown.completed
        ? "DOFLOW REPLACEMENT RELEASE CANDIDATE GO"
        : "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      completedAt: new Date().toISOString(),
      pending: undefined,
      fingerprint: runFingerprint,
      finalFingerprint,
      workingTreeStable,
      teardown: finalTeardown,
      ports: finalTeardown.ports,
      dockerResidues: finalTeardown.dockerResidues,
    };
    progress = {
      ...progress,
      verdict: exitCode === 0
        ? "DOFLOW REPLACEMENT RELEASE CANDIDATE GO"
        : "DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED",
      completedAt: new Date().toISOString(),
      finalFingerprint,
      workingTreeStable,
    };
    await recordProgress("teardown", teardownPassed ? "passed" : "failed", {
      ...finalTeardown,
      ...(teardownFailure ? { failure: safeAcceptanceFailure(teardownFailure, "teardown") } : {}),
    });
    await writeFinalEvidence(evidence, runDirectory);
    await upsertStabilityRun({
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
      verdict: evidence.verdict,
      pending: undefined,
      finalFingerprint,
      workingTreeStable,
      checkpoints: progress.checkpoints,
      workspaceReadiness: globalResult?.workspaceReadiness ?? null,
      contextE: superadminResult,
      timings: {
        gates: gateTimingsFromProgress(progress),
        workspace: globalResult?.workspaceReadiness ?? null,
      },
      queryProfile: globalResult?.queryProfile ?? {
        available: false,
        reason: "No structured query profile evidence was emitted by the run.",
      },
      cors: localCorsEvidence(progress),
      teardown: finalTeardown,
      ports: finalTeardown.ports,
      dockerResidues: finalTeardown.dockerResidues,
    });
  }
  process.exitCode = exitCode;
  if (failure) throw failure;
}

async function runSuperadminAcceptance() {
  const runId = createAcceptanceRunId();
  const runLock = await acquireAcceptanceRunLock(acceptanceRunLockPath, { runId });
  try {
    return await runSuperadminAcceptanceLocked(runId);
  } finally {
    await runLock.release();
  }
}

async function runSuperadminAcceptanceLocked(runId) {
  const runDirectory = path.join(runtimeDir, "acceptance-runs", runId);
  let failure = null;
  let testPassed = false;
  let runIdentity = { branch: null, sha: null };
  let runFingerprint = null;
  let evidence = {
    schemaVersion: 1,
    runId,
    command: "acceptance:superadmin",
    verdict: "SUPERADMIN CONTEXT E BLOCKED",
    context: { name: "E", status: "pending" },
    startedAt: new Date().toISOString(),
    teardown: { completed: false, state: "not-started" },
  };
  try {
    runIdentity = gitIdentity();
    runFingerprint = await workingTreeFingerprint();
    evidence = {
      ...evidence,
      ...runIdentity,
      fingerprint: runFingerprint,
    };
    await archiveAcceptanceEvidence(
      [superadminResultPath],
      path.join(runDirectory, "previous"),
    );
    await atomicWriteJson(superadminResultPath, {
      ...evidence,
      context: { name: "E", status: "running" },
    });
    await down();
    await assertPortsFree();
    await up();
    const gateStartedAtMs = Date.now();
    const result = runPlaywrightConfig("playwright.superadmin.config.ts", {
      DOFLOW_ACCEPTANCE_RUN_ID: runId,
    });
    if (!result.passed) throw new Error(`Standalone Context E failed in ${result.config}.`);
    const gateEvidence = await readJsonIfPresent(superadminResultPath, null);
    const metadata = gateEvidence ? await stat(superadminResultPath) : null;
    const validation = validateFreshAcceptanceEvidence({
      evidence: gateEvidence,
      mtimeMs: metadata?.mtimeMs,
      gateStartedAtMs,
      expectedVerdict: "SUPERADMIN CONTEXT E GO",
      expectedContexts: ["E"],
      expectedBranch: runIdentity.branch,
      expectedSha: runIdentity.sha,
      expectedRunId: runId,
    });
    if (!validation.valid) {
      throw new Error(`Standalone Context E evidence contract failed: ${validation.errors.join(", ")}.`);
    }
    evidence = { ...gateEvidence, command: "acceptance:superadmin" };
    testPassed = true;
  } catch (error) {
    failure = error;
    const partialEvidence = await readJsonEvidenceSafe(superadminResultPath);
    evidence = {
      ...evidence,
      ...(partialEvidence ?? {}),
      runId,
      ...runIdentity,
      fingerprint: runFingerprint,
      verdict: "SUPERADMIN CONTEXT E BLOCKED",
      context: {
        ...(typeof partialEvidence?.context === "object" ? partialEvidence.context : {}),
        name: "E",
        status: "failed",
      },
      failure: safeAcceptanceFailure(error, "contextE"),
    };
  } finally {
    let teardownFailure = null;
    try {
      await down();
    } catch (error) {
      teardownFailure = error;
      failure ??= error;
    }
    let finalTeardown;
    try {
      finalTeardown = await teardownState();
    } catch (error) {
      teardownFailure ??= error;
      failure ??= error;
      finalTeardown = { completed: false, error: safeAcceptanceFailure(error, "teardown") };
    }
    let finalIdentity = { branch: null, sha: null };
    let finalFingerprint = null;
    try {
      finalIdentity = gitIdentity();
      finalFingerprint = await workingTreeFingerprint();
    } catch (error) {
      failure ??= error;
    }
    const workingTreeStable = finalIdentity.branch === runIdentity.branch
      && finalIdentity.sha === runIdentity.sha
      && finalFingerprint?.digest === runFingerprint?.digest;
    const passed = testPassed
      && !teardownFailure
      && finalTeardown.completed
      && workingTreeStable;
    evidence = {
      ...evidence,
      runId,
      command: "acceptance:superadmin",
      ...runIdentity,
      fingerprint: runFingerprint,
      finalFingerprint,
      workingTreeStable,
      verdict: passed ? "SUPERADMIN CONTEXT E GO" : "SUPERADMIN CONTEXT E BLOCKED",
      context: {
        ...(typeof evidence.context === "object" ? evidence.context : {}),
        name: "E",
        status: passed ? "passed" : "failed",
      },
      completedAt: new Date().toISOString(),
      teardown: finalTeardown,
      ports: finalTeardown.ports,
      dockerResidues: finalTeardown.dockerResidues,
      ...(teardownFailure ? { teardownFailure: safeAcceptanceFailure(teardownFailure, "teardown") } : {}),
    };
    await atomicWriteJson(superadminResultPath, evidence);
    await atomicWriteJson(superadminStandaloneResultPath, evidence);
    await atomicWriteJson(path.join(runDirectory, "superadmin.json"), evidence);
    process.exitCode = passed ? 0 : 1;
  }
  if (failure) throw failure;
}

async function runFinalVisualAcceptance() {
  let failure = null;
  try {
    const runId = createAcceptanceRunId();
    await archiveFinalRuntimeResults(runId);
    await up();
    for (const playwrightConfig of [
      "playwright.commercial-core.config.ts",
      "playwright.delivery-core.config.ts",
      "playwright.commerce-cash.config.ts",
      "playwright.document-revenue.config.ts",
      "playwright.collaboration.config.ts",
      "playwright.automation-performance.config.ts",
      "playwright.final-visual.config.ts",
    ]) {
      const result = runPlaywrightConfig(playwrightConfig);
      if (!result.passed) throw new Error(`Visual acceptance failed in ${playwrightConfig}.`);
    }
  } catch (error) {
    failure = error;
  } finally {
    await down();
  }
  if (failure) throw failure;
}

const command = process.argv[2] ?? "status";
if (command === "up") await up();
else if (command === "down") await down();
else if (command === "status") await status();
else if (command === "restart-backend") await restartBackend();
else if (command === "restart-frontend") await restartFrontend();
else if (command === "restart-redis") await restartRedis();
else if (command === "reseed") await reseed();
else if (command === "build") await buildAcceptance();
else if (command === "run") await runAcceptance();
else if (command === "run-delivery")
  await runAcceptance("playwright.delivery-core.config.ts");
else if (command === "run-commerce")
  await runAcceptance("playwright.commerce-cash.config.ts");
else if (command === "run-document-revenue")
  await runAcceptance("playwright.document-revenue.config.ts");
else if (command === "run-collaboration")
  await runAcceptance("playwright.collaboration.config.ts");
else if (command === "run-automation-performance")
  await runAcceptance("playwright.automation-performance.config.ts");
else if (command === "run-web-session")
  await runAcceptance("playwright.web-session.config.ts");
else if (command === "run-nest11")
  await runAcceptance("playwright.nest11.config.ts");
else if (command === "run-final") await runFinalAcceptance();
else if (command === "run-superadmin") await runSuperadminAcceptance();
else if (command === "run-visual-final") await runFinalVisualAcceptance();
else throw new Error(`Unknown command: ${command}`);
