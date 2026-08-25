import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const providerPath = path.join(root, 'apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx');
const apiPath = path.join(root, 'apps/frontend/src/lib/tenant-delivery-api.ts');
const adapterPath = path.join(root, 'apps/frontend/src/features/commercial/commercial-provider-adapters.ts');
const provider = await readFile(providerPath, 'utf8');
const api = await readFile(apiPath, 'utf8');
const adapters = await readFile(adapterPath, 'utf8');

const baselineLines = 10_393;
const currentLines = provider.split(/\r?\n/).length;
const deliveryMutations = [
  'generateOrderProject', 'addCustomerActivity', 'updateCustomerActivity', 'moveCustomerActivity',
  'submitCustomerActivityWork', 'approveCustomerActivityWork', 'requestCustomerActivityChanges',
  'markCustomerActivityReadyForClient', 'publishCustomerActivityWork', 'completeCustomerActivity',
  'reopenCustomerActivity', 'deleteCustomerActivity', 'generateNextCustomerActivityRecurrence',
  'startCustomerOnboarding', 'startProjectTime', 'stopProjectTime', 'archiveProjectTime',
  'setProjectQaItem', 'publishProjectClientUpdate', 'deliverProject', 'createProject', 'updateProject',
  'archiveProject', 'addProjectPhase', 'updateProjectPhase', 'deleteProjectPhase',
  'reorderProjectPhases', 'setProjectPhaseStatus', 'linkActivityToProjectPhase',
  'unlinkActivityFromProjectPhase', 'linkActivityToProject', 'unlinkActivityFromProject',
];

function methodSource(name) {
  const pattern = new RegExp(`^\\s+(?:async\\s+)?${name}\\(`, 'm');
  const match = pattern.exec(provider);
  if (!match) throw new Error(`Delivery provider action missing: ${name}`);
  const start = match.index;
  const open = provider.indexOf('{', start + match[0].length);
  if (open < 0) throw new Error(`Delivery provider action body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < provider.length; index += 1) {
    const character = provider[index];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) return provider.slice(start, index + 1);
  }
  throw new Error(`Delivery provider action is truncated: ${name}`);
}

const conditionalBoundaries = {
  generateOrderProject: ['commerceApi.generateProject'],
  addCustomerActivity: ['deliveryApi', 'createActivityOnServer'],
  updateCustomerActivity: ['deliveryApi', 'updateActivityOnServer'],
  deleteCustomerActivity: ['deliveryApi', 'deleteActivityOnServer'],
  generateNextCustomerActivityRecurrence: ['deliveryApi', 'createActivityOnServer'],
};
const boundaryEvidence = Object.fromEntries(Object.entries(conditionalBoundaries).map(([name, required]) => {
  const source = methodSource(name);
  return [name, { sourceLength: source.length, required, present: required.filter((boundary) => source.includes(boundary)) }];
}));
const missingApiBoundary = deliveryMutations.filter((name) => {
  const source = methodSource(name);
  const required = conditionalBoundaries[name] || ['deliveryApi.'];
  return required.some((boundary) => !source.includes(boundary));
});
const dedicatedWorkflowActions = deliveryMutations.filter((name) => ![
  'addCustomerActivity', 'updateCustomerActivity', 'moveCustomerActivity',
  'completeCustomerActivity', 'reopenCustomerActivity', 'deleteCustomerActivity',
  'generateNextCustomerActivityRecurrence',
].includes(name));
const simulatedWorkflow = dedicatedWorkflowActions.filter((name) => /setTimelineEvents|commitActivityWorkflow|synchronizeProjectPhases/.test(methodSource(name)));
const forbiddenStorage = /(?:localStorage|sessionStorage)/.test(`${provider}\n${api}`);
const oldDeliveryEndpoint = /\/tenant\/(?:projects|project-tasks|project-time-sessions)/.test(
  deliveryMutations.map(methodSource).join('\n'),
);
const conditionalTaskBoundaries = ['addCustomerActivity', 'updateCustomerActivity', 'moveCustomerActivity', 'deleteCustomerActivity', 'generateNextCustomerActivityRecurrence']
  .filter((name) => {
    const source = methodSource(name);
    if (!/projectId|activity\.projectId/.test(source) || !/deliveryApi\s*\./.test(source)) return true;
    const helper = conditionalBoundaries[name]?.find((boundary) => boundary.endsWith('OnServer'));
    return Boolean(helper && (!source.includes(helper) || !adapters.includes(`export function ${helper}`)));
  });

const result = {
  baselineLines,
  currentLines,
  removedLines: baselineLines - currentLines,
  reductionPercent: Number((((baselineLines - currentLines) / baselineLines) * 100).toFixed(1)),
  deliveryActionsAudited: deliveryMutations.length,
  deliveryClientOnlyMutations: missingApiBoundary.length + simulatedWorkflow.length + conditionalTaskBoundaries.length,
  missingApiBoundary,
  simulatedWorkflow,
  conditionalTaskBoundaries,
  forbiddenStorage,
  oldDeliveryEndpoint,
  boundaryEvidence,
};

if (missingApiBoundary.length || simulatedWorkflow.length || conditionalTaskBoundaries.length || forbiddenStorage || oldDeliveryEndpoint) {
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
