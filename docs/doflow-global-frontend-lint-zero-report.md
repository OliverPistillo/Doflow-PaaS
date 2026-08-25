# Doflow — Fase 5A.4 global frontend lint zero

Data verifica: 24 agosto 2026. Branch `main`, SHA base
`961c7d0d1886742f9330fad81100a2634596cc02`.

## Esito

Il gate ESLint globale di `apps/frontend` è chiuso con `0` errori, `0`
warning ed exit code `0`. Il comando riproducibile è:

```text
pnpm lint:frontend:strict
```

Lo script root invoca `pnpm --filter frontend lint:strict`; lo script del
package frontend esegue `eslint . --max-warnings=0`. Non usa `next lint`,
`--quiet`, formatter che nascondono warning o esclusioni aggiuntive.

## Baseline reale

La baseline JSON ignorata è stata acquisita prima delle correzioni con ESLint
`9.39.5`, `eslint-config-next` `16.3.1` e configurazione flat:

- errori: `0`;
- warning: `673`;
- file interessati: `153`.

| Regola | Baseline | Finale |
|---|---:|---:|
| `@typescript-eslint/no-unused-vars` | 230 | 0 |
| `@typescript-eslint/no-explicit-any` | 182 | 0 |
| `react-hooks/set-state-in-effect` | 142 | 0 |
| `react-hooks/exhaustive-deps` | 44 | 0 |
| `react/no-unescaped-entities` | 41 | 0 |
| `@next/next/no-location-assign-relative-destination` | 7 | 0 |
| `react-hooks/purity` | 5 | 0 |
| `react-hooks/static-components` | 5 | 0 |
| `react-hooks/preserve-manual-memoization` | 4 | 0 |
| direttive ESLint inutilizzate | 3 | 0 |
| `@next/next/no-img-element` | 2 | 0 |
| `@typescript-eslint/ban-ts-comment` | 2 | 0 |
| `react-hooks/immutability` | 2 | 0 |
| `react-hooks/incompatible-library` | 2 | 0 |
| `@typescript-eslint/no-unused-expressions` | 1 | 0 |
| `react-hooks/refs` | 1 | 0 |

Distribuzione baseline per directory: `src/components` 321, `src/app` 301,
`src/lib` 35, `src/config` 6, `src/hooks` 5, `src/contexts` 3 e
`src/features` 2 warning.

Classificazione deterministica per bounded context: altro frontend 208,
Delivery 136, Document & Revenue 112, Superadmin 65, Commercial 53,
Automations/Performance 38, Collaboration 33, shell/UI condivisa 14,
Commerce 9, Builder 4 e test 1. Auth/sessioni, onboarding e configurazione
avevano zero warning distinti secondo il classificatore; eventuali file
con nomi trasversali sono rimasti nella categoria più specifica precedente.

## Correzioni per batch

1. Lifecycle React: caricamenti al mount differiti con cleanup, callback
   aggiornate tramite `useEffectEvent`, polling e abort preservati, stato
   derivato dove appropriato.
2. Type safety: rimossi tutti i tipi `any` segnalati usando DTO, union,
   `unknown` con narrowing e modelli locali minimi.
3. Codice morto: organizzazione import TypeScript AST-aware e rimozione
   verificata di import, state, funzioni e parametri non letti.
4. Next/React: navigazioni interne passate a `router.push`, immagini dinamiche
   a `next/image` non ottimizzato con dimensioni e classi esistenti, componenti
   dinamici spostati fuori dal render, React Hook Form passato a `useWatch`.
5. Residui: entità JSX, catch tipizzati, purezza temporale e direttive ESLint
   diventate obsolete.

I warning che indicavano rischi reali hanno portato a correzioni locali:
stale closure nei caricamenti, lettura di `ref.current` durante il render nel
polling Sales Intelligence, componenti ricreati durante il render, full reload
per route interne e uso incompatibile di `watch()` con React Compiler. Non sono
stati cambiati endpoint, payload, capability o contratti backend.

## Configurazione, disable e ignore

- nessuna regola è stata abbassata o disabilitata;
- nessun plugin è stato rimosso;
- i soli ignore flat restano quelli standard `.next/**`, `out/**`, `build/**`
  e `next-env.d.ts`;
- nessun file `.eslintignore` è presente;
- nuovi `eslint-disable`: `0`;
- nuovi ignore: `0`;
- `@ts-ignore`: `0`;
- `@ts-nocheck`: `0`.

La ricerca finale rileva 14 direttive ESLint preesistenti, locali e già usate;
questa fase non ne ha aggiunta alcuna. La configurazione ESLint ha ricevuto
soltanto l’aggiornamento del commento che documenta il nuovo script strict;
regole, severità, parser, plugin e ignore sono invariati rispetto alla baseline
della fase.

## Verifiche

| Gate | Esito |
|---|---|
| install frozen + strict peer | PASS |
| lint globale strict, run 1 | PASS — 0 errori, 0 warning |
| lint globale strict, run 2 | PASS — 0 errori, 0 warning |
| frontend type-check | PASS |
| tutti i test Node frontend | PASS — 14/14 |
| audit browser auth | PASS — 755 file, zero browser bearer |
| audit Commercial | PASS — exit code 0, inventario provider preservato |
| audit Delivery | PASS — 0 mutazioni Delivery client-only |
| audit Commerce | PASS — 0 store autorevoli / mutazioni Fase 3A client-only |
| audit Document | PASS — 0 store autorevoli / mutazioni Fase 3B client-only |
| audit Collaboration | PASS — 0 authority path client-only |
| audit Automations/Performance | PASS — authority server preservata |
| audit release candidate | PASS |
| frontend production build | PASS — 220 pagine statiche |
| backend build | PASS |
| `git diff --check` | PASS |

L’audit Commercial continua a inventariare le azioni residue già classificate
fuori dai bounded context chiusi; l’audit RC complessivo le riconcilia e resta
PASS. Il provider misura 7.762 righe e gli audit di dominio confermano zero
reintroduzioni di authority browser nei core già accettati.

## Perimetro preservato

Login, MFA, sessioni, route, capability, sette tab progetto, Builder,
Client Portal assente, design e comportamento degli altri tenant non sono
stati modificati. Le entità JSX rendono lo stesso testo; `next/image` mantiene
classi, altezze, larghezze e `object-cover` dei due preview Builder. Non sono
stati prodotti screenshot perché non è cambiata alcuna struttura o resa
visiva coperta dai riferimenti canonici; il visual gate globale resta alla
Fase 5A.5.

Evidence machine-readable ignorata:
`.visual-runtime/global-frontend-lint-result.json`.

Verdetto della fase: **GLOBAL FRONTEND LINT ZERO GO**.
