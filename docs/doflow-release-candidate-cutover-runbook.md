# Doflow replacement — runbook di cutover

Stato: **RC validata in isolamento; cutover non eseguito e subordinato ad
autorizzazione separata, artefatto immutabile e preflight produzione**.

Questo runbook descrive una procedura conservativa. Non contiene segreti e non
è stato eseguito su produzione. Il tenant interessato è esclusivamente
`doflow`; il Client Portal resta escluso e il Builder deve essere preservato.

## Identificazione della release

- repository: `OliverPistillo/Doflow-PaaS`;
- branch previsto: `main`;
- SHA base della working tree verificata: `961c7d0d1886742f9330fad81100a2634596cc02`;
- SHA RC: da valorizzare con un commit immutabile autorizzato che contenga
  esattamente la working tree validata in Fase 5A.5;
- reference visuale/funzionale read-only:
  `doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b`.

Non usare una working tree dirty come artefatto di deploy. Verificare che lo
SHA approvato contenga esattamente il manifest validato.

## Prerequisiti e ruoli

- approvazione esplicita al cutover e finestra di manutenzione;
- owner dell’applicazione, owner PostgreSQL, owner storage e referente Coolify;
- backup operator separato dal deploy operator;
- accesso in sola lettura ai log e alle metriche;
- spazio sufficiente per due backup PostgreSQL e uno storage snapshot;
- procedura di ripristino provata su ambiente isolato;
- provider esterni mantenuti disabilitati finché le relative chiavi non sono
  state approvate e testate;
- inventario verificato degli account canonici Oliver e Daniele senza
  esportare password, OAuth ID, MFA secret o sessioni.

## Variabili ambiente richieste

Confrontare solo i nomi, mai i valori, con il secret manager:

- `NODE_ENV`
- `DATABASE_URL`
- `DB_SYNC`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `FRONTEND_URL`
- `APP_BASE_URL`
- `PUBLIC_API_URL`
- `INTERNAL_BACKEND_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `CORS_ORIGINS`
- `AWS_ENDPOINT`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

`DB_SYNC` deve essere `false`. Le variabili provider non approvate devono
restare assenti o puntare a adapter esplicitamente disabilitati; non usare
l’adapter sintetico acceptance in produzione.

## Preflight GO/NO-GO

1. Verificare SHA, firma/provenienza dell’artefatto e manifest.
2. Eseguire installazione frozen, test globali, `pnpm lint:frontend:strict`
   due volte, build, audit dipendenze e acceptance isolata sullo stesso SHA.
3. Verificare che `pnpm audit:release-candidate` termini `PASS`.
4. Verificare visual gate globale autenticato e automatico.
5. Verificare zero route Client Portal e presenza Builder.
6. Verificare capacità e redazione finance lato backend.
7. Verificare che le porte e le risorse acceptance siano state rimosse.
8. Registrare lo stato di Coolify senza avviare deploy.

Qualunque failure è `NO-GO`. Non correggere direttamente in produzione.

## Backup conservativo

### PostgreSQL

1. Mettere l’applicazione in modalità di manutenzione o bloccare le mutazioni
   applicative in modo reversibile.
2. Registrare timestamp, versione PostgreSQL e SHA applicativo.
3. Eseguire un backup logico completo in formato custom con privilegi,
   ownership e schema inclusi.
4. Calcolare checksum e conservare il backup su storage separato.
5. Verificare il catalogo con `pg_restore --list`.
6. Ripristinare il backup in un database temporaneo non produttivo e svolgere
   almeno reconciliation di tenant, utenti, aziende, progetti, ordini,
   pagamenti, documenti e audit.

Non usare `DROP`, `TRUNCATE`, reset o restore sovrapposto al database attivo.

### Storage

1. Congelare o versionare il bucket applicativo.
2. Acquisire snapshot/version inventory di oggetti e metadata.
3. Registrare conteggi e checksum campionati per tenant/prefix.
4. Verificare che i prefix Doflow e degli altri tenant restino distinti.
5. Conservare lo snapshot fuori dal dominio di failure primario.

### Redis e code

Redis non è fonte autorevole business, ma prima del cutover verificare:

- salute, memoria e persistenza configurata;
- sessioni opache e policy di invalidazione prevista;
- code BullMQ, job active/waiting/delayed/failed;
- outbox persistente e assenza di backlog non spiegato;
- worker e scheduler fermabili senza perdere record PostgreSQL.

Non ripristinare sessioni opache da un ambiente a un altro.

## Ordine di migrazione

1. `1714752000000-InitialPublicSchema`
2. `1750000000000-CreateTenantRegistry`
3. `1760000000000-AddGoogleOAuthUsers`
4. `1770000000000-CreatePlatformAccessCatalog`
5. `1780000000000-CreateBackupSchedules`
6. `1790000000000-CreateCommercialCoreAuthority`
7. `1800000000000-CreateDeliveryCoreAuthority`
8. `1810000000000-CreateCommerceCashCoreAuthority`
9. `1820000000000-CreateDocumentRevenueCoreAuthority`
10. `1830000000000-CreateCollaborationNotificationsRealtimeAuthority`
11. `1840000000000-CreateAutomationPerformanceAuthority`

Prima di `apply` eseguire i mapper in dry-run sul solo tenant `doflow`, salvare
conteggi e ambiguità e ottenere approvazione. L’apply deve essere esplicito.
Ripetere migrazioni, mapper e seed in rehearsal; il secondo passaggio deve
essere idempotente.

### Rehearsal pre-179 obbligatoria

Prima di autorizzare qualunque cutover eseguire sullo SHA candidato:

```text
pnpm acceptance:migration-pre179
```

Il gate crea database locali separati, applica soltanto `171–178`, verifica
l'assenza strutturale di authority `179+`, carica la fixture legacy congelata,
esegue backup custom verificato, migrazioni `179–184`, mapper dry/apply/apply,
doppio seed, reconciliation, replay dal backup pre, restore del backup post,
fault/rollback e smoke backend con `DB_SYNC=false`.

Mapper espliciti: Delivery, Commerce, Collaboration e
Automation/Performance. Commercial e Document/Revenue non richiedono un
mapper distruttivo: le relative migrazioni sono additive e i record legacy
sono riconciliati per UUID e relazioni. Gli stati univoci possono essere
normalizzati; gli stati fase-like come `kickoff` devono restare ambigui e
richiedere decisione, non un mapping inventato.

Stop immediato se: baseline max diversa da `178`, artifact authority presente
prima del backup, dump non verificabile, checksum CEO inatteso, dry-run
mutativo, duplicazione al secondo apply/seed, differenza replay, dato
cross-tenant, somma economica divergente, pending migration sul restore,
rollback parziale o teardown incompleto.

Rollback della rehearsal: non usare `migration:revert`; distruggere soltanto
le risorse acceptance dedicate. Nel cutover reale, in caso di stop, congelare
le mutazioni e ripristinare il backup pre in un database nuovo secondo la
procedura conservativa sottostante.

## Seed policy e preservazione CEO

- Nessun seed deve sovrascrivere record modificati o credenziali.
- Il seed Doflow deve essere idempotente e tenant-scoped.
- Prima del cutover acquisire checksum redatti di UUID, password hash, provider
  OAuth, Google ID, MFA enabled/secret, email verification, avatar, preferenze,
  membership e riferimenti degli account canonici.
- Dopo ogni migrazione, mapping e seed confrontare i checksum.
- Confermare ruolo tecnico `owner`, `is_active=true`, capability complete,
  membership team e mirror `public.users` coerente.
- Se un checksum cambia fuori dalle trasformazioni approvate: fermarsi e
  ripristinare; non correggere manualmente le credenziali.

## Baseline NestJS 11 e rollback applicativo

Il backend RC richiede Node `20.19.6`, Nest core/platform/testing `11.1.18`,
Swagger `11.4.6`, Serve Static `5.0.3`, Express `5.2.1` e
`reflect-metadata 0.2.2`. Prima di autorizzare un cutover eseguire:

```text
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm audit --prod
pnpm --filter backend build
pnpm acceptance:nest11
```

Il gate deve riportare zero advisory, zero peer incompatibili e tutti i test
Playwright configurati verdi (2/2 nel run RC Fase 5A.5). I route matcher
middleware canonici usano wildcard Express 5
nominati (`{*splat}`); non reintrodurre `forRoutes('*')` o `(.*)`. Il webhook
billing deve restare escluso da auth/tenancy e conservare il raw body.

L'upgrade non modifica schema o dati. Se una regressione applicativa emerge
prima del deploy, ripristinare manifest e lockfile dell'ultimo SHA approvato e
ricostruire backend/frontend; non eseguire migration revert. Se emerge dopo un
deploy autorizzato, congelare le mutazioni, riportare insieme backend e worker
alla build precedente compatibile e mantenere PostgreSQL invariato. Non
effettuare rollback parziali di soli package Nest.

Dettaglio tecnico ed evidence: `docs/doflow-nest11-security-compatibility.md`
e `.visual-runtime/nest11-upgrade-result.json`.

## Baseline RC verificata in Fase 5A.5

Il 24 agosto 2026 `pnpm acceptance:final` ha prodotto il verdetto
`DOFLOW REPLACEMENT RELEASE CANDIDATE GO` esclusivamente sullo stack locale
isolato. Baseline da riconfermare sul futuro SHA immutabile:

- backend 95/95 suite e 1076/1076 test;
- frontend 14/14 test, due lint strict 0/0, type-check e build 220 pagine;
- Context A–E, 143 operazioni, idempotenza e concorrenza verdi;
- `SUPERADMIN CONTEXT E GO` e `GLOBAL VISUAL GO`;
- 121 screenshot, 118 controlli accessibilità, zero console warning/error e
  zero `5xx` inattesi nel visual gate;
- migrazione massima `1840000000000`, secondo run senza pending;
- true pre-179 replay/backup/restore e preservazione CEO sintetica verdi;
- dependency/security audit a zero vulnerabilità;
- 10/10 health probe;
- porte `3100`, `3401`, `55432`, `56379`, `59000` chiuse e zero risorse
  Docker acceptance dopo il teardown.

Questi risultati non sostituiscono la verifica dell'infrastruttura reale. Non
riutilizzare credenziali, seed, storage state o adapter sintetici acceptance
nel cutover.

## Deploy applicativo (solo dopo autorizzazione separata)

1. Pubblicare immagini backend/frontend dallo stesso SHA RC.
2. Avviare il nuovo container backend con `DB_SYNC=false`: l'entrypoint
   compilato acquisisce l'advisory lock, applica le sole migrazioni TypeORM
   pending, verifica zero pending e importa NestJS. Un errore deve lasciare il
   nuovo container failed.
3. Verificare health e migration max `184` prima di ogni azione dati.
4. Eseguire dalla shell del container prima `status`, poi `dry-run`; ottenere
   l'approvazione sull'evidence redatta.
5. Eseguire manualmente la CLI `apply` con conferma e backup-ref, quindi
   `verify`. Mapper e seed non sono parte dello startup automatico.
6. Avviare worker e scheduler; verificare health prima del frontend.
7. Avviare frontend e verificare rewrite API/WebSocket.
8. Invalidare soltanto le sessioni previste dal piano; documentare l’impatto.
9. Non abilitare provider esterni durante il cutover iniziale.

Comandi, interlock, expected output e troubleshooting sono definiti in
`docs/doflow-production-migration-runner.md`. Non eseguire SQL manuale per
sostituire la CLI.

## Smoke, visual e reconciliation

- `/api/health/system`, PostgreSQL, Redis, storage, BullMQ, worker, scheduler,
  outbox e WebSocket verdi;
- login password, MFA, logout, forgot/reset e sessione opaca;
- owner, utente limitato, secondo tenant e Superadmin;
- dashboard, Commercial, sette tab progetto, Commerce, Documenti, Notifiche,
  Automazioni/Performance e Builder;
- route legacy verso destinazioni canoniche e Client Portal assente;
- confronto light/dark desktop e mobile senza PII negli screenshot;
- reconciliation conteggi/UUID/relazioni/importi prima e dopo;
- nessun job duplicato, nessun outbox bloccato, nessun leak cross-tenant.

## Rollback

### Applicativo

Se lo schema resta backward-compatible, riportare frontend/backend all’ultimo
SHA approvato, mantenendo il database e disabilitando le mutazioni durante la
transizione. Non eseguire `migration:revert` automaticamente.

### Database

Se la compatibilità non è garantita:

1. fermare le mutazioni;
2. conservare un ulteriore backup dello stato fallito;
3. creare un database nuovo dal backup pre-cutover;
4. riconciliare il restore;
5. cambiare il puntamento applicativo in modo atomico;
6. mantenere entrambi i database finché l’incidente non è chiuso.

Mai ripristinare in-place con cancellazioni massive. Storage e database devono
essere riportati a checkpoint coerenti.

## Procedura di arresto sicuro

In caso di dubbio: bloccare nuove mutazioni, lasciare intatti backup e database,
fermare worker/scheduler dopo aver registrato i job, non rilanciare mapper o
seed alla cieca, raccogliere correlation ID e dichiarare `NO-GO`. La priorità è
preservare dati, account e audit, non completare la finestra a ogni costo.

## Monitoraggio post-cutover

Per almeno una finestra operativa monitorare error rate, latenza, saturazione
PostgreSQL/Redis, code BullMQ, outbox, WebSocket reconnect, auth failure/rate
limit, upload/storage, mismatch di capability, errori cross-tenant e log privi
di segreti. Definire soglie di rollback prima del deploy.

## Gate aggiuntivi dopo il preflight 5B.1 bloccato

Il tentativo 5B.1 del 24 agosto 2026 non ha creato il commit release. Prima di
riaprire il cutover sono obbligatori entrambi i seguenti gate:

1. `pnpm acceptance:final` deve completare da stack vuoto senza timeout del
   loader “Sincronizzazione workspace”; il Context E non può dipendere da un
   file evidence non scritto da un test parallelo/fallito;
2. il preflight produzione deve rendere verificabili Coolify/autodeploy,
   migration hook, baseline PostgreSQL, CEO reali, Redis, storage, backup
   recente e restore test.

Non usare il GO storico della Fase 5A.5 per superare il fallimento successivo:
l'ultimo JSON RC è autorevole. Non eseguire push finché non è dimostrato che
nessun deploy o migration hook possa partire da `origin/main`.

Il container locale `doflow-nginx` osservato in restart loop non deve essere
modificato durante il cutover. Prima dell'autorizzazione serve prova del
percorso origine Cloudflare/Tunnel e della sua irrilevanza rispetto allo stack
reale.

## Fase 5B.1C — startup schema automatico e cutover dati controllato

L'immagine backend contiene ora tre entrypoint JavaScript compilati:

```text
apps/backend/dist/scripts/run-production-migrations.js
apps/backend/dist/scripts/production-backend-entrypoint.js
apps/backend/dist/scripts/doflow-production-cutover.js
```

Il comando container esegue il production backend entrypoint. Questo runner
è fail-closed, usa la migration table `public.doflow_migrations`, transazione
TypeORM `all` e advisory lock PostgreSQL namespaced. La history deve essere un
prefisso esatto del manifest a 11 file 171 e 175–184 (172–174 non esistono);
migration sconosciute/future, file compilati
mancanti, `DB_SYNC=true`, lock timeout e pending post-run bloccano NestJS.

Un restart a max 184 è un no-op. Due container possono attendere lo stesso
lock senza duplicare la history. Nessun mapper o seed viene avviato dal
container startup.

### Sequenza manuale nel terminale Coolify

Soltanto dopo backup verificato, preflight GO e autorizzazione separata:

```sh
node apps/backend/dist/scripts/doflow-production-cutover.js status
node apps/backend/dist/scripts/doflow-production-cutover.js dry-run --tenant=doflow
node apps/backend/dist/scripts/doflow-production-cutover.js apply \
  --tenant=doflow \
  --confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER \
  --backup-ref=<BACKUP_ID_VERIFICATO>
node apps/backend/dist/scripts/doflow-production-cutover.js verify --tenant=doflow
```

`apply` usa un lock separato, esegue due pass mapper e due pass seed, confronta
CEO e secondo tenant e termina con reconciliation. Il solo target accettato è
`doflow`; `federicanerone` e ogni altro tenant sono rifiutati.

Il gate locale riproducibile è:

```text
pnpm acceptance:production-startup
```

Costruisce l'esatto Dockerfile backend e registra evidence atomica in
`.visual-runtime/production-migration-runner-result.json`. Il dettaglio
operativo è in `docs/doflow-production-migration-runner.md`.

L'ultimo run locale da stack vuoto è verde con verdetto
`PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO` sull'immagine
`sha256:831a8a7372598d1f99675a4b77ec20a3f7651198056b894050dd6f66e59152ef`.
Ha verificato max 178→184, restart no-op, startup concorrente sotto advisory
lock, fault con exit 1/NestJS bloccato/history e dati business transazionali
invariati, retry riuscito, e l'intera sequenza cutover
status/dry-run/apply/apply/verify con exit 0. I CEO sintetici sono preservati,
il secondo tenant è invariato e la reconciliation passa. Il mapper post-seed
stabilizza automation rules/versions a 16/16 sia al primo sia al secondo apply.

I gate già conclusi comprendono pre-179 GO, backend 103 suite/1114 test,
frontend runtime 36/36, lint strict due volte a zero warning, type-check e build
verdi, build Next 220 pagine e audit dipendenze completo/production a zero
vulnerabilità dopo l'override `brace-expansion` 1.x a 1.1.18; audit security,
browser auth e release authority sono verdi. Due gate globali consecutivi
sulla stessa fingerprint sono verdi con Context A–E, Context E autonomo,
`GLOBAL VISUAL GO` e health 10/10.

### Pre-cutover production Fase 5B.2

Backup PostgreSQL verificato:

```text
/home/opistillo/doflow-backups/doflow-prod-precutover-20260825T092025Z.dump
backup-ref: doflow-prod-precutover-20260825T092025Z
SHA-256: 4EB7B3EBDF684B4FCC55D4F582536D49301C2B9CEF00067F367D75D8DD0E891A
```

Snapshot MinIO verificato:

```text
/home/opistillo/doflow-backups/doflow-minio-precutover-20260825T092353Z.tar.gz
SHA-256: 608261051E58839AC421231977A65F0FC3919F3742FEF21FFF2D6778DDD65D58
```

Entrambi hanno una copia off-server locale con checksum identico. I file sono
esclusi dallo staging. Coolify è configurato su repository
`OliverPistillo/Doflow-PaaS`, branch `main`, build Dockerfile; il push attiva
l'autodeploy via webhook e non va accompagnato da un deploy manuale. Il
rollback applicativo verso deployment precedenti è disponibile.

La password PostgreSQL osservata accidentalmente durante il preflight non deve
essere riportata o ruotata durante il cutover. La rotazione coordinata resta un
task di sicurezza post-cutover.
