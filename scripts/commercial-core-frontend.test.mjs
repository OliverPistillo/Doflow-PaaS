import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const provider = read('apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx');
const api = read('apps/frontend/src/lib/tenant-commercial-api.ts');
const duplicateHook = read('apps/frontend/src/features/commercial/hooks/use-commercial-duplicates.ts');
const duplicatePage = read('apps/frontend/src/features/commercial/components/duplicates-page.tsx');
const cacheHook = read('apps/frontend/src/features/commercial/hooks/use-commercial-core-cache.ts');

test('le query Commercial Core accettano AbortSignal', () => {
  for (const method of ['companies', 'contacts', 'leads', 'opportunities', 'activities', 'pipeline', 'duplicateGroups', 'customerAggregate']) {
    assert.match(api, new RegExp(`${method}\\([^)]*signal\\?: AbortSignal`));
  }
});

test('le mutazioni critiche inviano Idempotency-Key', () => {
  for (const method of ['createLead', 'transitionOpportunity', 'reorderPipeline', 'reorderActivities', 'archive', 'restore', 'convertOpportunity', 'updateAttribution', 'decideDuplicate', 'mergeDuplicates']) {
    const start = api.indexOf(`${method}(`);
    assert.notEqual(start, -1, `${method} assente`);
    assert.match(api.slice(start, start + 900), /idempotencyHeaders/);
  }
});

test('l analisi duplicati viene caricata dal backend e non calcolata nel componente', () => {
  assert.match(duplicateHook, /commercialApi\.duplicateGroups/);
  assert.doesNotMatch(duplicatePage, /analyzeDuplicates|getDuplicateCandidates/);
});

test('il hook duplicati abortisce richieste obsolete ed espone loading ed error', () => {
  assert.match(duplicateHook, /controllerRef\.current\?\.abort\(\)/);
  assert.match(duplicateHook, /loading: true/);
  assert.match(duplicateHook, /error:/);
});

test('le decisioni duplicato invalidano la query dopo la mutazione', () => {
  assert.match(duplicateHook, /await commercialApi\.decideDuplicate[\s\S]*await refresh\(\)/);
});

test('pipeline, conversione e merge usano esclusivamente le API server-authoritative', () => {
  assert.match(provider, /commercialApi\.transitionOpportunity/);
  assert.match(provider, /commercialApi\.convertOpportunity/);
  assert.match(provider, /commercialApi\.mergeDuplicates/);
  assert.doesNotMatch(provider, /\/tenant\/doflow\/duplicates\/merge/);
});

test('la creazione lead usa un solo aggregate endpoint transazionale', () => {
  const start = provider.indexOf('async addLead(lead)');
  const end = provider.indexOf('addCustomerContact(', start);
  const action = provider.slice(start, end);
  assert.match(action, /commercialApi\.createLead/);
  assert.doesNotMatch(action, /commercialApi\.(?:createCompany|createContact|createOpportunity)/);
});

test('attività dirette, appuntamenti e attribution inviano mutazioni al backend', () => {
  assert.match(provider, /\.reorderActivities/);
  assert.match(
    provider,
    /type: "appointment"[\s\S]*commercialApi\s*\.updateActivity/,
  );
  assert.match(provider, /\.updateAttribution/);
  assert.match(provider, /Impossibile riordinare l’attività/);
  assert.match(provider, /Impossibile aggiornare l’appuntamento/);
});

test('l access denied Commercial Core non viene trasformato in successo locale', () => {
  assert.match(provider, /canCreateLeads[\s\S]{0,120}throw new Error\("Operazione non autorizzata"\)/);
  const decideStart = duplicateHook.indexOf('const decide');
  const decideEnd = duplicateHook.indexOf('return {', decideStart);
  const decide = duplicateHook.slice(decideStart, decideEnd);
  assert.match(decide, /await commercialApi\.decideDuplicate/);
  assert.doesNotMatch(decide, /catch/);
});

test('le cache Commercial Core non persistono nel browser e non inizializzano fixture', () => {
  assert.doesNotMatch(cacheHook, /localStorage|sessionStorage|fixture|demo/i);
  assert.match(cacheHook, /useState<CommercialLead\[]>\(\[\]\)/);
  assert.match(cacheHook, /useState<CommercialCustomer\[]>\(\[\]\)/);
});

test('nessun runtime Commercial Core usa localStorage o sessionStorage', () => {
  const runtime = [provider, api, duplicateHook, duplicatePage, cacheHook].join('\n');
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
});

test('le optimistic mutation principali dichiarano rollback su errore', () => {
  for (const message of [
    'Riordino pipeline non riuscito',
    'Aggiornamento cliente non riuscito',
    'Contatto non aggiornato',
    'Comunicazione non aggiornata',
  ]) assert.match(provider, new RegExp(message));
});
