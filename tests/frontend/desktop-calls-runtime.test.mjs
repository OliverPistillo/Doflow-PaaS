import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const provider = read("apps/frontend/src/features/calls/desktop-calls-provider.tsx");
const bridge = read("apps/frontend/src/lib/desktop-bridge.ts");
const api = read("apps/frontend/src/features/calls/doflow-calls-api.ts");
const guest = read("apps/frontend/src/features/calls/guest-meeting-page.tsx");
const proxy = read("apps/frontend/src/proxy.ts");
const nextConfig = read("apps/frontend/next.config.mjs");
const legacyTeam = read("apps/frontend/src/components/tenant-collaboration/team-space-collaboration.tsx");

test("normal browser sessions cannot render or start internal calls", () => {
  assert.match(bridge, /if \(!desktop \|\| desktop\.bridgeVersion < 2\) return null/);
  assert.match(provider, /if \(!deviceId\) \{\s*setReason\("browser"\)/);
  assert.match(provider, /capabilities\.includes\("calls\.internal"\)/);
  assert.doesNotMatch(legacyTeam, /LiveKitCallPanel|callStatus|startCall/);
  assert.equal(existsSync(path.join(root, "apps/frontend/src/components/tenant-collaboration/livekit-call-panel.tsx")), false);
});

test("Desktop calls use persisted authority, existing realtime, and fixed native bridge methods", () => {
  for (const endpoint of ["/presence", "/incoming", "/accept", "/reject", "/cancel", "/end", "/fail", "/token", "/guest-invites"]) {
    assert.match(api, new RegExp(endpoint.replace(/[/-]/g, "\\$&")));
  }
  assert.match(provider, /useNotifications/);
  assert.match(provider, /event\.type === "user_notification"/);
  assert.match(provider, /unwrapCallEvent/);
  assert.match(provider, /recoverIncoming/);
  assert.match(provider, /showIncomingDesktopCall/);
  assert.match(provider, /openDesktopCall/);
  assert.match(provider, /updateDesktopCallCredentials/);
  assert.match(provider, /TERMINAL/);
  assert.doesNotMatch(bridge, /userAgent|navigator\.userAgent|window\.__TAURI_INTERNALS__/);
});

test("guest meeting keeps its bearer in the URL fragment and exposes no CRM session", () => {
  assert.match(guest, /window\.location\.hash/);
  assert.match(guest, /window\.history\.replaceState/);
  assert.match(api, /credentials: "omit"/);
  assert.match(api, /referrerPolicy: "no-referrer"/);
  assert.match(nextConfig, /Referrer-Policy[\s\S]*no-referrer/);
  assert.match(nextConfig, /X-Robots-Tag[\s\S]*noindex/);
  assert.match(proxy, /"meeting"/);
  assert.match(guest, /Prova microfono/);
  assert.match(guest, /getUserMedia/);
  assert.match(guest, /microphoneTestStreamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.doesNotMatch(guest + api, /client-portal|\/client\/|tenantId|roomName|localStorage|sessionStorage/);
});

test("CRM actions map only real supported record kinds", () => {
  const teamActions = read("apps/frontend/src/features/chat/team-space-call-ui.tsx");
  const project = read("apps/frontend/src/features/commercial/components/commercial-project-detail-page.tsx");
  const client = read("apps/frontend/src/features/commercial/components/commercial-client-detail-page.tsx");
  const opportunity = read("apps/frontend/src/components/tenant-commercial/opportunity-detail-sheet.tsx");
  assert.match(teamActions, /record\.type === "project"[\s\S]*kind: "project"/);
  assert.match(teamActions, /record\.type === "customer"[\s\S]*kind: "company"/);
  assert.doesNotMatch(teamActions, /record\.type === "lead"[\s\S]*kind: "opportunity"/);
  assert.match(project, /kind: "project"/);
  assert.match(project, /DesktopUserCallActions[\s\S]*userId=\{project\.ownerId\}/);
  assert.match(client, /kind: "company"/);
  assert.match(client, /kind: "contact"/);
  assert.match(client, /DesktopUserCallActions[\s\S]*userId=\{customer\.profile\.assigneeId\}/);
  assert.match(opportunity, /kind: "opportunity"/);
  assert.match(opportunity, /DesktopUserCallActions[\s\S]*userId=\{opportunity\.assigned_to\}/);
});
