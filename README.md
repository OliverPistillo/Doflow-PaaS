<div align="right">

🇮🇹 <strong>Italiano</strong> | <a href="README.en.md">🇬🇧 English</a>

</div>

<div align="center">

<img src="apps/frontend/public/doflow_logo.svg" alt="Doflow" width="190" />

# Doflow App

Piattaforma gestionale multi-tenant per coordinare attività commerciali, clienti, progetti e operatività aziendale.

[![Next.js](https://img.shields.io/badge/Next.js-14.2.34-black?logo=nextdotjs)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10.4.22-E0234E?logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#licenza)

</div>

## Panoramica

Doflow è un'applicazione SaaS/PaaS gestionale organizzata come monorepo. Offre workspace tenant separati per gestire il ciclo commerciale, le relazioni con i clienti, la delivery dei progetti e le attività operative, oltre a un control plane riservato all'amministrazione della piattaforma.

Il backend mantiene una distinzione esplicita tra utenti di un tenant e superadmin di piattaforma. I dati tenant risiedono in schemi PostgreSQL dedicati; identità, catalogo moduli, subscription e metadati di piattaforma risiedono nello schema `public`.

## Stato del progetto

Il branch corrente contiene la baseline di acceptance del core operativo Doflow: i flussi recenti di CRM, progetti, timeline, file/materiali, amministrazione e performance sono presenti nel codice applicativo e coperti da test mirati e gate visuali dedicati. Questa indicazione non implica che ogni pagina storica o ogni integrazione dichiarata come dipendenza sia disponibile in tutti gli ambienti.

| Ambito | Stato verificabile nella repository |
| --- | --- |
| Core tenant | Controller, servizi e interfacce per CRM, progetti, operatività, amministrazione, risorse e reporting |
| Auth e onboarding | Email/password, Google OAuth, MFA/TOTP, recupero password, inviti, signup tenant e onboarding |
| Piattaforma | Control plane superadmin con gestione tenant, utenti, moduli, subscription, osservabilità e supporto |
| Integrazioni | Storage S3-compatible, email, Stripe, Google OAuth, Apollo/Gemini e funzioni AI richiedono provider e variabili d'ambiente |
| Roadmap | Nessuna roadmap datata viene trattata come stato implementato |

La disponibilità effettiva di una funzione dipende anche da tenant, ruolo, piano, moduli attivi e configurazione dell'ambiente. La sola presenza di una route frontend o di un SDK non costituisce garanzia di abilitazione in produzione.

## Funzionalità principali

- **Commerciale e CRM** — lead, aziende, contatti, opportunità, pipeline e preventivi. Per il tenant operativo Doflow il modello commerciale canonico è:

  ```text
  new → contacted → qualified → appointment → quote → closed_won
  lost / paused
  ```

- **Clienti e contatti** — anagrafiche, relazioni con opportunità e progetti, dettaglio contestuale e operazioni sul record.
- **Progetti e delivery** — progetti, membri, milestone, attività, checklist, commenti e file. Per Doflow le fasi canoniche sono:

  ```text
  to_start → materials → design → development → review → publishing → delivered
  paused
  ```

- **Timeline, attività e comunicazioni** — note interne, attività, appuntamenti, chiamate e messaggi esterni registrati nel contesto del record.
- **File, documenti e materiali** — documenti tenant, collegamenti ai record, file di progetto e richieste materiali; le operazioni su oggetti richiedono uno storage S3-compatible configurato.
- **Amministrazione** — viste finanziarie, fatture e incassi, scadenze, rinnovi, preventivi e contratti, nei limiti dei permessi del ruolo.
- **Team e reporting** — membri, competenze, disponibilità, carichi, consuntivazione, report operativi e performance consulenti dove abilitate.
- **Automazioni, calendario e knowledge** — regole e run di automazione, eventi e viste calendario, articoli, asset e template condivisi.
- **Credentials Vault** — inventario credenziali, scadenze, rotazioni, permessi e audit, subordinato alle capability tenant.
- **Builder e proposte web** — import, temi, generazione, preparazione, anteprima ed export di proposte; la superficie Builder è limitata al tenant Doflow e alcune elaborazioni dipendono da storage e provider AI.
- **Auth e onboarding** — login tenant-aware, Google OAuth, MFA/TOTP con stage espliciti, `/api/auth/me`, password reset, inviti e handoff cross-host opaco e monouso. `rememberMe` sceglie coerentemente tra storage di sessione e persistente nel frontend.
- **Superadmin** — gestione di tenant, utenti, moduli, subscription, metriche, audit, supporto e configurazione della piattaforma tramite guard backend dedicate.

## Architettura

```text
┌──────────────────────────────────────────┐
│ Next.js 14 / React 18                    │
│ App tenant + control plane superadmin    │
└───────────────────┬──────────────────────┘
                    │ HTTP /api + WebSocket
                    ▼
┌──────────────────────────────────────────┐
│ NestJS 10                                │
│ Auth · Tenancy · Guards · Feature modules│
└──────────────┬───────────────┬───────────┘
               │               │
               ▼               ▼
┌───────────────────────┐  ┌─────────────────────┐
│ PostgreSQL 16         │  │ Redis / RedisBloom  │
│ public + schema/tenant│  │ BullMQ e realtime   │
└───────────────────────┘  └─────────────────────┘
               │
               └──── storage S3-compatible, se configurato
```

Il frontend usa per impostazione predefinita richieste relative a `/api/*`; la configurazione Next.js le inoltra al backend NestJS. Il backend risolve il tenant, autentica la richiesta, applica guard di ruolo/modulo e opera sullo schema PostgreSQL corretto.

## Stack tecnologico

Le versioni seguenti provengono dai manifest correnti e dalle risoluzioni del lockfile PNPM.

| Area | Tecnologie e versioni principali |
| --- | --- |
| Runtime e workspace | Node.js `20.19.6`, PNPM `10.24.0`, TypeScript `5.6.3`, PNPM Workspaces |
| Frontend | Next.js `14.2.34`, React `18.3.1`, Tailwind CSS `3.4.19`, Radix UI, SWR `2.4.1`, Zod `4.4.3` |
| Backend | NestJS `10.4.22`, TypeORM `0.3.28`, PostgreSQL driver `8.20.0`, Passport/JWT, class-validator |
| Dati e job | immagine `postgres:16-alpine`, immagine `redislabs/rebloom:latest`, BullMQ `5.76.5`, ioredis `5.10.1` |
| API e qualità | Swagger/OpenAPI, Jest, ts-jest, Playwright `1.62.1` |
| Integrazioni configurabili | storage S3-compatible, SMTP, Stripe, Google OAuth, Apollo e provider AI |

L'immagine RedisBloom è attualmente referenziata con tag `latest`; non va interpretata come una versione immutabile. Analogamente, la presenza degli SDK di integrazione non dimostra che i relativi servizi siano attivi in un deployment specifico.

## Multi-tenancy e sicurezza

- **Schema-per-tenant** — `public.tenants` associa ogni tenant al proprio `schema_name`; i dati operativi restano nello schema dedicato.
- **Risoluzione tenant** — contesto autenticato, host/header e directory pubblica concorrono alla risoluzione. Per le route protette il tenant del token è la fonte autorevole per l'enforcement delle feature.
- **Pool isolato per richiesta** — il middleware tenancy applica lo `search_path` nel perimetro di una transazione e restituisce la connessione al pool senza stato tenant residuo.
- **Ruoli separati** — un `owner` tenant non è un superadmin. Le route di piattaforma richiedono ruolo superadmin, tenant `public` e auth stage `FULL`.
- **Enforcement backend** — le guard verificano autenticazione, tenant attivo, capability, piano e subscription del modulo; nascondere una voce UI non è una misura di sicurezza sufficiente.
- **SQL sicuro** — i valori delle query devono essere parametrizzati. Gli identificatori dinamici di schema devono passare dalla validazione centralizzata (`safeSchema`) e non devono derivare direttamente da input non fidato.
- **Auth hardening** — password hash, rate limiting, MFA/TOTP, stage di autenticazione parziali e handoff opachi evitano di trasferire JWT nei redirect URL.
- **Segreti** — credenziali, token e chiavi appartengono all'ambiente di esecuzione, non alla repository o alla documentazione. Non committare file `.env` reali.
- **Schema synchronization** — mantenere `DB_SYNC=false` in produzione e applicare cambiamenti dati con procedure controllate e idempotenti.

Ogni nuova query o integrazione deve preservare isolamento tenant, autorizzazione backend e assenza di accessi cross-tenant.

## Struttura della repository

```text
.
├── apps/
│   ├── backend/          # API NestJS, tenancy, moduli e job
│   └── frontend/         # applicazione Next.js e control plane
├── docs/                 # documentazione tecnica e riferimenti visuali
├── infra/                # riferimenti infrastrutturali e reverse proxy
├── scripts/              # utility operative e gate visuali
├── tests/                # test visuali Playwright
├── .env.example          # catalogo pubblico delle variabili root
├── docker-compose.yml    # riferimento servizi / sviluppo locale
├── package.json          # script del workspace
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Sviluppo locale

### Requisiti

- Node.js `20.19.6` e PNPM `10.24.0` (versioni dichiarate anche in `package.json` tramite Volta);
- PostgreSQL 16 e Redis/RedisBloom, locali o avviati tramite Docker;
- Docker con Compose, facoltativo ma utile per i servizi dati.

### Installazione

```bash
pnpm install --frozen-lockfile
```

### Configurazione ambiente

Usare `.env.example` come inventario di partenza, sostituendo sempre i placeholder fuori dal controllo versione.

- Per Docker Compose, creare `.env` nella root.
- Per avviare direttamente il backend, creare `apps/backend/.env` con almeno connessione PostgreSQL locale, Redis, `JWT_SECRET` e `DB_SYNC=false`.
- Per il frontend, `apps/frontend/.env.local` può definire `INTERNAL_BACKEND_URL`; lasciando `NEXT_PUBLIC_API_URL` vuota, il browser usa `/api` e il rewrite Next.js.
- Aggiungere le variabili di OAuth, posta, billing, storage o AI solo se si intende usare la relativa integrazione.

Non copiare nei README valori reali di `DATABASE_URL`, password, secret o chiavi provider.

### Avvio

```bash
# Dipendenze dati locali tramite Compose
docker compose up -d postgres redis

# Solo sul database locale configurato, quando necessario
pnpm -C apps/backend migration:run

# Frontend e backend in parallelo
pnpm run dev
```

Con le porte predefinite, il frontend risponde su `http://localhost:3000` e il backend su `http://localhost:4000`.

## Build e test

| Comando | Scopo |
| --- | --- |
| `pnpm run build:frontend` | Build di produzione Next.js |
| `pnpm run build:backend` | Compilazione backend NestJS/TypeScript |
| `pnpm run build` | Build frontend seguita dalla build backend |
| `pnpm run dev` | Avvio parallelo delle app del workspace |
| `pnpm -C apps/frontend lint` | Lint frontend definito dal package |
| `pnpm -C apps/backend exec jest --runInBand` | Suite Jest backend tramite la configurazione presente |
| `pnpm run visual:gate:headed` | Gate visuale locale con autenticazione manuale |
| `pnpm run visual:gate` | Gate visuale headless con sessione già acquisita |

Al momento non esiste uno script root `test`, `lint` o `type-check`: usare esclusivamente i comandi realmente definiti sopra o nel package dell'app interessata. Il comando lint frontend è definito, ma senza una configurazione ESLint già inizializzata apre il setup interattivo e non è ancora adatto a un'esecuzione CI non interattiva. Il gate visuale è destinato alle schermate coperte dai riferimenti in `docs/design-references/` e richiede l'ambiente autorizzato descritto in quella documentazione.

## Produzione

Il modello operativo Doflow è distinto dai file Compose presenti nella repository:

```text
Internet
  → Cloudflare
  → Cloudflare Tunnel
  → Coolify / reverse proxy sul server Doflow
  → servizi frontend, backend e dati
```

- [app.doflow.it](https://app.doflow.it) — applicazione web;
- [api.doflow.it](https://api.doflow.it) — API backend;
- [doflow.it](https://doflow.it) — sito pubblico separato, integrabile con l'applicazione.

`docker-compose.yml` e `infra/docker-compose.yml` sono riferimenti per servizi e sviluppo locale; non sono una descrizione autorevole della topologia live. La presenza di un servizio o provider in quei file non prova che sia il meccanismo usato in produzione.

## Health e API

L'endpoint health canonico è:

```http
GET /api/health/system
```

La probe aggrega stato di API, PostgreSQL, Redis, realtime/WebSocket e storage. Swagger viene configurato dal bootstrap NestJS su:

```text
/api/docs
```

La raggiungibilità esterna della documentazione API dipende dalle regole del deployment. Il README non sostituisce un catalogo API versionato.

## Public Lead Intake

Il modulo collega il sito pubblico al CRM tenant tramite:

```text
doflow.it
  → POST /api/public/lead-intake/:tenantSlug
  → contatto (e azienda, se disponibile) + lead + opportunità + attività CRM
  → notifica tenant
```

Il backend limita i tenant abilitati tramite configurazione, valida payload e consenso privacy, applica controlli di origine e anti-abuso e gestisce in modo idempotente il riferimento della submission. L'integrazione predefinita è destinata al tenant Doflow; non va estesa ad altri tenant senza una scelta esplicita e verificata.

## Roadmap

La roadmap evolve insieme al prodotto. Le funzionalità descritte in questo README rappresentano esclusivamente ciò che è verificabile nel codice e nella configurazione correnti; integrazioni sperimentali, provider non configurati e pagine storiche non vengono presentati come capacità disponibili.

## Licenza

**Proprietary — tutti i diritti riservati.**

La repository non contiene una licenza open source né concede diritti di riutilizzo, modifica o redistribuzione. Per qualsiasi utilizzo diverso dallo sviluppo autorizzato è necessaria un'autorizzazione scritta.
