import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
test('Phase 4B frontend queries and mutates only through server APIs', async () => {
  const [api, provider, rankings, mission] = await Promise.all([
    read('apps/frontend/src/lib/tenant-performance-api.ts'),
    read('apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx'),
    read('apps/frontend/src/features/commercial/commercial-rankings.ts'),
    read('apps/frontend/src/features/dashboard/synchronized-dashboard-overview.tsx'),
  ]);
  for (const path of ['point-policy', 'point-ledger/adjustments', 'rankings/configs', 'rankings/preview', 'consolidate', 'recalculate', 'revoke']) assert.match(api, new RegExp(path.replace('/', '\\/')));
  assert.doesNotMatch(`${api}\n${provider}\n${rankings}\n${mission}`, /localStorage|sessionStorage/);
  assert.doesNotMatch(rankings, /calculateRanking|buildRankingSnapshot/);
  assert.match(provider, /await performanceApi\.adjustPoints/);
  assert.match(provider, /await automationsApi\.createRule/);
  assert.match(mission, /performanceApi\.state/);
});
