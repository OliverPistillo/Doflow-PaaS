import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  atomicWriteJson,
  redactAcceptanceText,
} from "./lib/acceptance-evidence.mjs";

const root = path.resolve(import.meta.dirname, "..");
const runtimeDir = path.join(root, ".visual-runtime");
const resultPath = path.join(runtimeDir, "frontend-standalone-hotfix-result.json");
const containerName = "doflow-frontend-production-image-acceptance";
const hostPort = 3100;
const observationMs = Number(process.env.FRONTEND_IMAGE_OBSERVATION_MS || 300_000);

export const requiredSwcHelperFiles = Object.freeze([
  "package.json",
  "cjs/_interop_require_default.cjs",
  "esm/_interop_require_default.js",
]);

export function validateSwcHelperInventory(files) {
  const normalized = new Set(
    files.map((file) => String(file).replaceAll("\\", "/").replace(/^\.\//, "")),
  );
  return requiredSwcHelperFiles.filter((file) => !normalized.has(file));
}

function run(command, args, { allowFailure = false, inherit = false, timeout = 1_200_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const output = redactAcceptanceText(`${result.stdout || ""}\n${result.stderr || ""}`);
    throw new Error(`${command} ${args.join(" ")} failed (${result.status}): ${output}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function docker(args, options) {
  return run("docker", args, options);
}

function dockerContainerExists() {
  return docker([
    "ps", "-a", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}",
  ]).stdout.trim() === containerName;
}

function dockerImageExists(imageTag) {
  return docker([
    "image", "ls", "--filter", `reference=${imageTag}`, "--format", "{{.Repository}}:{{.Tag}}",
  ]).stdout.trim() === imageTag;
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => reject(new Error(`Port ${port} is unavailable: ${error.code}`)));
    server.listen({ host: "127.0.0.1", port }, () => server.close(resolve));
  });
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(url, { accepted = [200], timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });
    const body = await response.text();
    if (!accepted.includes(response.status)) {
      throw new Error(`${url} returned ${response.status}; expected ${accepted.join("/")}.`);
    }
    return {
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      contentType: response.headers.get("content-type") || "",
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForLogin(phase) {
  let lastError;
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const response = await request(`http://localhost:${hostPort}/login`, { timeoutMs: 3_000 });
      return { phase, attempt, status: response.status, durationMs: response.durationMs };
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }
  throw new Error(`${phase} did not become ready: ${redactAcceptanceText(lastError?.message)}`);
}

function parseKeyValueOutput(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function inspectArtifact(imageTag) {
  const script = String.raw`
set -eu
next_dir=$(find /app/node_modules/.pnpm -maxdepth 1 -type d -name 'next@16.3.2_*' | head -1)
test -n "$next_dir"
helper_dir=$(readlink -f "$next_dir/node_modules/@swc/helpers")
test -f /app/apps/frontend/server.js
test -d /app/apps/frontend/.next/static
test -d /app/apps/frontend/public
test -f "$helper_dir/package.json"
test -f "$helper_dir/cjs/_interop_require_default.cjs"
test -f "$helper_dir/esm/_interop_require_default.js"
broken_symlinks=$(find -L /app -type l -print | wc -l)
env_files=$(find /app -type f \( -name '.env' -o -name '.env.*' \) | wc -l)
reference_files=$(find /app -path '*doflow-gestionale-reference*' | wc -l)
ts_source_files=$(find /app -type f -name '*.ts' ! -name '*.d.ts' | wc -l)
test "$broken_symlinks" -eq 0
test "$env_files" -eq 0
test "$reference_files" -eq 0
test "$ts_source_files" -eq 0
printf 'helper_version=%s\n' "$(node -p "require('$helper_dir/package.json').version")"
printf 'helper_package=%s\n' true
printf 'helper_cjs=%s\n' true
printf 'helper_esm=%s\n' true
printf 'broken_symlinks=%s\n' "$broken_symlinks"
printf 'env_files=%s\n' "$env_files"
printf 'reference_files=%s\n' "$reference_files"
printf 'ts_source_files=%s\n' "$ts_source_files"
`;
  const result = docker(["run", "--rm", "--entrypoint", "sh", imageTag, "-lc", script]);
  const artifact = parseKeyValueOutput(result.stdout);
  const missing = validateSwcHelperInventory([
    ...(artifact.helper_package === "true" ? ["package.json"] : []),
    ...(artifact.helper_cjs === "true" ? ["cjs/_interop_require_default.cjs"] : []),
    ...(artifact.helper_esm === "true" ? ["esm/_interop_require_default.js"] : []),
  ]);
  if (missing.length > 0) throw new Error(`Standalone @swc/helpers incomplete: ${missing.join(", ")}.`);
  return artifact;
}

function assertImageMetadata(imageTag) {
  const inspect = JSON.parse(docker(["image", "inspect", imageTag]).stdout)[0];
  const command = inspect.Config?.Cmd || [];
  if (JSON.stringify(command) !== JSON.stringify(["node", "apps/frontend/server.js"])) {
    throw new Error(`Unexpected frontend image command: ${JSON.stringify(command)}.`);
  }
  const exposedPorts = Object.keys(inspect.Config?.ExposedPorts || {});
  if (!exposedPorts.includes("3000/tcp")) throw new Error("Frontend image does not expose 3000/tcp.");
  const sensitiveEnvironmentKeys = (inspect.Config?.Env || [])
    .map((entry) => String(entry).split("=", 1)[0])
    .filter((key) => /(?:password|passphrase|secret|token|cookie|authorization|database_url)/i.test(key));
  if (sensitiveEnvironmentKeys.length > 0) {
    throw new Error(`Sensitive environment keys baked into image: ${sensitiveEnvironmentKeys.join(", ")}.`);
  }
  return {
    imageId: inspect.Id,
    command,
    exposedPorts,
    sensitiveEnvironmentKeyCount: sensitiveEnvironmentKeys.length,
  };
}

function containerState() {
  const inspect = JSON.parse(docker(["inspect", containerName]).stdout)[0];
  return {
    running: Boolean(inspect.State?.Running),
    status: inspect.State?.Status,
    exitCode: inspect.State?.ExitCode,
    restartCount: inspect.RestartCount,
    startedAt: inspect.State?.StartedAt,
  };
}

async function main() {
  const baseSha = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  const branch = run("git", ["branch", "--show-current"]).stdout.trim();
  const imageTag = `doflow-frontend-production-image-acceptance:${baseSha.slice(0, 12)}`;
  const frontendPackage = JSON.parse(await readFile(path.join(root, "apps/frontend/package.json"), "utf8"));
  const evidence = {
    verdict: "FRONTEND PRODUCTION IMAGE ACCEPTANCE BLOCKED",
    branch,
    baseSha,
    versions: {
      nextBefore: "16.3.1",
      nextAfter: frontendPackage.dependencies.next,
      eslintConfigNextBefore: "16.3.1",
      eslintConfigNextAfter: frontendPackage.devDependencies["eslint-config-next"],
    },
    image: null,
    artifact: null,
    runtime: {
      coldStart: null,
      stopStart: null,
      restarts: [],
      probes: [],
      observationMs,
    },
    tests: {},
    teardown: {},
    failure: null,
  };

  try {
    if (branch !== "main") throw new Error(`Expected main branch, found ${branch}.`);
    if (frontendPackage.dependencies.next !== "16.3.2") throw new Error("Next.js must be exactly 16.3.2.");
    if (frontendPackage.devDependencies["eslint-config-next"] !== "16.3.2") {
      throw new Error("eslint-config-next must be exactly 16.3.2.");
    }
    if (dockerContainerExists()) throw new Error(`Residual container exists: ${containerName}.`);
    if (dockerImageExists(imageTag)) throw new Error(`Residual image exists: ${imageTag}.`);
    await assertPortAvailable(hostPort);

    run(process.execPath, ["--test", "tests/orchestration/frontend-production-image-acceptance.test.mjs"], {
      inherit: true,
    });
    evidence.tests.permanentRegression = "passed";

    docker([
      "build",
      "--file", "apps/frontend/Dockerfile",
      "--tag", imageTag,
      "--build-arg", "NEXT_PUBLIC_API_URL=",
      ".",
    ], { inherit: true });
    evidence.image = assertImageMetadata(imageTag);
    evidence.artifact = inspectArtifact(imageTag);

    docker([
      "run", "-d",
      "--name", containerName,
      "--restart", "no",
      "-p", `${hostPort}:3000`,
      imageTag,
    ]);
    evidence.runtime.coldStart = await waitForLogin("cold-start");

    const login = await request(`http://localhost:${hostPort}/login`);
    const dashboard = await request(`http://localhost:${hostPort}/dashboard`, { accepted: [200, 302, 307] });
    const staticAsset = login.body.match(/(?:src|href)=["'](?<path>\/_next\/static\/[^"']+)["']/)?.groups?.path;
    if (!staticAsset) throw new Error("Login HTML does not reference a Next static asset.");
    const asset = await request(`http://localhost:${hostPort}${staticAsset}`);
    const icon = await request(`http://localhost:${hostPort}/icon.png`);
    const logo = await request(`http://localhost:${hostPort}/doflow_logo.svg`);
    evidence.runtime.routes = {
      login: login.status,
      dashboard: dashboard.status,
      staticAsset: asset.status,
      icon: icon.status,
      logo: logo.status,
    };

    docker(["stop", "--timeout", "20", containerName]);
    docker(["start", containerName]);
    evidence.runtime.stopStart = await waitForLogin("stop-start");

    for (let index = 1; index <= 3; index += 1) {
      docker(["restart", "--timeout", "20", containerName]);
      evidence.runtime.restarts.push(await waitForLogin(`restart-${index}`));
      await sleep(2_000);
    }

    const observationStartedAt = Date.now();
    while (Date.now() - observationStartedAt < observationMs) {
      const remaining = observationMs - (Date.now() - observationStartedAt);
      await sleep(Math.min(30_000, Math.max(0, remaining)));
      const state = containerState();
      if (!state.running || state.restartCount !== 0) {
        throw new Error(`Frontend became unstable during observation: ${JSON.stringify(state)}.`);
      }
      process.stdout.write(`[acceptance:frontend-production-image] observation ${Math.min(observationMs, Date.now() - observationStartedAt)}/${observationMs}ms\n`);
    }

    for (let index = 1; index <= 10; index += 1) {
      const probe = await request(`http://localhost:${hostPort}/login`);
      evidence.runtime.probes.push({ index, status: probe.status, durationMs: probe.durationMs });
      await sleep(500);
    }

    const state = containerState();
    if (!state.running || state.restartCount !== 0) {
      throw new Error(`Unexpected final container state: ${JSON.stringify(state)}.`);
    }
    const logs = docker(["logs", containerName]).stdout + docker(["logs", containerName]).stderr;
    if (/MODULE_NOT_FOUND|@swc\/helpers.*(?:missing|not found)/i.test(logs)) {
      throw new Error("Frontend logs contain a standalone module resolution failure.");
    }
    evidence.runtime.finalState = state;
    evidence.runtime.moduleResolutionErrors = 0;
    evidence.verdict = "FRONTEND PRODUCTION IMAGE ACCEPTANCE GO";
  } catch (error) {
    evidence.failure = {
      stage: "frontend-production-image",
      message: redactAcceptanceText(error?.message || error),
    };
    process.exitCode = 1;
  } finally {
    if (dockerContainerExists()) {
      docker(["rm", "-f", containerName], { allowFailure: true });
    }
    evidence.teardown.containerRemoved = !dockerContainerExists();
    if (dockerImageExists(imageTag)) {
      docker(["image", "rm", imageTag], { allowFailure: true });
    }
    evidence.teardown.imageRemoved = !dockerImageExists(imageTag);
    evidence.teardown.portReleased = await assertPortAvailable(hostPort).then(() => true, () => false);
    if (!evidence.teardown.containerRemoved || !evidence.teardown.imageRemoved || !evidence.teardown.portReleased) {
      evidence.verdict = "FRONTEND PRODUCTION IMAGE ACCEPTANCE BLOCKED";
      evidence.failure ??= { stage: "teardown", message: "Dedicated runtime resources remain." };
      process.exitCode = 1;
    }
    await atomicWriteJson(resultPath, evidence);
  }

  process.stdout.write(`[acceptance:frontend-production-image] ${evidence.verdict}\n`);
  process.stdout.write(`[acceptance:frontend-production-image] Evidence: ${path.relative(root, resultPath)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
