# Doflow production cutover report

## Stato del documento

Questo report separa il cutover dati/backend già documentato dal replacement
frontend Full Daniele Design eseguito localmente il 25 agosto 2026. Non è un
verbale di deploy del nuovo frontend e non autorizza operazioni di produzione.

## Baseline frontend corrente

- repository: `OliverPistillo/Doflow-PaaS`;
- branch: `main`;
- base HEAD/origin: `2eb8f6a4dae4fb990d8bbc4c9da65fb04ba5f220`;
- working tree: intenzionalmente dirty, zero staged;
- reference locale lasciata su `master@e6c3ef5920773afc14b3caff88cfe4027400c54b`;
- reference visuale letta in sola lettura:
  `origin/daniele-design@b9a08eea2acaabf23ed56c75111f714c551374f8`;
- target canonico: `TARGET — Reference Daniele.png`, `1348×888`, tema
  `default`.

## Variazione candidata

Il tenant `doflow` riceve la shell Daniele completa, la dashboard canonica,
la nuova tassonomia di navigazione, presentation auth coerente e Builder
integrato. Altri tenant continuano a usare la shell compatibile; Superadmin
mantiene la Control Room separata. Nessun Client Portal viene reintrodotto.

Il frontend continua a usare le API, DTO, sessioni opache HttpOnly, CSRF,
capability e dati server-authoritative già in produzione. Non sono state
modificate migrazioni, schema, mapper, seed, Redis, MinIO, worker o scheduler.

## Evidence locale isolata

| Gate | Risultato |
| --- | --- |
| UI purity | GO, 227 moduli / 51 entry route |
| Backend | 103/103 suite, 1127/1127 test, build PASS |
| Frontend | lint strict due volte 0 warning, type-check, 25/25 test, build 224 pagine |
| Immagine production frontend | Dockerfile esatto, Next standalone; 300 s; restart 0; 10/10 probe; container/image/porta rimossi |
| Security | browser-auth/release/security PASS; audit dipendenze 0 vulnerabilità su 1044 |
| Migration rehearsal | true pre-179 GO, 178→184, zero pending, restore/replay PASS |
| Global acceptance | Context A–E GO, SUPERADMIN CONTEXT E GO |
| Visual | 75 screenshot, 4/4, GLOBAL VISUAL GO, VISUAL GO |
| Health | 10/10 |
| Teardown | stack, credenziali e risorse acceptance rimossi |

Actual canonico:
`docs/design-references/doflow-crm-projects/actual/full-daniele-design/dashboard-target-1348x888-default.png`.

Diff:
`docs/design-references/doflow-crm-projects/diff/full-daniele-design/dashboard-target-1348x888-pixel-diff.png`.

Evidence immagine production:
`.visual-runtime/frontend-standalone-hotfix-result.json` (image locale rimossa
dal teardown; identificativo evidence
`sha256:67be418009757114c9ab2760b149c5cd1b4c19ce8fbfe949ea883c294d6537c5`).

## Stato produzione

Nessun commit, staging, push, deploy, redeploy, migrazione, mapper, seed o SQL
è stato eseguito durante questo task. Nessun dato o account reale è stato
usato come fixture; Oliver, Daniele e il tenant `federicanerone` non sono stati
modificati. Il deploy del replacement frontend richiede una successiva
autorizzazione esplicita e un nuovo controllo sull'artefatto immutabile.

## Rollback e invarianti

Il futuro rilascio dovrà preservare il runner migrazioni fail-closed e non deve
avviare mapper/seed automaticamente. Il rollback applicativo deve puntare a un
artefatto precedente noto senza revert di migrazioni e senza modificare dati.
`DB_SYNC=true`, SQL manuale e scritture cross-tenant restano vietati.

Stato di questo addendum: `FRONTEND CANDIDATE VERIFIED LOCALLY — NOT DEPLOYED`.
