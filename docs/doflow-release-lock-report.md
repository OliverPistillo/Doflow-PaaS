# Doflow 5B.1 — release lock report

Data verifica: 24 agosto 2026. Perimetro: working tree `C:\Doflow`, tenant
`doflow`, branch `main`. Questo documento registra un tentativo di release
lock; non autorizza deploy, migrazioni o scritture di produzione.

## Esito

`DOFLOW RELEASE LOCK BLOCKED`

La condizione bloccante è il fallimento dell'ultimo comando obbligatorio
`pnpm acceptance:final`. Di conseguenza non sono stati eseguiti staging,
commit o push. Il freeze funzionale è rimasto integro: nessun sorgente, test,
migrazione, package o runtime config è stato corretto durante la Fase 5B.1.

## Base Git e remoto

- branch iniziale: `main`;
- SHA iniziale: `961c7d0d1886742f9330fad81100a2634596cc02`;
- `origin`: `https://github.com/OliverPistillo/Doflow-PaaS.git`;
- `origin/main` dopo `git fetch origin main --prune`: stesso SHA;
- merge-base: stesso SHA;
- ahead/behind: `0/0`;
- staged iniziali: `0`;
- reference Daniele: `master/e6c3ef5920773afc14b3caff88cfe4027400c54b`,
  pulita, ignorata tramite `.git/info/exclude`, assente dall'indice e non
  trasformata in gitlink/submodule.

## Working tree iniziale e inventario

La fotografia prima delle modifiche documentali conteneva 590 path:

- 320 file tracked modificati;
- 3 file tracked eliminati;
- 267 file untracked individuali;
- 0 staged;
- diff tracked: 323 file, 15.002 inserimenti e 10.395 eliminazioni;
- 7.202.025 byte complessivi nei path candidati;
- 590 file testuali, 0 binari, 0 file vuoti, 0 file oltre 1 MiB.

L'inventario definitivo per path è in
`docs/doflow-release-file-inventory.csv`. Registra stato, categoria, motivo,
decisione, rischio, dimensione, tipo e relazione con la RC. Le categorie
coprono frontend, backend, migrazioni, script/orchestratori, test,
configurazione monorepo, lockfile, documentazione, screenshot finali, file
ritirati, runtime, build, log, credenziali acceptance, reference e file
ambigui.

I tre file ritirati sono intenzionali:

- `apps/frontend/src/lib/auth-storage.ts`;
- `apps/frontend/src/lib/safe-action.ts`;
- `apps/frontend/src/middleware.ts`.

Non sono stati trovati merge marker reali, symlink, gitlink, submodule,
repository annidate inattese, file vuoti o file candidati oltre i limiti
GitHub. Nessun path candidato è stato classificato come ambiguo.

## File ed evidence esclusi

Sono esclusi da qualunque commit della fase:

- `.visual-runtime/` e i JSON macchina;
- `.visual-auth/` (vuota al controllo);
- `test-results/`, `playwright-report/`, `.next/`, `dist/` e `node_modules/`;
- `.env`, `apps/backend/.env`, `apps/frontend/.env`, `infra/.env` e gli env
  acceptance ignorati;
- log frontend/backend e runtime config acceptance;
- `doflow-gestionale-reference/`;
- ZIP di reference già ignorati;
- screenshot intermedi, diagnostici o duplicati.

Gli env locali contengono nomi di variabili sensibili e riferimenti operativi,
ma sono già ignorati e non compaiono nei 590 candidati. Nessun valore è stato
stampato o copiato. `.env.example` è l'unico esempio candidato; lo scan finale
ha trovato 0 secret su 1.110 file tracked e 0 environment file tracked.

Un secondo scan ad alta confidenza sui 593 path correnti, inclusi gli
untracked, ha trovato soltanto quattro connection string nei runner isolati.
La verifica senza stampa dei valori conferma host locale, porte acceptance e
marker sintetici in tutti i casi; non sono credenziali reali. Private key,
AWS key, GitHub token, Stripe live secret, Google API key e JWT literal: 0.

## Screenshot

Il set finale `actual/final-rc` contiene 121 PNG sintetici, 14.961.409 byte,
massimo 498.207 byte per file. La documentazione lo richiama come evidence
visuale. Il set è ignorato localmente e, poiché il release gate è fallito, non
è stato forzato nello staging. Gli altri 212 PNG/intermedi sotto `actual/`
restano esclusi. Nessuno screenshot è stato aggiunto all'indice.

## Evidence RC incrociate

Prima del nuovo run, i JSON erano validi e coerenti con
`main/961c7d0d1886742f9330fad81100a2634596cc02`:

- RC storica: `DOFLOW REPLACEMENT RELEASE CANDIDATE GO`;
- lint: `GLOBAL FRONTEND LINT ZERO GO`;
- Nest: `NESTJS 11 SECURITY & COMPATIBILITY GO`;
- migrazioni: `TRUE PRE-179 MIGRATION REHEARSAL GO`;
- visual: `GLOBAL VISUAL GO`;
- health: `10/10`;
- teardown: completo;
- secret-shaped values nei JSON controllati: 0.

L'ultimo `acceptance:final` ha correttamente sovrascritto l'evidence RC con
`DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED`; questa è ora l'evidence
autorevole dell'ultimo run e non va reinterpretata come GO.

## Gate pre-commit

Risultati verdi prima del gate conclusivo:

- install frozen strict: PASS;
- audit production dependencies: 0 vulnerabilità note;
- security/secret audit: PASS, 0 hit;
- browser auth audit: PASS su 755 file;
- authority audit Commercial/Delivery/Commerce/Document/Collaboration/
  Automation: PASS nei bounded context chiusi;
- lint frontend strict run 1: 0 errori, 0 warning;
- lint frontend strict run 2: 0 errori, 0 warning;
- frontend type-check: PASS;
- frontend test mirati: 11/11 PASS;
- backend: 95/95 suite, 1.076/1.076 test PASS;
- backend build: PASS;
- frontend build: PASS, 220 pagine generate;
- rehearsal pre-179 separata: GO, baseline 178, apply 179–184, seconda apply
  senza pending, restore/replay e seed-preservation verdi;
- `git diff --check`: PASS.

## Fallimento del gate conclusivo

`pnpm acceptance:final` ha superato install, audit, backend 95/95,
1.076/1.076 test, due lint strict, type-check, frontend 14/14, build,
rehearsal pre-179, Commercial, Delivery, Commerce & Cash, Document & Revenue,
Collaboration, Automation, web-session e Nest/BullMQ. Le health probe erano
8/10 quando è iniziata l'acceptance globale.

Il Context A globale è rimasto nella schermata
“Sincronizzazione workspace / Caricamento dei dati autorizzati dal server” e
non ha prodotto il primo elemento `<main>` entro 20 secondi durante il gruppo
di route documentali. I log mostrano richieste aggregate progressivamente
lente, fino a circa 7,7 secondi, mentre il workspace caricava più collezioni.
Il secondo test Context E ha completato le proprie verifiche, ma è fallito a
cascata tentando di leggere `final-global-acceptance-result.json`, che il
primo test non aveva creato.

Root cause operativa: gate globale non deterministico sotto carico del
workspace, con timeout di readiness UI. La route esatta non è registrata dal
runner, quindi non viene inventata. La correzione richiederebbe codice/test o
orchestrazione e resta fuori dal freeze 5B.1.

Il teardown dopo il fallimento è completo: porte `3100`, `3401`, `55432`,
`56379`, `59000` chiuse e zero container/network/volumi acceptance residui.

## Manifest e Git finale

Il manifest proposto è salvato in
`.visual-runtime/release-staging-paths.txt`, ma è marcato non autorizzato e
non è stato passato a `git add`. Non esiste staged diff. Il messaggio previsto
resta:

`feat(doflow): complete server-authoritative gestionale replacement`

Commit SHA: non creato. Working tree: intenzionalmente dirty con la RC e i
report di blocco. Push: trattenuto.

## Sblocco richiesto

Una fase successiva deve, fuori dal freeze:

1. rendere deterministica la readiness del workspace/route loop globale;
2. rendere Context E indipendente dall'assenza dell'evidence del Context A o
   serializzare esplicitamente i due test;
3. rieseguire da stack vuoto tutti i gate e `pnpm acceptance:final`;
4. ripetere inventory, staged review e secret scan prima di autorizzare il
   singolo commit.

Nessun reset, clean, stash, restore/checkout globale, pull, merge, rebase,
staging, commit, push, tag o deploy è stato eseguito.

## Fase 5B.1A — remediation del blocker di stabilità

La diagnosi tecnica sopra riportata resta evidenza storica del fallimento
5B.1, ma è ora precisata: la shell dipendeva da un bootstrap monolitico e il
provisioning schema ripetuto per richiesta amplificava i tempi delle query
aggregate sotto cold start. La correzione separa readiness della shell,
workspace essenziale e dati secondari; rende gli errori terminali e ritentabili;
deduplica il provisioning riuscito; corregge il rifiuto CORS locale; rende
Context E autonomo; conserva evidence incrementali e teardown anche dopo un
fallimento intermedio.

Le regressioni mirate sono verdi e i tempi post-fix rispettano il timeout
esistente senza un aumento cieco. Nessuna migrazione è stata aggiunta.

I primi run finali hanno poi esposto un secondo accoppiamento di readiness:
utenti Collaboration/Delivery limitati potevano leggere il progetto assegnato,
ma query lead o attività CRM non autorizzate e non necessarie rigettavano
l'intero bootstrap. Le letture core sono ora capability-aware; i test
mantengono bloccante ogni `403` inatteso per identità abilitate. Il gate
Collaboration isolato passa nuovamente 1/1 con teardown completo e il Context
globale attende esplicitamente il marker workspace del project manager; la
sequenza mirata completa fino ad A/B/C/D passa 1/1 in 34,0 s.

Il gate è stato successivamente chiuso: l'evidence
`.visual-runtime/doflow-rc-stability-result.json` registra due
`pnpm acceptance:final` consecutivi, completi e verdi sulla stessa working
tree, fingerprint
`85cf6a8dfe1ebfa83f4129fd574826af836a59fcc0a73b9fc00b2d9f1457d288`.
Il verdetto corrente è `DOFLOW RC STABILITY GO`.

## Fase 5B.1C — migration runner e cutover CLI

La working tree contiene ora un percorso testabile nell'immagine backend:

- manifest di 11 migrazioni TypeORM JavaScript, 171 e 175–184 (nessuna
  172–174), prima di NestJS;
- `DB_SYNC=true` e configuration/history incompatibili rifiutati;
- advisory lock PostgreSQL con timeout e rilascio in `finally`;
- restart a zero pending come no-op;
- CLI manuale `status`, `dry-run`, `apply`, `verify` per il solo tenant
  `doflow`;
- conferma letterale e backup-ref obbligatori per apply;
- doppio mapper/seed, CEO preservation, secondo tenant e reconciliation;
- acceptance dell'esatto Dockerfile con cleanup selettivo.

Il comando locale è `pnpm acceptance:production-startup`; il suo risultato
macchina è `.visual-runtime/production-migration-runner-result.json`. Il gate
deve restare `BLOCKED` se l'immagine non contiene gli script/migration attesi,
il secondo container non osserva il lock, NestJS parte dopo una migration
fallita, il retry non è possibile, il cutover non è idempotente o il teardown
lascia residui.

Il run locale reale da stack vuoto ha ora prodotto
`PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO` sull'immagine
`sha256:831a8a7372598d1f99675a4b77ec20a3f7651198056b894050dd6f66e59152ef`.
Sono stati osservati max 178→184, restart no-op, coordinamento concorrente,
fault exit 1 con NestJS non avviato e rollback di history/fingerprint business,
quindi retry riuscito. Status, dry-run, apply, secondo apply e verify sono tutti
exit 0; CEO sintetici e secondo tenant restano invariati, reconciliation passa
e il pass mapper post-seed mantiene automation rules/versions a 16/16 in
entrambi gli apply.

La suite backend è salita in modo spiegato a 103 suite/1114 test (+8/+38), il
frontend runtime passa 36/36, lint strict passa due volte con zero warning,
type-check e build passano e Next produce 220 pagine. True pre-179 rehearsal e
audit final-security/browser-auth/release-authority passano. Gli audit
dipendenze completo e production riportano zero vulnerabilità dopo l'override
`brace-expansion` 1.x a 1.1.18. Il gate globale `pnpm acceptance:final` è stato
eseguito due volte sulla stessa fingerprint: Context A–E, Context E autonomo,
121 screenshot, visual gate e health 10/10 sono verdi.

La precedente dicitura “migration hook non verificabile” viene precisata:
l'hook compilato e l'immagine possono essere verificati localmente, mentre la
configurazione Coolify reale e la strategia di sostituzione del vecchio
container richiedono comunque osservazione durante il deploy.

## Fase 5B.2 — pre-cutover production verificato

Il gate operativo del 25 agosto 2026 ha verificato prima dello staging:

- backup PostgreSQL custom
  `doflow-prod-precutover-20260825T092025Z.dump`, 28.304.651 byte,
  `pg_restore --list` exit 0 e SHA-256
  `4EB7B3EBDF684B4FCC55D4F582536D49301C2B9CEF00067F367D75D8DD0E891A`;
- backup-ref non sensibile
  `doflow-prod-precutover-20260825T092025Z`;
- snapshot MinIO
  `doflow-minio-precutover-20260825T092353Z.tar.gz`, 13.819.881 byte,
  archive check exit 0 e SHA-256
  `608261051E58839AC421231977A65F0FC3919F3742FEF21FFF2D6778DDD65D58`;
- copie off-server locali con checksum identici, escluse da Git tramite
  `.git/info/exclude`;
- backend/frontend, PostgreSQL, Redis e MinIO production osservati running;
- repository Coolify `OliverPistillo/Doflow-PaaS`, branch `main`, build
  Dockerfile, autodeploy via webhook sul push e rollback applicativo presente.

Il push deve restare fail-closed fino alla staged review e all'ultimo fetch.
Non è stato eseguito SQL manuale e `DB_SYNC=true` resta vietato. La credenziale
PostgreSQL accidentalmente esposta durante il preflight non è riportata; la
rotazione è un task post-cutover separato.
