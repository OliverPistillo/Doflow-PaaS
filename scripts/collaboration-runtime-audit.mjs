import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = {
  provider: 'apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx',
  menu: 'apps/frontend/src/components/notifications-menu.tsx',
  page: 'apps/frontend/src/app/(tenant)/dashboard/notifiche/page.tsx',
  realtime: 'apps/frontend/src/hooks/useNotifications.ts',
  gateway: 'apps/backend/src/realtime/notifications.gateway.ts',
  bootstrap: 'apps/backend/src/main.ts',
};
const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readFile(resolve(root, file), 'utf8')])));
const failures = [];
const forbid = (key, pattern, message) => { if (pattern.test(sources[key])) failures.push(message); };
forbid('provider', /setNotificationState|notificationState/, 'notification state must not live in the commercial provider');
forbid('provider', /void\s+apiFetch\(\s*[`'"]\/tenant\/doflow\/collaboration\/comments/, 'comment mutations must not be fire-and-forget');
forbid('menu', /deriveNotifications|useCommercialLeads/, 'notification menu must query server authority');
forbid('page', /deriveNotifications|useCommercialLeads/, 'notification page must query server authority');
forbid('realtime', /getAuthToken|[?&]token=/, 'WebSocket client must use the opaque cookie session');
forbid('gateway', /decodeJwt|NO VERIFY|searchParams\.get\(['"]token/, 'WebSocket gateway must not decode unverified JWTs');
forbid('bootstrap', /searchParams\.get\(['"]token|jwt\.verify/, 'WebSocket bootstrap must use the opaque Redis session');
for (const key of ['provider', 'menu', 'page', 'realtime']) forbid(key, /localStorage|sessionStorage/, `${key} must not persist collaboration authority in browser storage`);
if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`FAIL ${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write('collaboration runtime audit: 0 client-only authority paths\n');
}
