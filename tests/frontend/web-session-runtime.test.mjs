import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(`${root}/${file}`, "utf8");

test("browser API client is cookie-only and CSRF-aware", () => {
  const api = read("apps/frontend/src/lib/api.ts");
  assert.match(api, /credentials:\s*["']include["']/);
  assert.match(api, /X-Doflow-Web/);
  assert.match(api, /X-CSRF-Token/);
  assert.doesNotMatch(api, /Authorization|Bearer|getAuthToken|auth\?:/);
});

test("legacy auth storage is removed and jwt compatibility has no decoder", () => {
  assert.equal(existsSync(`${root}/apps/frontend/src/lib/auth-storage.ts`), false);
  const compatibility = read("apps/frontend/src/lib/jwt.ts");
  assert.doesNotMatch(compatibility, /localStorage|sessionStorage|indexedDB|atob|parseJwt|getAuthToken|Authorization|Bearer/);
  assert.match(compatibility, /loaded from `\/auth\/me`/);
});

test("login and MFA responses do not consume browser bearer material", () => {
  const login = read("apps/frontend/src/components/auth/login-panel.tsx");
  const mfa = read("apps/frontend/src/app/[tenant]/mfa/page.tsx");
  assert.doesNotMatch(login, /storeAuthToken|parseJwt|Authorization|Bearer|data\.token/);
  assert.doesNotMatch(mfa, /replaceAuthToken|parseJwt|Authorization|Bearer|res\.token/);
  assert.match(mfa, /\/auth\/me/);
});
