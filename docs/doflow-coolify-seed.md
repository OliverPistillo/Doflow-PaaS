# Seed tenant doflow su Coolify

Questa procedura prepara il tenant operativo interno `doflow` per la CRM V2, senza passare dal signup self-service e senza toccare tenant esistenti.

## Contesto

- `infra/docker-compose.yml` e' pensato per lo sviluppo locale. Non e' necessariamente il compose usato da Coolify in produzione.
- In locale il comando `seed:doflow` usa il `DATABASE_URL` caricato dagli `.env` locali. Se quel valore punta a `localhost:5432` e PostgreSQL locale non e' avviato, il seed fallisce con `ECONNREFUSED`.
- Su Coolify il seed deve essere eseguito dentro l'app/container backend, cosi' usa il `DATABASE_URL` reale configurato nell'ambiente backend di Coolify.
- Lo script non stampa password, hash, token, `DATABASE_URL` completo o segreti env.

## Variabili necessarie

Impostare nell'ambiente backend di Coolify:

- `DATABASE_URL`: connessione PostgreSQL reale del backend.
- `DOFLOW_CEO_PASSWORD`: password iniziale per `oliver@doflow.it` e `daniele@doflow.it`.
- `NODE_ENV`: normalmente `production`, oppure il valore reale usato dall'app backend.
- `APP_URL` / `FRONTEND_URL` / `APP_BASE_URL`: usare `https://app.doflow.it` quando servono URL applicativi generati dal backend.
- `TENANT_BASE_DOMAIN`: usare `doflow.it` se l'ambiente genera URL tenant su sottodominio.
- `NEXT_PUBLIC_APP_URL`: usare `https://app.doflow.it` nel frontend.
- `NEXT_PUBLIC_BASE_DOMAIN`: usare `doflow.it` nel frontend se configurato.

`app.doflow.it` resta il dominio principale dell'app e del CRM esistente: non e' un host dedicato esclusivamente al tenant interno `doflow`. Il tenant `doflow` usa `app.doflow.it` solo come host applicativo/post-login; il tenant effettivo viene determinato da JWT/sessione/header tenant. Gli altri tenant continuano a usare la logica esistente a sottodominio, per esempio `https://{slug}.doflow.it`, dove prevista.

Usare una password iniziale robusta. Dopo il primo accesso, cambiarla o ruotarla se richiesto dalla policy interna.

## Comando da Coolify

Eseguire il comando nella shell/console dell'app backend Coolify.

Se la working directory del container e' `apps/backend`:

```bash
DOFLOW_CEO_PASSWORD='inserire-password-sicura' pnpm seed:doflow
```

Se la working directory del container e' la root del monorepo:

```bash
DOFLOW_CEO_PASSWORD='inserire-password-sicura' pnpm -C apps/backend seed:doflow
```

Se `DOFLOW_CEO_PASSWORD` e' gia' configurata come variabile dell'app Coolify, non inserirla nel comando:

```bash
pnpm -C apps/backend seed:doflow
```

## Cosa crea o aggiorna

Il seed e' idempotente:

- crea o aggiorna il record `public.tenants` per slug/schema `doflow`;
- crea lo schema PostgreSQL `doflow` se manca;
- crea le tabelle base tenant previste dalla Fase 1: `users`, `invites`, `audit_log`, `files`, `dashboard_widgets`;
- crea o aggiorna gli utenti CEO come ruolo tecnico `owner`;
- crea o aggiorna il mirror coerente in `public.users`;
- marca il tenant come attivo e con piano massimo disponibile nello script (`ENTERPRISE`);
- abilita le subscription dei moduli disponibili se le tabelle di piattaforma sono presenti;
- marca l'onboarding come completato se la tabella `public.tenant_onboarding` e' presente.

## Verifica login

Dopo il seed, verificare il login con:

- `oliver@doflow.it`
- `daniele@doflow.it`

Entrambi devono usare la password iniziale definita in `DOFLOW_CEO_PASSWORD` ed entrare nel tenant `doflow` con ruolo tecnico `owner`.

## Note di sicurezza

- Non incollare password o segreti nei log pubblici.
- Non loggare mai `DATABASE_URL` completo, hash password, token o segreti env.
- Se la password e' stata passata inline nel comando Coolify, ruotarla dopo il primo accesso se la cronologia comandi del container e' accessibile.
- Il tenant `doflow` e' riservato: non va creato tramite signup self-service.
