import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  requiredSwcHelperFiles,
  validateSwcHelperInventory,
} from "../../scripts/frontend-production-image-acceptance.mjs";

const root = path.resolve(import.meta.dirname, "../..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("root package exposes the exact frontend production-image acceptance", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(
    packageJson.scripts["acceptance:frontend-production-image"],
    "node scripts/frontend-production-image-acceptance.mjs",
  );
});

test("the Next 16.3.1 incomplete helper artifact fails closed", () => {
  const incomplete = [
    "package.json",
    "cjs/_interop_require_default.cjs",
  ];
  assert.deepEqual(validateSwcHelperInventory(incomplete), [
    "esm/_interop_require_default.js",
  ]);
});

test("the complete Next 16.3.2 helper artifact passes", () => {
  assert.deepEqual(validateSwcHelperInventory([...requiredSwcHelperFiles]), []);
});

test("acceptance builds and runs the exact production Dockerfile", async () => {
  const orchestrator = await source("scripts/frontend-production-image-acceptance.mjs");
  assert.match(orchestrator, /"build",\s*\n\s*"--file", "apps\/frontend\/Dockerfile"/);
  assert.match(orchestrator, /"--build-arg", "NEXT_PUBLIC_API_URL="/);
  assert.match(orchestrator, /"-p", `\$\{hostPort\}:3000`/);
  assert.match(orchestrator, /"node", "apps\/frontend\/server\.js"/);
  assert.match(orchestrator, /esm\/_interop_require_default\.js/);
  assert.match(orchestrator, /observationMs/);
  assert.match(orchestrator, /index <= 10/);
  assert.match(orchestrator, /index <= 3/);
});

test("acceptance evidence and cleanup are permanent and isolated", async () => {
  const orchestrator = await source("scripts/frontend-production-image-acceptance.mjs");
  assert.match(orchestrator, /frontend-standalone-hotfix-result\.json/);
  assert.match(orchestrator, /atomicWriteJson\(resultPath, evidence\)/);
  assert.match(orchestrator, /doflow-frontend-production-image-acceptance/);
  assert.match(orchestrator, /docker\(\["rm", "-f", containerName\]/);
  assert.match(orchestrator, /docker\(\["image", "rm", imageTag\]/);
  assert.doesNotMatch(orchestrator, /\bprune\b/i);
  assert.doesNotMatch(orchestrator, /doflow-nginx/i);
});

test("hotfix versions are exact and no fallback package copy was introduced", async () => {
  const frontendPackage = JSON.parse(await source("apps/frontend/package.json"));
  const dockerfile = await source("apps/frontend/Dockerfile");
  const nextConfig = await source("apps/frontend/next.config.mjs");
  assert.equal(frontendPackage.dependencies.next, "16.3.2");
  assert.equal(frontendPackage.devDependencies["eslint-config-next"], "16.3.2");
  assert.doesNotMatch(dockerfile, /@swc\/helpers/);
  assert.doesNotMatch(nextConfig, /outputFileTracingIncludes/);
  assert.match(nextConfig, /output: "standalone"/);
});
