import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('notifications and realtime use server authority', async () => {
  const [menu, page, realtime, api] = await Promise.all([
    readFile('apps/frontend/src/components/notifications-menu.tsx', 'utf8'),
    readFile('apps/frontend/src/app/(tenant)/dashboard/notifiche/page.tsx', 'utf8'),
    readFile('apps/frontend/src/hooks/useNotifications.ts', 'utf8'),
    readFile('apps/frontend/src/lib/tenant-collaboration-api.ts', 'utf8'),
  ]);
  assert.doesNotMatch(menu + page, /deriveNotifications|notificationState/);
  assert.doesNotMatch(realtime, /getAuthToken|[?&]token=/);
  assert.match(realtime, /2 \*\* retry/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /expectedVersion/);
});
