import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("root package exposes the production-image acceptance command", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(
    packageJson.scripts["acceptance:production-startup"],
    "node scripts/production-startup-acceptance.mjs",
  );
});

test("production startup acceptance builds the exact backend Dockerfile and compiled entrypoints", async () => {
  const orchestrator = await source("scripts/production-startup-acceptance.mjs");
  assert.match(orchestrator, /"build", "--file", "apps\/backend\/Dockerfile", "--tag", imageTag, "\."/);
  for (const compiled of [
    "run-production-migrations.js",
    "production-backend-entrypoint.js",
    "doflow-production-cutover.js",
  ]) {
    assert.match(orchestrator, new RegExp(compiled.replaceAll(".", "\\.")));
  }
  for (const migration of ["1714752000000", "1790000000000", "1800000000000", "1810000000000", "1820000000000", "1830000000000", "1840000000000", "1850000000000", "1860000000000"]) {
    assert.match(orchestrator, new RegExp(migration));
  }
});

test("all five production startup scenarios and atomic evidence are permanent", async () => {
  const orchestrator = await source("scripts/production-startup-acceptance.mjs");
  for (const scenario of [
    "scenarioBaseline",
    "scenarioPre186",
    "scenarioRestart",
    "scenarioConcurrent",
    "scenarioFailure",
    "scenarioCutover",
  ]) {
    assert.match(orchestrator, new RegExp(`function ${scenario}\\(`));
  }
  assert.match(orchestrator, /atomicWriteJson\(resultPath, evidence\)/);
  assert.match(orchestrator, /production-migration-runner-result\.json/);
  assert.match(orchestrator, /DOFLOW_MIGRATION_ACCEPTANCE_HOLD_LOCK_MS/);
  assert.match(orchestrator, /transactionRollbackPreserved/);
  assert.match(orchestrator, /imagesPinnedByDigest/);
  assert.match(orchestrator, /DOFLOW_CUTOVER_ACCEPTANCE/);
  assert.match(orchestrator, /bakedSecrets/);
  assert.match(orchestrator, /CreateBucketCommand/);
  assert.match(orchestrator, /HeadBucketCommand/);
  assert.match(orchestrator, /migrate-to-185/);
  assert.match(orchestrator, /contractTables/);
  assert.match(orchestrator, /additiveColumns/);
  assert.match(orchestrator, /contractIndexes/);
  assert.match(orchestrator, /tablename <> 'commercial_communications'/);
  assert.match(orchestrator, /heterogeneousMissingCommercialCommunications: true/);
  assert.match(orchestrator, /preExistingOptionalTables/);
  for (const event of ["lock_wait", "lock_acquired", "lock_released", "complete"]) {
    assert.match(orchestrator, new RegExp(`\\"${event}\\"`));
  }
});

test("fault injection and teardown remain isolated and non-destructive", async () => {
  const orchestrator = await source("scripts/production-startup-acceptance.mjs");
  assert.match(orchestrator, /CREATE SCHEMA \"zz-fault\"/);
  assert.match(orchestrator, /ALTER SCHEMA \"zz-fault\" RENAME TO zz_fault/);
  assert.doesNotMatch(orchestrator, /\b(?:DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(orchestrator, /\bprune\b/i);
  assert.doesNotMatch(orchestrator, /doflow-nginx/i);
  assert.match(orchestrator, /doflow-production-startup-acceptance/);
});

test("Docker runtime command and build context exclusions are fail-closed", async () => {
  const dockerfile = await source("apps/backend/Dockerfile");
  const dockerignore = await source(".dockerignore");
  assert.match(dockerfile, /CMD \["node", "apps\/backend\/dist\/scripts\/production-backend-entrypoint\.js"\]/);
  for (const excluded of [".visual-auth", ".visual-runtime", "doflow-gestionale-reference"]) {
    assert.match(dockerignore, new RegExp(excluded.replaceAll(".", "\\.")));
  }
});

test("runbook publishes exact Node-only Coolify commands and the verified 5B.2 pre-cutover", async () => {
  const migrationDoc = await source("docs/doflow-production-migration-runner.md");
  for (const mode of ["status", "dry-run", "apply", "verify"]) {
    assert.match(
      migrationDoc,
      new RegExp(`node apps/backend/dist/scripts/doflow-production-cutover\\.js ${mode}`),
    );
  }
  assert.match(migrationDoc, /--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER/);
  assert.match(migrationDoc, /--backup-ref=<BACKUP_ID_VERIFICATO>/);
  assert.match(migrationDoc, /Pre-cutover production Fase 5B\.2/);
  assert.match(migrationDoc, /doflow-prod-precutover-20260825T092025Z/);
  assert.match(migrationDoc, /push su `origin\/main` attiva l'autodeploy/);
  assert.doesNotMatch(migrationDoc, /DB_SYNC=true.*(?:consentito|abilitare)/i);
});
