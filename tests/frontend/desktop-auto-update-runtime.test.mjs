import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const layout = read("apps/frontend/src/app/layout.tsx");
const coordinator = read("apps/frontend/src/components/desktop/legacy-desktop-update-coordinator.tsx");
const bridge = read("apps/frontend/src/lib/desktop-bridge.ts");
const identity = read("apps/frontend/src/features/identity/doflow-identity-provider.tsx");

test("legacy updater coordinator is mounted above auth without modifying login", () => {
  assert.match(layout, /<LegacyDesktopUpdateCoordinator\s*\/>[\s\S]*\{children\}/);
  assert.doesNotMatch(identity, /DesktopUpdateBanner|LegacyDesktopUpdateCoordinator/);
  assert.match(coordinator, /role="dialog"/);
  assert.match(coordinator, /Doflow Desktop · Canale Stable/);
});

test("legacy compatibility is exact bridge v1 and browser or v2 remain no-op", () => {
  assert.match(bridge, /desktop\.bridgeVersion !== 1/);
  assert.match(bridge, /typeof window === "undefined"/);
  assert.match(coordinator, /if \(!updater \|\| !attempts\.claim\(updater\)\) return/);
  assert.match(bridge, /state\.updateAvailable[\s\S]*state\.kind === "optional"[\s\S]*state\.kind === "mandatory"/);
});

test("legacy update is automatic once and exposes explicit retry or supported fallback", () => {
  assert.match(bridge, /await updater\.installCurrentVerifiedUpdate\(\)/);
  assert.match(bridge, /WeakSet<object>/);
  assert.match(coordinator, /Riprova aggiornamento/);
  assert.match(coordinator, /view\.update\?\.kind === "optional"/);
  assert.match(coordinator, /Continua con questa versione/);
});
