# Doflow replacement — manifest Release Candidate Fase 5A.5

Stato: **RELEASE CANDIDATE GO in isolamento — deploy non eseguito e non autorizzato da questo documento**.

Verdetto macchina: `DOFLOW REPLACEMENT RELEASE CANDIDATE GO`.

## Identità e perimetro

- repository: `OliverPistillo/Doflow-PaaS`;
- branch: `main`;
- SHA base della working tree: `961c7d0d1886742f9330fad81100a2634596cc02`;
- working tree intenzionalmente dirty e non staged;
- reference read-only: `doflow-gestionale-reference`, branch `master`, SHA
  `e6c3ef5920773afc14b3caff88cfe4027400c54b`;
- perimetro visuale e funzionale replacement: tenant `doflow`;
- secondo tenant sintetico: compatibilità e isolamento verificati;
- Superadmin: scope sintetico `public/FULL`, shell separata;
- Builder: preservato in `/commercial/site-proposals/*`;
- Client Portal: assente;
- provider esterni: disabilitati o sintetici nell'acceptance;
- produzione e account CEO reali: non toccati.

La RC è verificata sulla working tree, non è ancora un artefatto immutabile.
Prima di qualunque cutover serve un commit/SHA esplicitamente autorizzato che
contenga esattamente questa working tree e una nuova esecuzione dei preflight
del runbook sullo stesso artefatto.

## Stack verificato

| Elemento | Versione |
|---|---:|
| Node.js | 20.19.6 |
| pnpm | 10.24.0 |
| Next.js | 16.3.1 |
| React / React DOM | 19.2.8 / 19.2.8 |
| Tailwind CSS | 4.3.3 |
| shadcn | 4.18.0 |
| TypeScript frontend | 5.9.3 |
| ESLint | 9.39.5 |
| NestJS | 11.1.18 |
| Express | 5.2.1 |
| PostgreSQL acceptance | 16-alpine |
| Redis acceptance | 7-alpine |

La build frontend genera 220 pagine statiche; la scansione route rileva 237
route applicative. Le 30 route della reference hanno tutte una destinazione,
con due equivalenze deep-link intenzionali e 14 redirect legacy verificati.

## Orchestratore riproducibile

Il comando root è:

```text
pnpm acceptance:final
```

Il run ufficiale del 24 agosto 2026 ha eseguito in un'unica sequenza:

- installazione frozen con peer dependency strict;
- suite e build backend;
- due lint frontend strict, type-check, test e build production;
- rehearsal vera pre-179;
- audit authority, browser auth, release, security e dipendenze;
- PostgreSQL, Redis, MinIO, backend e frontend su porte locali dedicate;
- migrazioni `171–184`, seconda migration run e mapper/seed idempotenti;
- acceptance Commercial, Delivery, Commerce, Document, Collaboration,
  Automation, Web Session, NestJS/BullMQ e global A–E;
- visual gate globale;
- 10 probe health firmati;
- backup custom, restore in un secondo database e reconciliation;
- verifica preservazione di due identità CEO sintetiche;
- evidence JSON prima del teardown;
- teardown ufficiale e controllo di porte/Docker.

URL e connection string sono vincolati programmaticamente a localhost e ai
container acceptance. `DB_SYNC=false`. Nessun hostname di produzione è
ammesso dall'audit dello script.

## Risultati macchina

| Gate | Esito |
|---|---|
| installazione frozen strict | PASS |
| backend Jest globale | PASS — 95/95 suite, 1076/1076 test |
| backend build | PASS |
| frontend lint strict run 1 | PASS — 0 errori, 0 warning |
| frontend lint strict run 2 | PASS — 0 errori, 0 warning |
| frontend type-check | PASS |
| frontend Node/unit | PASS — 14/14 |
| frontend production build | PASS — 220 pagine |
| true pre-179 rehearsal | `TRUE PRE-179 MIGRATION REHEARSAL GO` |
| browser web session | PASS — cookie opaco HttpOnly, A/B/C/D |
| NestJS 11 + BullMQ | PASS — 2/2 test isolati |
| global Context A–E | PASS — 143 operazioni integrate |
| Superadmin | `SUPERADMIN CONTEXT E GO` |
| idempotenza globale | PASS |
| concorrenza globale | PASS |
| route legacy | PASS — 14 redirect, zero loop |
| visual globale | `GLOBAL VISUAL GO` |
| screenshot | 121 |
| controlli accessibilità | 118 |
| console / HTTP visuale | 0 errori, 0 warning, 0 `5xx` inattesi |
| health | 10/10 |
| dependency audit production | 0 critical/high/moderate/low su 1044 dipendenze |
| security audit | PASS |
| client authority | 0 bearer browser, 0 store business autorevoli, 0 mutazioni client-only |
| backup/restore | PASS — conteggi riconciliati |
| teardown | PASS — porte chiuse, zero risorse Docker acceptance |

## Context A–E

- **A owner Doflow:** MFA, cookie opaco, workflow globale e persistenza
  integrata verificati.
- **B manager stesso tenant:** MFA, realtime, capability e collaborazione
  verificati con sessione indipendente.
- **C utente limitato:** importi redatti lato backend e mutazioni vietate
  respinte.
- **D secondo tenant:** MFA, shell compatibile, dati propri e isolamento
  cross-schema verificati.
- **E Superadmin:** matrice negativa `401/403`, scope `public/FULL`, 10 API
  non distruttive, 9 superfici, shell separata e revoca logout verificate.

## Migrazioni e preservazione

La baseline reale pre-authority termina a `1780000000000`; le migrazioni
`179–184` sono applicate in ordine e il secondo run non ha pending. Il replay
da backup pre, il restore del backup post, il fault rollback, le relazioni, le
somme economiche, il secondo tenant e le ambiguità dichiarate coincidono.

I mapper non inventano ordini, rimborsi, punti, run o firme. Il doppio seed
preserva due identità direzionali sintetiche, mirror, membership e capability.
La query conclusiva dell'orchestratore usa la tabella TypeORM configurata
`public.doflow_migrations`.

## Visual gate

- frontend reale: `http://localhost:3100`;
- reference: `doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b`;
- viewport: `390×900`, `768×900`, `1440×900`;
- temi: chiaro e scuro;
- route canoniche: 30;
- sette tab progetto: preservate;
- interazioni: tastiera, Escape, focus dialog, alternativa al drag, sidebar
  mobile, browser Back, deep link, Select e input data;
- output: `docs/design-references/doflow-crm-projects/actual/final-rc`.

Il confronto reale non ha rilevato differenze critiche o maggiori. Le
variazioni residue sono dati dinamici sintetici e rendering di sistema; non è
stato necessario produrre un pixel diff separato.

## Evidence

Evidence macchina ignorata e priva di segreti:

```text
.visual-runtime/doflow-final-release-candidate-result.json
.visual-runtime/final-global-acceptance-result.json
.visual-runtime/final-global-visual-result.json
.visual-runtime/pre179-migration-rehearsal-result.json
```

Report umano: `docs/doflow-final-release-candidate-report.md`.

## Rischi residui e confine del GO

- la RC non è stata verificata o distribuita in produzione;
- infrastruttura reale, secret manager, capacità, DNS/TLS, storage e provider
  live devono superare il preflight del cutover;
- provider SMTP, Google, Stripe e AI sono rimasti disabilitati/sintetici;
- la working tree deve diventare un artefatto immutabile autorizzato prima del
  deploy;
- restano deprecation non bloccanti già inventariate e il requisito Node 20;
- il JWT non-browser resta un contratto separato; il browser usa solo cookie
  opachi HttpOnly.

Qualunque divergenza dello SHA, migrazione pending, checksum identità inatteso,
failure health/security, leak tenant, risorsa acceptance residua o mancata
reconciliation riporta il cutover a `NO-GO`.

## Divieti rispettati

Nessun reset, clean, stash, restore/checkout globale, cambio branch, pull,
rebase, merge, staging, commit, push, deploy, migrazione/seed produzione,
scrittura tenant reale o modifica account CEO reale è stato eseguito. La
reference è rimasta read-only.

## Verdetto

`SUPERADMIN CONTEXT E GO`

`GLOBAL VISUAL GO`

`DOFLOW REPLACEMENT RELEASE CANDIDATE GO`

## Fase 5B.1 — tentativo di release lock

Il 24 agosto 2026 `origin/main` è stato confermato identico alla base
`961c7d0d1886742f9330fad81100a2634596cc02` e l'inventario completo è stato
registrato in `docs/doflow-release-file-inventory.csv`. I gate statici,
security, lint, test, build e rehearsal pre-179 sono verdi.

L'ultimo `pnpm acceptance:final` è però fallito nel Context A globale: il
workspace è rimasto nel loader di sincronizzazione senza produrre `<main>`
entro 20 secondi. Il Context E è fallito a cascata perché mancava l'evidence
scritta dal primo test. L'evidence RC macchina corrente riporta quindi
correttamente `DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED`.

In applicazione del freeze non sono stati modificati codice, test,
migrazioni, package o runtime config; non sono stati eseguiti staging, commit
o push. Il preflight produzione è inoltre bloccato perché Coolify,
autodeploy, baseline database, CEO reali, Redis/storage e backup non sono
verificabili con gli accessi read-only disponibili.

Dettagli:

- `docs/doflow-release-lock-report.md`;
- `docs/doflow-production-preflight-report.md`.

`DOFLOW RELEASE LOCK BLOCKED`

`DOFLOW PRODUCTION PREFLIGHT BLOCKED`

`PUSH HELD — CONTROLLED CUTOVER REQUIRED`

## Addendum manifest Fase 5B.1A

Il contenuto della RC include ora il contratto esplicito di shell/workspace/
secondary readiness, deduplicazione del provisioning schema, CORS controllato,
Context E autonomo ed evidence finale incrementale. Non sono state aggiunte
migrazioni e restano congelati route canoniche, sette tab progetto, Builder,
login visuale, MFA, capability e stati di dominio.

Il bootstrap workspace è capability-aware per tutte le letture core: una
identità Delivery/Collaboration non invia query lead, clienti, attività o
progetti per bounded context non concessi, mentre un rifiuto server per
un'identità che dichiara la relativa capability resta un errore core
osservabile. Il gate Collaboration isolato di regressione passa 1/1 e il gate
globale verifica readiness del project manager; la sequenza A/B/C/D mirata
passa 1/1 in 34,0 s.

Artefatto macchina canonico:

`.visual-runtime/doflow-rc-stability-result.json`

L'artefatto registra root cause, fingerprint della working tree, timings
prima/dopo, profiling richieste, CORS, Context E autonomo e finale, health,
test/build/audit, visual gate, run 1/run 2 e teardown. Il manifest non
precompila il verdict: l'eleggibilità della RC richiede due run
`pnpm acceptance:final` distinti e consecutivi, da stack vuoto e senza
modifiche intermedie. Questa eleggibilità non autorizza commit, push, deploy o
cutover e non sblocca il preflight produzione.

## Addendum manifest Fase 5B.1C

La RC include ora il percorso production-safe separato per schema e dati:

| Artefatto | Contratto |
| --- | --- |
| `dist/scripts/run-production-migrations.js` | DataSource production compilata, history del manifest 171 e 175–184 (11 file; nessuna 172–174), `DB_SYNC=false`, advisory lock e verifica zero pending |
| `dist/scripts/production-backend-entrypoint.js` | runner prima di NestJS; nessun fallback su failure |
| `dist/scripts/doflow-production-cutover.js` | `status`, `dry-run`, `apply`, `verify` manuali e tenant-only |
| `apps/backend/Dockerfile` | `CMD` Node sul production entrypoint; nessuna dipendenza da `data-source.ts`/tsx/ts-node |
| `scripts/production-startup-acceptance.mjs` | build dell'esatto Dockerfile, baseline 178, restart, concorrenza, failure/retry e cutover sintetico |

L'immagine deve contenere tutte le 11 migrazioni JavaScript del manifest: 171 e
175–184; 172–174 non esistono nella catena corrente. La strategia
transazionale resta `all`, già provata dal true pre-179 rehearsal; il runner
non usa revert/down e rifiuta history sconosciute, duplicate o future.

Il comando riproducibile aggiunto è:

```text
pnpm acceptance:production-startup
```

L'evidence macchina autorevole è:

```text
.visual-runtime/production-migration-runner-result.json
```

Deve attestare image ID/CMD, migration manifest, max 178→184, advisory lock,
secondo container in attesa, restart no-op, app bloccata su fault, retry,
status/dry-run/apply/apply/verify, CEO sintetici preservati, secondo tenant
invariato, reconciliation e teardown senza residui.

L'evidence locale corrente attesta il verdetto
`PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO` per l'immagine
`sha256:831a8a7372598d1f99675a4b77ec20a3f7651198056b894050dd6f66e59152ef`.
Sono verdi max 178→184, restart no-op, lock concorrente, fault con exit 1 e app
bloccata, rollback transazionale di history/fingerprint business e retry. Le
modalità status/dry-run/apply/apply/verify terminano tutte con exit 0; CEO
sintetici e secondo tenant sono invariati, reconciliation passa e il mapper
post-seed mantiene automation rules/versions a 16/16 su entrambi gli apply.

Gate della stessa working tree già registrati: true pre-179 GO; backend 103
suite/1114 test (+8/+38 rispetto alla baseline); frontend runtime 36/36; lint
strict due volte 0 warning; type-check/build backend e frontend verdi; 220
pagine Next; audit dipendenze completo e production 0 vulnerabilità dopo
override `brace-expansion` 1.x 1.1.18; audit final-security, browser-auth e
release-authority PASS. Due `pnpm acceptance:final` consecutivi sulla stessa
fingerprint sono verdi con Context A–E, `SUPERADMIN CONTEXT E GO`,
`GLOBAL VISUAL GO`, 121 screenshot e health 10/10. L'evidence stability è
`DOFLOW RC STABILITY GO`.

Mapper e seed non vengono eseguiti automaticamente all'avvio. Il futuro
cutover dati richiede un comando Node esplicito, conferma letterale e
`backup-ref` non sensibile. I comandi Coolify sono documentati in
`docs/doflow-production-migration-runner.md` e nel runbook RC.

### Addendum pre-cutover Fase 5B.2

Il preflight manuale ha verificato Coolify production, repository/branch,
build Dockerfile, autodeploy via webhook e rollback applicativo. Sono presenti
un backup PostgreSQL custom verificato e uno snapshot MinIO verificato, con
copie off-server e checksum coincidenti. Il backup-ref CLI è
`doflow-prod-precutover-20260825T092025Z`.

L'autorizzazione Fase 5B.2 consente un solo commit release, push non forzato,
autodeploy e cutover CLI controllato. Il runner deve chiudere a max 184/zero
pending prima di `status`, `dry-run`, `apply` e `verify`. Nessuna credenziale è
registrata nel manifest; la rotazione PostgreSQL resta un task post-cutover.
