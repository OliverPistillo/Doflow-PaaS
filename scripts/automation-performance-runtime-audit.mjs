import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [provider, rankings, performanceApi, page, mission, automations, engine, runtime] = await Promise.all([
  read('apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx'),
  read('apps/frontend/src/features/commercial/commercial-rankings.ts'),
  read('apps/frontend/src/lib/tenant-performance-api.ts'),
  read('apps/frontend/src/features/commercial/components/automation-performance-page.tsx'),
  read('apps/frontend/src/features/dashboard/synchronized-dashboard-overview.tsx'),
  read('apps/frontend/src/components/tenant-automations/automations-core.tsx'),
  read('apps/backend/src/tenant/tenant-automation-engine.service.ts'),
  read('apps/backend/src/tenant/tenant-doflow-performance-runtime.service.ts'),
]);
const production = `${provider}\n${rankings}\n${performanceApi}\n${page}\n${mission}\n${automations}`;
assert.doesNotMatch(production, /localStorage|sessionStorage/, 'Phase 4B business authority must not use browser storage');
assert.doesNotMatch(rankings, /calculateRanking|buildRankingSnapshot|defaultRankingConfigs/, 'ranking calculation must be server-side');
const pointMutation = provider.slice(provider.indexOf('async addPointEntry'), provider.indexOf('async updatePointPolicy'));
assert.doesNotMatch(pointMutation, /crypto\.randomUUID|points:\s*input\.points|operationId:\s*crypto/, 'point ledger authority must not be synthesized in the provider');
assert.match(performanceApi, /\/tenant\/doflow\/performance/, 'performance UI must use the tenant API');
assert.match(mission, /performanceApi\.state/, 'Mission progress must come from the backend');
assert.match(engine, /InjectQueue|automation_execution_registry|automation_dead_letters|automation_outbox/, 'automation engine must use queue and persistent registries');
assert.match(runtime, /point_ledger|performance_event_registry|commerce_outbox|delivery_outbox/, 'points must derive from persisted business events');
assert.doesNotMatch(automations, /partono solo da bottoni espliciti/, 'UI must not describe a client/manual-only engine');
process.stdout.write(`${JSON.stringify({ providerLines: provider.split(/\r?\n/).length, authoritativeBrowserStores: 0, clientRankingCalculators: 0, clientPointMutations: 0, missionServerBacked: true })}\n`);
