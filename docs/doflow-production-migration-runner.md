# Doflow — production migration runner e cutover CLI

Stato: **production image acceptance locale della Fase 5B.1C verde con verdetto
`PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO`; due gate globali finali
consecutivi e `DOFLOW RC STABILITY GO`**.
Il pre-cutover Fase 5B.2 dispone di backup PostgreSQL e MinIO verificati,
copie off-server e autodeploy Coolify controllato dal push su `main`.

## Separazione delle responsabilità

Il container backend contiene due flussi distinti:

1. lo startup production esegue automaticamente e soltanto le migrazioni
   TypeORM pending, poi importa NestJS;
2. il cutover dei dati del tenant `doflow` è una CLI manuale. Non viene mai
   invocata dall'entrypoint, da un restart, da un health check o da Coolify.

Il flusso automatico è:

```text
container start
  -> validazione fail-closed
  -> advisory lock PostgreSQL
  -> migration history check
  -> TypeORM migrations pending
  -> zero-pending check
  -> unlock
  -> NestJS
```

Se una fase precedente a NestJS fallisce, il processo termina con exit code
nonzero. Non esiste un fallback che trasformi l'errore in successo.

## Artefatti compilati

Nell'immagine backend sono richiesti:

```text
apps/backend/dist/scripts/run-production-migrations.js
apps/backend/dist/scripts/production-backend-entrypoint.js
apps/backend/dist/scripts/doflow-production-cutover.js
apps/backend/dist/migrations/1714752000000-InitialPublicSchema.js
apps/backend/dist/migrations/1750000000000-CreateTenantRegistry.js
apps/backend/dist/migrations/1760000000000-AddGoogleOAuthUsers.js
apps/backend/dist/migrations/1770000000000-CreatePlatformAccessCatalog.js
apps/backend/dist/migrations/1780000000000-CreateBackupSchedules.js
apps/backend/dist/migrations/1790000000000-CreateCommercialCoreAuthority.js
apps/backend/dist/migrations/1800000000000-CreateDeliveryCoreAuthority.js
apps/backend/dist/migrations/1810000000000-CreateCommerceCashCoreAuthority.js
apps/backend/dist/migrations/1820000000000-CreateDocumentRevenueCoreAuthority.js
apps/backend/dist/migrations/1830000000000-CreateCollaborationNotificationsRealtimeAuthority.js
apps/backend/dist/migrations/1840000000000-CreateAutomationPerformanceAuthority.js
apps/backend/dist/migrations/1850000000000-CreateUniversalTenantFeatures.js
```

Il runtime usa Node sui file JavaScript compilati. Non dipende da
`data-source.ts`, `tsx`, `ts-node` o sorgenti TypeScript.

## DataSource e strategia transazionale

Il runner legge `DATABASE_URL`, usa PostgreSQL,
`migrationsTableName: "doflow_migrations"`, migrazioni JavaScript da
`dist/migrations`, `synchronize: false` e transazione TypeORM `all`. Il manifest
compilato contiene esattamente 12 file: 171 e 175–185; 172–174 non esistono
nella catena corrente e non vengono sintetizzate.

La strategia `all` è la stessa già provata dal true pre-179 rehearsal. Le
migrazioni del manifest 171, 175–185 non usano `CREATE INDEX CONCURRENTLY`, transaction opt-out
o `BEGIN`/`COMMIT` manuali. Il runner non invoca mai `down`, revert o history
finta.

## Validazione fail-closed

Il backend non parte quando si verifica almeno una delle seguenti condizioni:

- `DATABASE_URL` assente, non parsabile o non raggiungibile;
- `DB_SYNC=true`, senza distinzione tra maiuscole e minuscole;
- uno dei 12 file JavaScript attesi 171, 175–185 assente;
- tabella `public.doflow_migrations` incompatibile;
- history non prefisso della catena compilata, record sconosciuto, duplicato
  o migration futura;
- advisory lock non acquisito entro il timeout;
- migration pending fallita;
- verifica post-run con migration ancora pending o max diversa da 185.

I log mostrano soltanto run ID, ambiente, classificazione del database, nomi
migration, conteggi, durata ed exit code. URL completo, username, password,
token, cookie e dati CEO non devono essere stampati.

## Advisory lock

Il runner usa una coppia di chiavi PostgreSQL stabile e namespaced Doflow:

```text
(-1594877102, -962476012)
```

La stessa connessione mantiene il lock aperto per tutta la verifica e
l'esecuzione. L'acquisizione usa retry/backoff finito; il default è 60 secondi
e può essere configurato con:

```text
DOFLOW_MIGRATION_LOCK_TIMEOUT_MS
DOFLOW_MIGRATION_LOCK_RETRY_MS
```

L'unlock e la chiusura di QueryRunner/DataSource sono nel percorso `finally`.
Un timeout produce exit nonzero. Il secondo container attende, poi verifica
che non restino pending e avvia NestJS in no-op.

## Restart

Con migration max 185 e zero pending, il runner registra `status=no-op`,
rilascia il lock e importa NestJS. Non riesegue mapper, seed, reconciliation o
cutover; non duplica schema o dati.

## Comportamento atteso in Coolify

Il `CMD` dell'immagine è:

```text
node apps/backend/dist/scripts/production-backend-entrypoint.js
```

Il processo Node esegue il runner prima di caricare `dist/main.js`. Se il
runner termina nonzero, il nuovo container non può diventare healthy. La
politica Coolify che conserva il container precedente finché il nuovo non è
sano deve essere verificata nel preflight infrastrutturale: non è stata
modificata o provata contro produzione in questa fase.

Automaticamente vengono eseguite **solo le migrazioni schema**. Non partono
automaticamente:

- mapper legacy;
- seed Doflow;
- cutover dati;
- riconciliazione one-shot;
- provider o job esterni.

## CLI cutover Doflow

La CLI ammette quattro modalità. Senza modalità usa `dry-run`.

### Status

Sola lettura: ambiente, `DB_SYNC`, history/pending, presenza tenant e schema,
stato mapper/seed, CEO in forma booleana, conteggi aggregati e readiness.

### Dry-run

Sola lettura: richiede il solo tenant `doflow`, migration max 185 e zero
pending; valuta mapper, seed impact, ambiguità e reconciliation prevista senza
scritture.

### Apply

È un'operazione esplicita sotto un advisory lock cutover distinto. Richiede
contemporaneamente:

- `--tenant=doflow`;
- `--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER`;
- `--backup-ref=<identificatore-non-sensibile>`;
- `NODE_ENV=production` nel futuro container Coolify;
- `DB_SYNC` diverso da `true`;
- migration max 185 e zero pending.

Esegue mapper pass 1 e 2, seed pass 1 e 2, reconciliation e confronto CEO/
secondo tenant. `federicanerone` e ogni tenant diverso da `doflow` sono
rifiutati.

### Verify

Sola lettura: history, mapper/seed, CEO, conteggi, relazioni, somme,
duplicazioni, registry, tenant isolation e reconciliation.

## Comandi Coolify esatti

Eseguire questi comandi **soltanto dopo** deploy autorizzato, backup verificato
e preflight produzione GO. Le variabili applicative devono essere già
disponibili nel container; non inserire credenziali nella riga di comando.

### Shell Linux del container

```sh
node apps/backend/dist/scripts/doflow-production-cutover.js status

node apps/backend/dist/scripts/doflow-production-cutover.js dry-run \
  --tenant=doflow

node apps/backend/dist/scripts/doflow-production-cutover.js apply \
  --tenant=doflow \
  --confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER \
  --backup-ref=<BACKUP_ID_VERIFICATO>

node apps/backend/dist/scripts/doflow-production-cutover.js verify \
  --tenant=doflow
```

### PowerShell

```powershell
node apps/backend/dist/scripts/doflow-production-cutover.js status

node apps/backend/dist/scripts/doflow-production-cutover.js dry-run `
  --tenant=doflow

node apps/backend/dist/scripts/doflow-production-cutover.js apply `
  --tenant=doflow `
  --confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER `
  --backup-ref=<BACKUP_ID_VERIFICATO>

node apps/backend/dist/scripts/doflow-production-cutover.js verify `
  --tenant=doflow
```

Il `backup-ref` è un ID non sensibile del backup già verificato, non un path,
una password o il contenuto del backup.

## Expected output

I comandi producono un report JSON redatto e un exit code coerente:

- `status`/`dry-run`/`verify`: exit `0` soltanto se le verifiche richieste
  terminano correttamente;
- `apply`: exit `0` soltanto dopo mapper/seed idempotenti, CEO preservati,
  secondo tenant invariato e reconciliation PASS;
- errore di configurazione, lock, history, mapper, seed, CEO o reconciliation:
  exit diverso da zero e verdict `BLOCKED`.

Non copiare l'intero output in sistemi non autorizzati. Conservare il report
redatto con correlation/run ID e backup-ref non sensibile.

## Preservazione CEO

Prima e dopo apply vengono confrontati in memoria UUID, checksum password,
provider, checksum Google ID, MFA enabled/checksum secret, email verified,
checksum avatar, preferenze, tenant, ruolo, membership, mirror public e
riferimenti. Il report espone soltanto booleani e fingerprint abbreviati non
reversibili. Qualunque variazione critica rende apply `BLOCKED`; non viene
tentata una correzione automatica.

## Backup e rollback

Prima di apply è obbligatorio un backup PostgreSQL custom verificato con
restore su database separato, oltre allo snapshot storage previsto dal
runbook RC.

Se falliscono le migrazioni automatiche:

1. il nuovo container resta failed;
2. non eseguire `migration:revert`;
3. conservare log redatti e correlation ID;
4. correggere il problema su un nuovo artefatto o riprovare soltanto quando la
   history è dimostrata coerente.

Se fallisce il cutover dati:

1. fermare le mutazioni;
2. non rilanciare mapper/seed alla cieca;
3. conservare un backup dello stato fallito;
4. ripristinare il backup pre-cutover in un database nuovo;
5. riconciliare e cambiare puntamento in modo atomico dopo autorizzazione.

Mai usare restore in-place, `DROP`, `TRUNCATE`, reset, history finta o SQL
manuale copiato nel terminale production.

## Acceptance locale

Il comando riproducibile è:

```text
pnpm acceptance:production-startup
```

Costruisce l'esatto `apps/backend/Dockerfile` e verifica da stack vuoto:

1. baseline sintetica 178, startup 179–185 e health;
2. restart no-op;
3. due container sullo stesso database e advisory lock;
4. fault tramite schema acceptance dal nome invalido, app non avviata e retry
   dopo rename conservativo dello schema sintetico;
5. status, dry-run, apply, secondo apply e verify dentro l'immagine;
6. CEO sintetici, secondo tenant, reconciliation e image inspection;
7. teardown selettivo senza residui.

### Risultato acceptance locale

L'ultimo run da stack vuoto ha prodotto il verdetto:

```text
PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO
```

L'immagine verificata è
`sha256:831a8a7372598d1f99675a4b77ec20a3f7651198056b894050dd6f66e59152ef`.
L'image inspection ha trovato gli 11 artefatti migration compilati 171 e
175–184, gli entrypoint Node attesi e nessuna dipendenza runtime da
`data-source.ts`, `ts-node` o sorgenti TypeScript.

Le prove hanno attestato:

- migration max 178→184 e zero pending;
- restart a max 184 realmente no-op;
- due startup concorrenti coordinati dall'advisory lock senza righe history
  duplicate;
- fault sintetico con exit 1, NestJS/porta backend non avviati, history e
  fingerprint business ripristinati dalla transazione `all`, lock rilasciato e
  retry successivo fino a 184;
- `status`, `dry-run`, primo `apply`, secondo `apply` e `verify` tutti con exit
  0 nell'immagine production;
- CEO sintetici preservati, secondo tenant invariato e reconciliation PASS;
- pass mapper post-seed che rende stabile il rapporto automation
  rules/versions a 16/16 già al primo apply e ancora 16/16 al secondo, chiudendo
  l'iniziale scarto di idempotenza tra seed e mapper;
- teardown selettivo completo.

I gate permanenti completati sulla stessa working tree sono: true pre-179
rehearsal GO; backend 103/103 suite e 1114/1114 test (baseline +8 suite/+38
test); frontend runtime 36/36; type-check e build backend/frontend verdi;
Next.js con 220 pagine; lint frontend strict eseguito due volte con 0 warning;
audit dipendenze production e completo a 0 vulnerabilità dopo l'override
`brace-expansion` 1.x a 1.1.18; audit security finale, browser-auth e release
authority verdi.

Il gate globale è stato ripetuto due volte sulla stessa fingerprint ed è verde:
Context A–E, Context E autonomo, `GLOBAL VISUAL GO`, 121 screenshot e health
10/10. L'evidence corrente dichiara `DOFLOW RC STABILITY GO`.

### Pre-cutover production Fase 5B.2

Il backup PostgreSQL custom verificato usa il backup-ref non sensibile
`doflow-prod-precutover-20260825T092025Z`; `pg_restore --list`, checksum locale
e copia off-server sono verdi. Anche lo snapshot MinIO ha archive check e
checksum off-server verdi. Nessuno dei due artefatti è versionabile.

Coolify usa repository `OliverPistillo/Doflow-PaaS`, branch `main` e build
Dockerfile. Il push su `origin/main` attiva l'autodeploy; non deve essere
avviato un secondo deploy manuale. Deployment precedenti sono disponibili per
rollback applicativo.

Evidence ignorata da Git:

```text
.visual-runtime/production-migration-runner-result.json
```

L'acceptance usa esclusivamente PostgreSQL/Redis/MinIO sintetici e non tocca
produzione, account CEO reali, reference o `doflow-nginx`.

## Troubleshooting

- `DATABASE_URL missing/invalid`: correggere il secret/config del nuovo
  container; non avviare NestJS manualmente.
- `DB_SYNC=true`: impostare `false`; non usare synchronize per superare il
  gate.
- `unknown/future migration`: fermarsi e confrontare artefatto, history e
  backup; non inserire righe manualmente nella migration table.
- `lock timeout`: verificare container concorrenti e sessioni PostgreSQL; non
  terminare sessioni senza identificarne owner/run ID.
- `pending after run`: considerare il container fallito e raccogliere evidence.
- `CEO preservation failed`: bloccare il cutover e ripristinare; non riscrivere
  credenziali.
- `second tenant changed` o reconciliation divergente: bloccare, preservare i
  database e investigare cross-schema prima di ogni retry.

`DB_SYNC=true` e SQL manuale in produzione restano vietati.
