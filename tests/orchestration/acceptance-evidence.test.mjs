import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  acquireAcceptanceRunLock,
  archiveAcceptanceEvidence,
  atomicWriteJson,
  buildWorkingTreeFingerprint,
  evaluateAcceptanceTeardown,
  hasCompleteBootstrapDiagnostic,
  hasTwoConsecutiveStableRuns,
  nextAcceptanceRunSequence,
  redactAcceptanceText,
  safeAcceptanceFailure,
  validateFreshAcceptanceEvidence,
  withAcceptanceCheckpoint,
} from "../../scripts/lib/acceptance-evidence.mjs";

const root = path.resolve(import.meta.dirname, "../..");

async function withTemporaryDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "doflow-acceptance-evidence-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("atomic evidence replacement always leaves one complete JSON document", async () => {
  await withTemporaryDirectory(async (directory) => {
    const target = path.join(directory, "result.json");
    await atomicWriteJson(target, { runId: "first", checkpoints: { A: "passed" } });
    await atomicWriteJson(target, { runId: "second", checkpoints: { B: "failed" } });

    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), {
      runId: "second",
      checkpoints: { B: "failed" },
    });
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
  });
});

test("a later failed checkpoint preserves prior passed evidence", () => {
  const initial = { runId: "run", checkpoints: {} };
  const contextA = withAcceptanceCheckpoint(initial, "contextA", "passed", { operations: 12 });
  const contextB = withAcceptanceCheckpoint(contextA, "contextB", "failed", { operations: 3 });

  assert.equal(contextB.checkpoints.contextA.status, "passed");
  assert.equal(contextB.checkpoints.contextA.operations, 12);
  assert.equal(contextB.checkpoints.contextB.status, "failed");
});

test("failure evidence redacts authentication material and identities", () => {
  const failure = safeAcceptanceFailure(
    new Error("password=hunter2 token=abc Bearer header.payload.signature user@example.invalid"),
    "contextE",
  );
  assert.doesNotMatch(JSON.stringify(failure), /hunter2|\babc\b|header\.payload|user@example/i);
  assert.match(redactAcceptanceText("cookie=session-value"), /\[REDACTED\]/);
});

test("redactor removes secrets stored under quoted JSON keys", () => {
  const redacted = redactAcceptanceText(
    '{"password":"hunter2","token":"abc.def","csrf":"csrf-value","safe":true}',
  );

  assert.doesNotMatch(redacted, /hunter2|abc\.def|csrf-value/);
  assert.match(redacted, /"password":"\[REDACTED\]"/);
  assert.match(redacted, /"token":"\[REDACTED\]"/);
  assert.match(redacted, /"csrf":"\[REDACTED\]"/);
  assert.match(redacted, /"safe":true/);
});

test("working-tree fingerprint is deterministic and covers untracked paths and content", () => {
  const tracked = Buffer.from("tracked-diff\0binary", "utf8");
  const first = buildWorkingTreeFingerprint(tracked, [
    { path: "z/new.ts", content: "z" },
    { path: "a/new.ts", content: "a" },
  ]);
  const reordered = buildWorkingTreeFingerprint(tracked, [
    { path: "a/new.ts", content: "a" },
    { path: "z/new.ts", content: "z" },
  ]);
  const changedContent = buildWorkingTreeFingerprint(tracked, [
    { path: "a/new.ts", content: "changed" },
    { path: "z/new.ts", content: "z" },
  ]);
  const changedPath = buildWorkingTreeFingerprint(tracked, [
    { path: "a/renamed.ts", content: "a" },
    { path: "z/new.ts", content: "z" },
  ]);

  assert.equal(first.digest, reordered.digest);
  assert.notEqual(first.digest, changedContent.digest);
  assert.notEqual(first.digest, changedPath.digest);
  assert.equal(first.untrackedFileCount, 2);
});

test("gate evidence must be fresh, exact and contain every passed context", () => {
  const startedAt = Date.now();
  const valid = validateFreshAcceptanceEvidence({
    evidence: {
      runId: "run-current",
      verdict: "GLOBAL CONTEXTS A-D GO",
      branch: "main",
      sha: "abc",
      contexts: Object.fromEntries(["A", "B", "C", "D"].map((name) => [name, { status: "passed" }])),
    },
    mtimeMs: startedAt + 10,
    gateStartedAtMs: startedAt,
    expectedVerdict: "GLOBAL CONTEXTS A-D GO",
    expectedContexts: ["A", "B", "C", "D"],
    expectedBranch: "main",
    expectedSha: "abc",
    expectedRunId: "run-current",
  });
  assert.deepEqual(valid, { valid: true, errors: [] });

  const stale = validateFreshAcceptanceEvidence({
    evidence: {
      verdict: "GLOBAL CONTEXTS A-D GO",
      branch: "main",
      sha: "wrong",
      contexts: { A: { status: "passed" }, B: { status: "failed" } },
    },
    mtimeMs: startedAt - 2_000,
    gateStartedAtMs: startedAt,
    expectedVerdict: "GLOBAL CONTEXTS A-D GO",
    expectedContexts: ["A", "B", "C", "D"],
    expectedBranch: "main",
    expectedSha: "abc",
  });
  assert.equal(stale.valid, false);
  assert.deepEqual(stale.errors, [
    "context-B-not-passed",
    "context-C-missing",
    "context-D-missing",
    "sha-mismatch",
    "stale-evidence",
  ]);
});

test("gate evidence rejects a result from a different acceptance run", () => {
  const validation = validateFreshAcceptanceEvidence({
    evidence: {
      runId: "run-stale",
      verdict: "SUPERADMIN CONTEXT E GO",
      branch: "main",
      sha: "abc",
      context: { name: "E", status: "passed" },
    },
    mtimeMs: Date.now(),
    gateStartedAtMs: Date.now(),
    expectedVerdict: "SUPERADMIN CONTEXT E GO",
    expectedContexts: ["E"],
    expectedBranch: "main",
    expectedSha: "abc",
    expectedRunId: "run-current",
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, ["run-id-mismatch"]);
});

test("run sequence advances from the maximum existing value, not array order", () => {
  assert.equal(nextAcceptanceRunSequence([]), 1);
  assert.equal(nextAcceptanceRunSequence([
    { sequence: 7 },
    { sequence: 2 },
    { sequence: 4 },
    { sequence: "invalid" },
  ]), 8);
});

test("exclusive run lock rejects concurrency and can be reacquired after release", async () => {
  await withTemporaryDirectory(async (directory) => {
    const lockPath = path.join(directory, "acceptance-final.lock");
    const first = await acquireAcceptanceRunLock(lockPath, { runId: "run-one", pid: 1001 });
    const lockEvidence = JSON.parse(await readFile(lockPath, "utf8"));
    assert.deepEqual(
      { runId: lockEvidence.runId, pid: lockEvidence.pid },
      { runId: "run-one", pid: 1001 },
    );
    await assert.rejects(
      acquireAcceptanceRunLock(lockPath, { runId: "run-two", pid: 1002 }),
      (error) => error?.code === "ACCEPTANCE_RUN_LOCKED",
    );
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).runId, "run-one");
    await first.release();

    const second = await acquireAcceptanceRunLock(lockPath, { runId: "run-two", pid: 1002 });
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).runId, "run-two");
    await second.release();
    await assert.rejects(readFile(lockPath, "utf8"), { code: "ENOENT" });
  });
});

test("stability GO requires exactly two latest completed GO runs on one immutable tree", () => {
  const fingerprint = { digest: "tree-a" };
  const goRun = (runId, sequence = runId === "one" ? 1 : 2) => ({
    runId,
    sequence,
    status: "COMPLETED",
    verdict: "DOFLOW REPLACEMENT RELEASE CANDIDATE GO",
    branch: "main",
    sha: "abc",
    fingerprint,
    workingTreeStable: true,
    teardown: { completed: true },
    workspaceReadiness: { shellReady: true, workspaceReady: true },
    queryProfile: { available: true, unexpected5xxCount: 0 },
    timingsBeforeAfter: { available: true },
    contextE: { verdict: "SUPERADMIN CONTEXT E GO" },
    contextEStandalone: { valid: true },
    visual: "GLOBAL VISUAL GO",
    health: { result: "10/10" },
    logicalCounts: {
      backendSuites: 95,
      backendTests: 1076,
      frontendPages: 220,
      contextOperations: 143,
      contextEOperations: 45,
      visualScreenshots: 121,
    },
  });
  const identity = { branch: "main", sha: "abc", fingerprint };

  assert.equal(hasTwoConsecutiveStableRuns([goRun("one")], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([goRun("one"), goRun("two")], identity), true);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), status: "RUNNING" },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), fingerprint: { digest: "tree-b" } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), branch: "feature" },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), teardown: { completed: false } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), queryProfile: { available: false } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), queryProfile: { available: true, unexpected5xxCount: 1 } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), workspaceReadiness: { shellReady: true, workspaceReady: false } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), contextE: { verdict: "SUPERADMIN CONTEXT E BLOCKED" } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([goRun("same", 1), goRun("same", 2)], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([goRun("one", 1), goRun("two", 3)], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), logicalCounts: { ...goRun("two").logicalCounts, visualScreenshots: 120 } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), timingsBeforeAfter: { available: false } },
  ], identity), false);
  assert.equal(hasTwoConsecutiveStableRuns([
    goRun("one"),
    { ...goRun("two"), contextEStandalone: { valid: false } },
  ], identity), false);
});

test("before/after diagnostics require complete cold and warm timing evidence", () => {
  const context = (label, withSecondary = false) => ({
    label,
    verdict: "GO",
    loginMs: 100,
    mainMs: 200,
    workspaceMs: 300,
    requestCount: 4,
    slowestRequests: [{ path: "/api/safe", durationMs: 50 }],
    ...(withSecondary
      ? {
          secondaryMs: 400,
          secondaryStatus: "ready",
          requestTimings: { samples: 4, p50Ms: 10, p95Ms: 50, maxMs: 50 },
        }
      : {}),
  });
  const before = {
    runName: "bootstrap-03-targeted",
    contexts: [context("cold"), context("warm")],
  };
  const after = {
    runName: "bootstrap-04-postfix",
    contexts: [context("cold", true), context("warm", true)],
  };

  assert.equal(hasCompleteBootstrapDiagnostic({}, {
    expectedRunName: "bootstrap-03-targeted",
  }), false);
  assert.equal(hasCompleteBootstrapDiagnostic(before, {
    expectedRunName: "bootstrap-03-targeted",
  }), true);
  assert.equal(hasCompleteBootstrapDiagnostic(after, {
    expectedRunName: "bootstrap-04-postfix",
    requireSecondary: true,
  }), true);
  assert.equal(hasCompleteBootstrapDiagnostic({ ...after, contexts: [context("cold", true)] }, {
    expectedRunName: "bootstrap-04-postfix",
    requireSecondary: true,
  }), false);
  assert.equal(hasCompleteBootstrapDiagnostic({
    ...after,
    contexts: [context("cold", true), { ...context("warm", true), secondaryMs: null }],
  }, {
    expectedRunName: "bootstrap-04-postfix",
    requireSecondary: true,
  }), false);
  assert.equal(hasCompleteBootstrapDiagnostic({
    ...before,
    contexts: [context("cold"), { ...context("warm"), workspaceMs: -1 }],
  }, {
    expectedRunName: "bootstrap-03-targeted",
  }), false);
});

test("teardown is blocked by a Docker probe failure or any acceptance residue", () => {
  const closedPorts = { 3100: "closed", 3401: "closed" };
  const emptyDocker = { containers: [], networks: [], volumes: [] };

  assert.equal(evaluateAcceptanceTeardown({
    ports: closedPorts,
    dockerResidues: emptyDocker,
  }).completed, true);
  assert.equal(evaluateAcceptanceTeardown({
    ports: closedPorts,
    dockerResidues: emptyDocker,
    dockerProbeFailures: [{ resource: "networks", status: 1 }],
  }).completed, false);
  assert.equal(evaluateAcceptanceTeardown({
    ports: closedPorts,
    dockerResidues: { ...emptyDocker, volumes: ["doflow-pre179-acceptance-data"] },
  }).completed, false);
});

test("prior run evidence is archived instead of ambiguously overwritten", async () => {
  await withTemporaryDirectory(async (directory) => {
    const current = path.join(directory, "result.json");
    const archive = path.join(directory, "runs", "second", "previous");
    await writeFile(current, "{\"runId\":\"first\"}\n", "utf8");

    const archived = await archiveAcceptanceEvidence([current], archive);

    assert.equal(archived.length, 1);
    assert.equal(JSON.parse(await readFile(archived[0], "utf8")).runId, "first");
    await assert.rejects(readFile(current, "utf8"), { code: "ENOENT" });
  });
});

test("Context E has a standalone command and no global-result read dependency", async () => {
  const [packageSource, specSource, orchestratorSource, globalConfig, superadminConfig] = await Promise.all([
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "tests/acceptance/final-global-isolated.spec.ts"), "utf8"),
    readFile(path.join(root, "scripts/commercial-core-isolated-stack.mjs"), "utf8"),
    readFile(path.join(root, "playwright.final-global.config.ts"), "utf8"),
    readFile(path.join(root, "playwright.superadmin.config.ts"), "utf8"),
  ]);
  const contextESource = specSource.slice(specSource.indexOf("test('Context E Superadmin"));

  assert.match(packageSource, /"acceptance:superadmin":\s*"node scripts\/commercial-core-isolated-stack\.mjs run-superadmin"/);
  assert.match(orchestratorSource, /async function runSuperadminAcceptance\(\)/);
  assert.match(orchestratorSource, /playwright\.superadmin\.config\.ts/);
  assert.match(orchestratorSource, /superadmin-standalone-result\.json/);
  assert.match(orchestratorSource, /command: "acceptance:superadmin"/);
  assert.match(orchestratorSource, /standaloneContextEEvidence/);
  assert.match(contextESource, /superadminResultPath/);
  assert.doesNotMatch(contextESource, /readFile\(resultPath/);
  assert.match(
    contextESource,
    /checkpoint\('bootstrap', 'running'[\s\S]*checkpoint\('bootstrap', 'passed'/,
  );
  assert.match(globalConfig, /grep:\s*\/release candidate globale integra i Context A\\\/B\\\/C\\\/D\//);
  assert.match(superadminConfig, /grep:\s*\/Context E Superadmin\//);
});

test("final orchestration checkpoints gates before spawn and enforces hard baselines and safe cleanup", async () => {
  const [orchestratorSource, specSource, visualSpecSource] = await Promise.all([
    readFile(path.join(root, "scripts/commercial-core-isolated-stack.mjs"), "utf8"),
    readFile(path.join(root, "tests/acceptance/final-global-isolated.spec.ts"), "utf8"),
    readFile(path.join(root, "tests/acceptance/final-global-visual.spec.ts"), "utf8"),
  ]);
  const executeGateSource = orchestratorSource.slice(
    orchestratorSource.indexOf("const executePlaywrightGate"),
    orchestratorSource.indexOf("const upsertStabilityRun"),
  );
  const finalWrapperSource = orchestratorSource.slice(
    orchestratorSource.indexOf("async function runFinalAcceptance()"),
    orchestratorSource.indexOf("async function runFinalAcceptanceLocked"),
  );
  const superadminWrapperSource = orchestratorSource.slice(
    orchestratorSource.indexOf("async function runSuperadminAcceptance()"),
    orchestratorSource.indexOf("async function runSuperadminAcceptanceLocked"),
  );

  assert.ok(
    executeGateSource.indexOf('recordProgress(stage, "running"')
      < executeGateSource.indexOf("runPlaywrightConfig(playwrightConfig, {"),
    "running evidence must be persisted before Playwright starts",
  );
  assert.match(executeGateSource, /validateFreshAcceptanceEvidence/);
  assert.match(executeGateSource, /expectedRunId: runId/);
  assert.match(executeGateSource, /DOFLOW_ACCEPTANCE_RUN_ID: runId/);
  assert.equal((specSource.match(/DOFLOW_ACCEPTANCE_RUN_ID/g) ?? []).length, 2);
  assert.match(finalWrapperSource, /acquireAcceptanceRunLock/);
  assert.match(finalWrapperSource, /runFinalAcceptanceLocked/);
  assert.match(superadminWrapperSource, /acquireAcceptanceRunLock/);
  assert.match(superadminWrapperSource, /runSuperadminAcceptanceLocked/);
  assert.match(orchestratorSource, /backendSuiteCount < 95/);
  assert.match(orchestratorSource, /backendTestCount < 1076/);
  assert.match(orchestratorSource, /frontendStaticPages === null \|\| frontendStaticPages < 220/);
  assert.match(orchestratorSource, /workspace-readiness-runtime\.test\.mjs/);
  assert.match(orchestratorSource, /playwright\.workspace-readiness\.config\.ts/);
  assert.match(orchestratorSource, /workspaceReadinessRuntime/);
  assert.match(orchestratorSource, /DOFLOW_FINAL_VISUAL_OUTPUT_DIR: path\.join\(runDirectory, "visual-actual"\)/);
  assert.match(visualSpecSource, /process\.env\.DOFLOW_FINAL_VISUAL_OUTPUT_DIR/);
  assert.match(
    visualSpecSource,
    /docs', 'design-references', 'doflow-crm-projects', 'actual', 'final-rc'/,
  );
  assert.match(specSource, /privacy-safe browser API response timings from Context A/);
  assert.match(specSource, /unexpected5xxCount/);
  assert.match(orchestratorSource, /maxBuffer: options\.maxBuffer \?\? 64 \* 1024 \* 1024/);
  assert.match(orchestratorSource, /label: "git tracked fingerprint",\s*maxBuffer: 128 \* 1024 \* 1024/s);
  assert.match(orchestratorSource, /doflow-pre179-acceptance/);
  assert.match(orchestratorSource, /isolatedServiceProcessMatches\(label, pid\)/);
  assert.ok(
    orchestratorSource.indexOf("isolatedServiceProcessMatches(label, pid)")
      < orchestratorSource.indexOf('run("taskkill.exe"'),
    "a reused PID must be rejected before taskkill",
  );
});
