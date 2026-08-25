import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const providerPath = 'apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx';
const apiPath = 'apps/frontend/src/lib/tenant-document-revenue-api.ts';
const typesPath = 'apps/frontend/src/features/commercial/commercial-provider-types.ts';
const documentsPath = 'apps/frontend/src/features/commercial/commercial-documents.ts';
const commercePath = 'apps/frontend/src/features/commercial/commercial-commerce.ts';
const provider = read(providerPath);
const api = read(apiPath);
const types = read(typesPath);
const production = [provider, api, types, read(documentsPath), read(commercePath)].join('\n');
const failures = [];

for (const token of [
  'commercialApi.quotes(',
  'contractsApi.list(',
  '/tenant/finance/invoices',
  '/tenant/finance/renewals',
  'calculateDocumentTotals',
  'contractApiBody',
]) {
  if (production.includes(token)) failures.push(`legacy Phase 3B runtime token: ${token}`);
}

if (/localStorage|sessionStorage/.test(production)) {
  failures.push('authoritative Document & Revenue runtime storage detected');
}

for (const call of [
  'documentRevenueApi.createQuote',
  'documentRevenueApi.updateQuote',
  'documentRevenueApi.quoteVersion',
  'documentRevenueApi.createInvoice',
  'documentRevenueApi.transitionInvoice',
  'documentRevenueApi.creditNote',
  'documentRevenueApi.generateContract',
  'documentRevenueApi.updateContract',
  'documentRevenueApi.sendContract',
  'documentRevenueApi.signContract',
  'documentRevenueApi.contractVersion',
  'documentRevenueApi.archiveContract',
  'documentRevenueApi.activateRenewal',
  'documentRevenueApi.updateRenewal',
  'documentRevenueApi.remindRenewal',
  'documentRevenueApi.renewalOrder',
  'documentRevenueApi.archiveRenewal',
]) {
  if (!provider.includes(call)) failures.push(`missing API-first provider call: ${call}`);
}

for (const signature of [
  'addQuote:', 'updateQuote:', 'createQuoteVersion:', 'addInvoice:',
  'updateInvoice:', 'createCreditNote:', 'generateContract:',
  'updateContract:', 'sendContract:', 'markContractSigned:',
  'createContractVersion:', 'archiveContract:', 'activateRenewal:',
  'updateRenewal:', 'sendRenewalReminder:', 'generateRenewalOrder:',
  'archiveRenewal:',
]) {
  const offset = types.indexOf(signature);
  if (offset < 0 || !types.slice(offset, offset + 700).includes('Promise<')) {
    failures.push(`provider mutation is not asynchronous: ${signature}`);
  }
}

if (!api.includes('"Idempotency-Key"')) failures.push('mutations lack Idempotency-Key');
if (!provider.includes('documentRevenueState.customerFinance')) {
  failures.push('customer finance is not projected from backend aggregation');
}

const report = {
  providerLines: provider.split(/\r?\n/).length,
  phase3ABaselineLines: 7808,
  removedSincePhase3A: 7808 - provider.split(/\r?\n/).length,
  phase3BClientOnlyMutations: failures.filter((item) => item.includes('API-first')).length,
  authoritativeBrowserStores: /localStorage|sessionStorage/.test(production) ? 1 : 0,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
