# Doflow 5B.1 — production preflight read-only

Data verifica: 24 agosto 2026. Il controllo è stato esclusivamente read-only.
Non sono stati eseguiti login con account reali, DDL/DML, seed, migrazioni,
upload, modifica env/DNS/Coolify, restart, deploy o cutover.

## Verdetto

`DOFLOW PRODUCTION PREFLIGHT BLOCKED`

`PUSH HELD — CONTROLLED CUTOVER REQUIRED`

Domini e health pubblici sono raggiungibili, ma non sono verificabili con gli
accessi disponibili Coolify, trigger/autodeploy, database e migration
baseline, CEO reali, Redis dettagliato, storage, backup e restore recente.
Una sola di queste lacune basta a bloccare cutover e push; qui sono presenti
più blocker indipendenti.

## GitHub e trigger deploy

- repository: `OliverPistillo/Doflow-PaaS`, pubblica, default branch `main`;
- `origin/main`: `961c7d0d1886742f9330fad81100a2634596cc02`, non divergente;
- branch protection API: `404 Branch not protected`;
- GitHub Actions workflow: 0;
- run recenti su `main`: 0;
- repository webhook: 0;
- GitHub deployment: 0;
- GitHub environment: 0;
- sessione `gh` disponibile con scope repository; la capacità di push non è
  stata provata tramite una scrittura.

Questi dati dimostrano l'assenza di trigger GitHub visibili, ma non dimostrano
che Coolify non usi polling, GitHub App o un trigger configurato lato
piattaforma. Non esiste CLI/token/API Coolify disponibile. Autodeploy,
migration hook, post-deploy command, ultimo deploy, commit deployato, immagini
precedenti e pausa deploy sono `NON VERIFICATO`. Il push è pertanto vietato.

## Domini, TLS e health pubblici

- `app.doflow.it` e `api.doflow.it` risolvono tramite indirizzi Cloudflare;
- TLS 1.3 valido, certificato `CN=doflow.it`, scadenza 20 ottobre 2026;
- `GET https://api.doflow.it/api/health/system`: `200`, circa 244 ms;
- componenti dichiarati: `api`, `db`, `redis`, `ws`, `realtime`, `storage`,
  tutti `ok`;
- `GET https://app.doflow.it/login`: `200`, circa 115 ms;
- root frontend: redirect `307`;
- `GET` sul public lead intake: `404`, coerente con un contratto solo `POST`;
- preflight CORS da `https://app.doflow.it`: `204`, origin esplicita e
  credentials consentite;
- origin estranea: nessun `Access-Control-Allow-Origin`, ma risposta `500`
  invece di una reiezione controllata; è un rischio da chiarire;
- nessun token osservato negli URL provati.

Il probe pubblico non espone commit/versione. DNS/TLS mostrano il bordo
Cloudflare, non la configurazione interna del Tunnel o dell'origine.

## Coolify e variabili ambiente

Coolify è `NON VERIFICATO`: nessun endpoint o token read-only è disponibile.
Di conseguenza non sono verificabili repository/branch sorgente, build pack,
build/start command, healthcheck, network, volumi, dipendenze, ordine deploy,
restart policy, timeout, rollback, autodeploy, migration/seed hook e presenza
delle famiglie env richieste.

Le famiglie da verificare in Fase 5B.2 sono: database, Redis/BullMQ, sessioni
web e cookie, CSRF, JWT non-browser, CORS/trust proxy, URL frontend/API e
domini tenant, Google OAuth, mail, Stripe, storage, public intake, Builder,
worker, scheduler e health. Il codice/config locale non è stato usato come
prova della configurazione Coolify reale.

## PostgreSQL e migrazioni

L'health pubblico indica `db=ok`, ma non esiste un metodo di accesso
produzione read-only già configurato. Gli URL database locali disponibili
puntano a loopback o servizi container e non sono stati reinterpretati come
produzione.

Sono quindi `NON VERIFICATO`: versione PostgreSQL, schemi `public`/`doflow`,
ultima migration, assenza/presenza 179–184, migrazioni inattese, spazio,
connessioni, lock, dimensione, estensioni, conteggi e `DB_SYNC=false`
nell'ambiente reale. Nessun mapper è stato eseguito.

La baseline 178 e il max 184 sono provati soltanto nella rehearsal isolata;
non sono una prova della baseline di produzione.

## CEO reali

Gli account reali non sono stati usati né modificati. Senza accesso database
read-only non sono verificabili esistenza, ruolo `owner`, active, MFA,
email verification, provider, mirror pubblico, membership, duplicati o
fingerprint coerenti per i due account direzionali. Stato: `NON VERIFICATO`.

## Redis, storage e backup

- Redis: l'health pubblico indica `redis=ok`; versione, memoria, persistence,
  policy, keyspace, latenza, connessioni, replica, compatibilità sessioni e
  BullMQ sono `NON VERIFICATO`.
- Storage: l'health pubblico indica `storage=ok`; provider, bucket/volume,
  spazio, permessi, tenant scope, versioning, retention e rollback sono
  `NON VERIFICATO`.
- Backup: esistenza, timestamp, formato, dimensione, destinazione, retention,
  checksum, ultimo restore test, backup storage/volumi e owner del rollback
  sono `NON VERIFICATO`.

Il runbook descrive una procedura conservativa, ma non sostituisce un backup
recente verificabile e un restore test documentato. Questo è un blocker
autonomo del cutover.

## `doflow-nginx`

Ispezione locale esclusivamente read-only:

- container: `doflow-nginx`, ID abbreviato `989fb2bfb5ed`;
- immagine: `nginx:alpine`;
- creato: 3 dicembre 2025;
- Compose project/service: `infra/nginx`;
- stato: `restarting`, exit code `1`, nessun healthcheck;
- restart policy: `unless-stopped`;
- restart count osservato: 1.450, in crescita autonoma;
- network: `infra_doflow-net`;
- porte pubblicate: 0;
- mount: config Nginx read-only e directory certbot/letsencrypt;
- causa log: upstream `frontend:3000` non risolvibile;
- `doflow-frontend` e `doflow-backend` dello stesso project sono exited;
- nessun container cloudflared è presente nello stack locale osservato.

L'evidenza indica un residuo legacy locale e non un listener pubblico. Non è
tuttavia disponibile la configurazione origine/Tunnel/Coolify per dimostrare
formalmente che produzione non dipenda da una risorsa omonima. Resta quindi
un blocker prudenziale; il container non è stato avviato, fermato, riavviato,
rimosso o modificato.

## Rollback readiness

Il runbook contiene ordine operativo, precedente SHA, backup pre-migrazione,
restore PostgreSQL/storage, stop criteria, seed preservation, health e
reconciliation. Mancano prove esterne di immagine/build precedente,
disponibilità effettiva del rollback Coolify, backup recente e responsabile
formalmente assegnato. Rollback procedurale: presente; rollback operativo:
`NON VERIFICATO`.

## Condizioni per Fase 5B.2

Prima di cutover o push devono essere prodotti in sola lettura:

1. export/config Coolify con trigger e autodeploy disabilitato o sospeso;
2. prova di assenza migration/seed/post-deploy hook sul push;
3. matrice nomi env presenti, senza valori;
4. query PostgreSQL read-only con baseline migration e `DB_SYNC=false`;
5. boolean check dei due CEO reali e mirror/membership;
6. diagnostica Redis e storage read-only;
7. backup recente verificabile e restore test documentato;
8. prova del percorso Cloudflare/Tunnel e irrilevanza del Nginx locale;
9. build/immagine precedente e owner del rollback;
10. nuovo release lock deterministico verde.

Produzione e account CEO reali non sono stati modificati.

## Addendum Fase 5B.1A — CORS locale e separazione dal preflight

La regressione CORS è stata corretta e verificata esclusivamente nello stack
RC locale: l'origine autorizzata conserva origin esplicita e credentials;
preflight e richieste da origine estranea ricevono un rifiuto controllato
`403`, senza `Access-Control-Allow-Origin`, `500` o `SYSTEM_ERROR`.

La produzione non è stata distribuita né modificata. Il probe read-only del
25 agosto 2026 conferma che l'origine autorizzata riceve `204` con allow-origin
corretto e che l'origine estranea, pur senza allow-origin, riceve ancora `500`
dal codice attualmente deployato.

Questa correzione non risolve Coolify/autodeploy, baseline database, CEO reali,
Redis/storage, backup/restore, percorso Cloudflare/Tunnel o rollback operativo.
Il verdetto resta invariato:

`DOFLOW PRODUCTION PREFLIGHT BLOCKED`

`PUSH HELD — CONTROLLED CUTOVER REQUIRED`
