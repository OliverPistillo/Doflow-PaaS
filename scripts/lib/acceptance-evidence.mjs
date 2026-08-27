import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

const REDACTED = "[REDACTED]";

export function createAcceptanceRunId(now = new Date()) {
  return `${now.toISOString().replace(/[:.]/g, "-")}-${process.pid}-${randomBytes(4).toString("hex")}`;
}

export function redactAcceptanceText(value) {
  return String(value ?? "")
    .replace(
      /((?:["']?)(?:password|passphrase|token|secret|cookie|authorization|csrf)(?:["']?)\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,\s}]+)/gi,
      `$1"${REDACTED}"`,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(password|passphrase|token|secret|cookie|authorization|csrf)\b\s*[:=]\s*[^\s,;]+/gi, `$1=${REDACTED}`)
    .slice(0, 800);
}

export function buildWorkingTreeFingerprint(trackedDiff, untrackedFiles = []) {
  const tracked = Buffer.isBuffer(trackedDiff) ? trackedDiff : Buffer.from(String(trackedDiff ?? ""));
  const sortedFiles = [...untrackedFiles]
    .map((file) => ({
      path: String(file.path).replace(/\\/g, "/"),
      content: Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content ?? "")),
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  const hash = createHash("sha256");
  hash.update("doflow-working-tree-fingerprint-v1\0");
  hash.update(String(tracked.byteLength));
  hash.update("\0");
  hash.update(tracked);
  let untrackedBytes = 0;
  for (const file of sortedFiles) {
    untrackedBytes += file.content.byteLength;
    hash.update("\0path\0");
    hash.update(String(Buffer.byteLength(file.path)));
    hash.update("\0");
    hash.update(file.path);
    hash.update("\0content\0");
    hash.update(String(file.content.byteLength));
    hash.update("\0");
    hash.update(file.content);
  }
  return {
    version: 1,
    algorithm: "sha256",
    digest: hash.digest("hex"),
    trackedDiffBytes: tracked.byteLength,
    untrackedFileCount: sortedFiles.length,
    untrackedBytes,
  };
}

export function validateFreshAcceptanceEvidence({
  evidence,
  mtimeMs,
  gateStartedAtMs,
  expectedVerdict,
  expectedContexts = [],
  expectedBranch,
  expectedSha,
  expectedRunId,
}) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    errors.push("evidence-missing-or-invalid");
  } else {
    if (evidence.verdict !== expectedVerdict) errors.push("unexpected-verdict");
    for (const context of expectedContexts) {
      const contextStatus = evidence.contexts?.[context]?.status
        ?? (evidence.context?.name === context ? evidence.context.status : undefined);
      if (contextStatus === undefined) errors.push(`context-${context}-missing`);
      else if (contextStatus !== "passed") {
        errors.push(`context-${context}-not-passed`);
      }
    }
    if (expectedBranch && evidence.branch !== expectedBranch) errors.push("branch-mismatch");
    if (expectedSha && evidence.sha !== expectedSha) errors.push("sha-mismatch");
    if (expectedRunId && evidence.runId !== expectedRunId) errors.push("run-id-mismatch");
  }
  if (!Number.isFinite(mtimeMs) || mtimeMs + 1_000 < gateStartedAtMs) errors.push("stale-evidence");
  return { valid: errors.length === 0, errors };
}

export function nextAcceptanceRunSequence(runs) {
  const maximum = (Array.isArray(runs) ? runs : []).reduce((current, run) => {
    const sequence = Number(run?.sequence);
    return Number.isInteger(sequence) && sequence >= 0
      ? Math.max(current, sequence)
      : current;
  }, 0);
  return maximum + 1;
}

export async function acquireAcceptanceRunLock(targetPath, { runId, pid = process.pid }) {
  if (!runId || !Number.isInteger(pid) || pid <= 0) {
    throw new Error("Acceptance run lock requires a runId and a positive integer PID.");
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  let handle;
  try {
    handle = await open(targetPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({
      schemaVersion: 1,
      runId,
      pid,
      acquiredAt: new Date().toISOString(),
    })}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
      handle = undefined;
      await rm(targetPath, { force: true }).catch(() => undefined);
    }
    if (error?.code === "EEXIST") {
      const locked = new Error("Another final acceptance run already owns the exclusive run lock.");
      locked.code = "ACCEPTANCE_RUN_LOCKED";
      throw locked;
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
  let released = false;
  return {
    path: targetPath,
    async release() {
      if (released) return;
      let owner = null;
      try {
        owner = JSON.parse(await readFile(targetPath, "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") {
          released = true;
          return;
        }
        throw error;
      }
      if (owner.runId !== runId || owner.pid !== pid) {
        throw new Error("Acceptance run lock ownership changed; foreign lock preserved.");
      }
      await rm(targetPath);
      released = true;
    },
  };
}

export function hasTwoConsecutiveStableRuns(runs, { branch, sha, fingerprint }) {
  const latest = Array.isArray(runs) ? runs.slice(-2) : [];
  if (latest.length !== 2) return false;
  const [first, second] = latest;
  const distinctConsecutiveRuns = Boolean(first.runId)
    && Boolean(second.runId)
    && first.runId !== second.runId
    && Number.isInteger(first.sequence)
    && Number.isInteger(second.sequence)
    && second.sequence === first.sequence + 1;
  const logicalCountsMatch = first.logicalCounts
    && second.logicalCounts
    && JSON.stringify(first.logicalCounts) === JSON.stringify(second.logicalCounts);
  return distinctConsecutiveRuns && logicalCountsMatch && latest.every((run) =>
    run.status === "COMPLETED"
      && run.verdict === "DOFLOW REPLACEMENT RELEASE CANDIDATE GO"
      && run.teardown?.completed === true
      && run.branch === branch
      && run.sha === sha
      && run.fingerprint?.digest === fingerprint?.digest
      && run.workingTreeStable === true
      && run.workspaceReadiness?.shellReady === true
      && run.workspaceReadiness?.workspaceReady === true
      && run.queryProfile?.available === true
      && run.queryProfile?.unexpected5xxCount === 0
      && run.timingsBeforeAfter?.available === true
      && run.contextE?.verdict === "SUPERADMIN CONTEXT E GO"
      && run.contextEStandalone?.valid === true
      && run.visual === "GLOBAL VISUAL GO"
      && run.health?.result === "10/10");
}

export function hasCompleteBootstrapDiagnostic(
  evidence,
  { expectedRunName, requireSecondary = false } = {},
) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  if (expectedRunName && evidence.runName !== expectedRunName) return false;
  if (!Array.isArray(evidence.contexts)) return false;
  const contexts = ["cold", "warm"].map((label) =>
    evidence.contexts.find((context) => context?.label === label));
  return contexts.every((context) => {
    const baseComplete = context
      && context.verdict === "GO"
      && Number.isFinite(context.loginMs)
      && context.loginMs >= 0
      && Number.isFinite(context.mainMs)
      && context.mainMs >= 0
      && Number.isFinite(context.workspaceMs)
      && context.workspaceMs >= 0
      && Number.isInteger(context.requestCount)
      && context.requestCount > 0
      && Array.isArray(context.slowestRequests)
      && context.slowestRequests.some((request) =>
        Number.isFinite(request?.durationMs) && request.durationMs >= 0);
    if (!baseComplete || !requireSecondary) return Boolean(baseComplete);
    return Number.isFinite(context.secondaryMs)
      && context.secondaryMs >= 0
      && context.secondaryStatus === "ready"
      && Number.isInteger(context.requestTimings?.samples)
      && context.requestTimings.samples > 0
      && Number.isFinite(context.requestTimings?.p50Ms)
      && context.requestTimings.p50Ms >= 0
      && Number.isFinite(context.requestTimings?.p95Ms)
      && context.requestTimings.p95Ms >= 0
      && Number.isFinite(context.requestTimings?.maxMs)
      && context.requestTimings.maxMs >= 0;
  });
}

export function evaluateAcceptanceTeardown({ ports, dockerResidues, dockerProbeFailures = [] }) {
  const normalizedPorts = ports ?? {};
  const normalizedResidues = dockerResidues ?? { containers: [], networks: [], volumes: [] };
  const noOpenPorts = Object.values(normalizedPorts).every((state) => state === "closed");
  const noDockerResidues = ["containers", "networks", "volumes"]
    .every((key) => Array.isArray(normalizedResidues[key]) && normalizedResidues[key].length === 0);
  return {
    completed: noOpenPorts && noDockerResidues && dockerProbeFailures.length === 0,
    ports: normalizedPorts,
    dockerResidues: normalizedResidues,
    dockerProbeFailures,
  };
}

export function safeAcceptanceFailure(error, stage, code = "ACCEPTANCE_STAGE_FAILED") {
  return {
    code,
    stage,
    name: error instanceof Error ? error.name : "Error",
    message: redactAcceptanceText(error instanceof Error ? error.message : String(error ?? "Acceptance failed")),
  };
}

export function withAcceptanceCheckpoint(evidence, stage, status, details = {}, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    ...evidence,
    currentStage: stage,
    updatedAt: timestamp,
    checkpoints: {
      ...(evidence.checkpoints ?? {}),
      [stage]: {
        ...(evidence.checkpoints?.[stage] ?? {}),
        ...details,
        status,
        updatedAt: timestamp,
      },
    },
  };
}

export async function atomicWriteJson(targetPath, value) {
  const directory = path.dirname(targetPath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function archiveAcceptanceEvidence(paths, archiveDirectory) {
  await mkdir(archiveDirectory, { recursive: true });
  const archived = [];
  for (const sourcePath of paths) {
    const destinationPath = path.join(archiveDirectory, path.basename(sourcePath));
    try {
      await rename(sourcePath, destinationPath);
      archived.push(destinationPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if ((await readdir(archiveDirectory)).length === 0) {
    await rmdir(archiveDirectory);
  }
  return archived;
}
