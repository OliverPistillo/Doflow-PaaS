import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Automation access separates read, manage, run and retry capabilities', async () => {
  const [permissions, model] = await Promise.all([
    read('apps/frontend/src/features/identity/permissions.ts'),
    read('apps/frontend/src/components/tenant-automation-center/automation-center-model.ts'),
  ]);
  const webDeveloper = permissions.match(/web_developer:\s*\[([^\]]+)\]/)?.[1] || '';
  assert.match(webDeveloper, /"canViewAutomations"/);
  for (const forbidden of ['canManageAutomations', 'canRunAutomations', 'canRetryAutomations', 'canViewAutomationErrors', 'canManagePointPolicies', 'canManageRankings', 'canManageGoals']) {
    assert.doesNotMatch(webDeveloper, new RegExp(`"${forbidden}"`));
  }
  for (const contract of ['canViewRules', 'canManageRules', 'canRunRules', 'canRetryRuns', 'canViewRuns']) {
    assert.match(model, new RegExp(`\\b${contract}\\b`));
  }
  assert.match(model, /hasCapability\("canViewAutomations"\)/);
  assert.match(model, /hasCapability\("canManageAutomations"\)/);
  assert.match(model, /hasCapability\("canRunAutomations"\)/);
  assert.match(model, /hasCapability\("canRetryAutomations"\)/);
  assert.doesNotMatch(model, /role\s*===\s*["']web_developer["']/);
});

test('read-only Automation UI loads only capability-authorized secondary data and exposes no mutations', async () => {
  const [workspace, detail, dashboard, provider] = await Promise.all([
    read('apps/frontend/src/components/tenant-automation-center/automation-rules-workspace.tsx'),
    read('apps/frontend/src/components/tenant-automations/automations-core.tsx'),
    read('apps/frontend/src/features/commercial/components/automation-performance-page.tsx'),
    read('apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx'),
  ]);
  assert.match(workspace, /if \(!canViewRules\)/);
  assert.match(workspace, /loadRules\(\)/);
  assert.match(workspace, /canManageRules \? <button/);
  assert.match(workspace, /canTest=\{canRunRules\}/);
  assert.match(detail, /readOnly=\{!canManage\}/);
  assert.match(detail, /if \(!canView\) return <AccessDenied/);
  assert.match(detail, /\{canRun \? <Button/);
  assert.match(detail, />Run<\/Button> : null\}/);
  assert.match(detail, /\{canRetry && \["failed", "dead_letter"\]/);
  assert.match(dashboard, /canViewRuns \? <Button asChild variant="outline"><Link href="\/automations\/runs"/);
  assert.match(provider, /canReadAutomationRules = identity\.hasCapability\("canViewAutomations"\)/);
  assert.match(provider, /canReadAutomationRuns = identity\.hasCapability\("canViewAutomationErrors"\)/);
  assert.match(provider, /canReadAutomationRules\s*\? captureSecondary\([\s\S]*automationsApi\.rules/);
  assert.match(provider, /canReadAutomationRuns\s*\? captureSecondary\([\s\S]*automationsApi\.runs/);
});
