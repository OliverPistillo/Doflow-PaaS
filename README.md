<div align="center">

<img src="apps/frontend/public/doflow_logo.svg" alt="Doflow" width="200" />

# Doflow PaaS

### **The modular multi-tenant business platform for Italian SMBs**

*Un'unica piattaforma. 30+ moduli. 3 piani di abbonamento. Onboarding in stile Odoo.*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-EA2845?logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)

[Demo Live](#-live-demo) • [Architettura](#%EF%B8%8F-architettura) • [Quick Start](#-quick-start) • [Roadmap](#-roadmap) • [Investor Brief](#-investor-brief)

</div>

---

## 🎯 Executive Summary

**Doflow** è un **PaaS (Platform-as-a-Service) verticalizzato** che permette a piccole e medie imprese italiane di gestire l'intero ciclo di business — dalla generazione dei lead alla fatturazione, dal magazzino alle risorse umane — su **una sola piattaforma multi-tenant**, eliminando il classico "stack di 4-7 strumenti" che ogni PMI italiana paga oggi separatamente.

**Modello di business**: SaaS B2B subscription a 3 tier (€0 / €99 / €299 al mese) con **moduli a la carte** che sbloccano funzionalità verticali (CRM, Finanza, HR, Hospitality, Manifattura, ecc.).

**Differenziatore**: configurazione **first-login in stile Odoo** che adatta dashboard e moduli al settore dell'azienda in meno di 5 minuti, senza alcun consulente.

### 📊 Numeri chiave del prodotto

| Metrica | Valore |
|---------|--------|
| **Moduli disponibili** | 34 (espandibili) |
| **Categorie funzionali** | 8 (Sales, Finanza, Operations, HR, Marketing, Support, Verticali Salute, Verticali Industriali) |
| **Settori pre-configurati** | 10 (Generico, Retail, Hospitality, Ristorazione, Beauty, Manifattura, Servizi, Sanità, Edilizia, Educazione) |
| **Piani tariffari** | 3 (Starter free, Pro €99/mese, Enterprise €299/mese) |
| **Trial gratuito** | 14 giorni sui moduli Pro, no carta richiesta |
| **Tempo di setup** | < 5 minuti dal signup alla dashboard operativa |
| **Supporto multi-tenant** | Schema-per-tenant PostgreSQL (isolamento totale dei dati) |

---

## 💼 Investor Brief

### Il problema

Una PMI italiana media usa **4-7 software diversi** per gestire il proprio business:
- 1 CRM (HubSpot, Pipedrive)
- 1 software di fatturazione (Fatture in Cloud, Aruba)
- 1 gestionale magazzino (TeamSystem, Zucchetti)
- 1 strumento di task management (Trello, Asana)
- 1 sistema HR (Factorial, Personio)
- 1 email marketing (Mailchimp, Brevo)

**Costo medio totale**: €350–€800/mese, **dati frammentati**, **import/export manuali**, **nessuna visione olistica del business**.

### La soluzione

**Una piattaforma unica**, modulare, con **isolamento dati per azienda**, configurabile in autonomia tramite wizard e fatturazione progressiva: paghi solo i moduli che usi.

### Il vantaggio competitivo

| | Odoo | Zoho | TeamSystem | **Doflow** |
|---|---|---|---|---|
| Multi-tenant SaaS nativo | ⚠️ self-host | ✅ | ❌ | ✅ |
| Localizzato Italia (SDI, F24) | ⚠️ moduli a pagamento | ❌ | ✅ | ✅ |
| Setup self-service < 5 min | ❌ | ⚠️ | ❌ | ✅ |
| Verticali settoriali pronti | ⚠️ | ⚠️ | ✅ enterprise | ✅ |
| Pricing PMI-friendly | ⚠️ | ✅ | ❌ | ✅ |
| API-first / estendibile | ✅ | ✅ | ⚠️ | ✅ |

### Modello di monetizzazione

```
ARR per tenant medio (Pro)   = €99 × 12 = €1.188/anno
+ Up-sell moduli verticali   = +€20–€50/mese (avg)
                              ─────────────────────
                              ~€1.700–€2.000 ARR/tenant
```

**Target Year 3**: 5.000 tenant attivi → **€8–10M ARR**.

### Roadmap commerciale

| Fase | Quando | Obiettivo |
|------|--------|-----------|
| **MVP** | ✅ Q2 2026 | 5 settori verticali (current) |
| **Beta pubblica** | Q3 2026 | 100 early adopter, 3 case study |
| **Launch** | Q4 2026 | Marketplace estensioni di terze parti |
| **Scale** | 2027 | Espansione UE (DACH + Iberia) |

---

## 🛠️ Stack Tecnologico

### Frontend
- **[Next.js 14](https://nextjs.org)** (App Router) + **TypeScript 5.6**
- **[Tailwind CSS](https://tailwindcss.com)** + **[Radix UI](https://www.radix-ui.com)** (shadcn-style components)
- **[React Hook Form](https://react-hook-form.com)** + **[Zod](https://zod.dev)** validation
- **[SWR](https://swr.vercel.app)** per data fetching con cache intelligente
- **[Lucide Icons](https://lucide.dev)** + custom SVG (no emoji-as-icons)
- **[Motion](https://motion.dev)** per micro-animazioni e transitions

### Backend
- **[NestJS 10](https://nestjs.com)** (modulare, decoratori, DI)
- **[TypeORM](https://typeorm.io)** (con strategia multi-tenant schema-per-tenant)
- **[PostgreSQL 15+](https://www.postgresql.org)** (database principale + pgvector per AI search futura)
- **[Redis 7](https://redis.io)** + **[BullMQ](https://docs.bullmq.io)** per job asincroni
- **[Passport.js](https://www.passportjs.org)** + JWT + **Google OAuth 2.0** (passport-google-oauth20)
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** per password hashing (12 rounds)
- **[ThrottlerModule](https://docs.nestjs.com/security/rate-limiting)** per rate limiting globale
- **[class-validator](https://github.com/typestack/class-validator)** + **class-transformer** per DTO validation
- **[@nestjs-modules/mailer](https://nest-modules.github.io/mailer/)** per email transazionali (SMTP)
- **[Swagger/OpenAPI](https://docs.nestjs.com/openapi/introduction)** per docs API auto-generate

### Sicurezza
- 🔐 **Multi-tenant isolation**: ogni azienda ha il proprio schema PostgreSQL (`tenant_<slug>`)
- 🔐 **MFA TOTP** (Time-based One-Time Password, RFC 6238) — compatibile Google Authenticator/Authy
- 🔐 **Login Bloom Filter** per rilevamento attacchi distribuiti pre-rate-limit
- 🔐 **JWT short-lived** (15min) + refresh token rotation (in roadmap Iter 6)
- 🔐 **Audit log** completo di ogni azione sensibile (login, signup, role change, payment)
- 🔐 **CORS whitelist dinamico** + Helmet headers
- 🔐 **Bcrypt 12 rounds** (≈250ms su CPU moderna, resistente a brute force)
- 🔐 **Rate limiting**: 100 req/min globale, 5 signup/IP/ora, 30 slug-check/IP/min

### DevOps & Infra
- **Docker Compose** (Postgres + Redis + Backend + Frontend + Nginx + Certbot)
- **PNPM Workspaces** monorepo (lockfile coerente, dedup automatico)
- **TypeORM Migrations** (`pnpm migration:run/revert/generate`)
- **Healthcheck** Docker (`/api/health`) + supervisor in dev
- **Volumi persistenti** Docker per Postgres data
- **TLS via Certbot** con auto-renewal (config in `infra/nginx/`)

### AI & Integrazioni esterne (opzionali, dietro feature flag)
- **[Apollo.io](https://apollo.io)** per lead enrichment B2B (modulo Pro)
- **[AWS S3](https://aws.amazon.com/s3/)** per file storage tenant-isolated
- **[Stripe](https://stripe.com) / Razorpay** per pagamenti (in roadmap Iter 7)
- **[Google Calendar API](https://developers.google.com/calendar)** per sync appuntamenti

---

## 🏗️ Architettura

### Visione d'insieme

```
                           ┌─────────────────────────────────────┐
                           │           CLOUDFLARE / NGINX         │
                           │  TLS terminantion + DDoS shield      │
                           └────────────┬────────────────────────┘
                                        │
                ┌───────────────────────┼─────────────────────────┐
                ▼                       ▼                         ▼
       ┌────────────────┐      ┌────────────────┐        ┌────────────────┐
       │  app.doflow.it │      │ acme.doflow.it │        │ ...N tenants...│
       │   (Next.js 14) │      │  (path-based)  │        │                │
       └────────┬───────┘      └────────┬───────┘        └────────┬───────┘
                │                        │                          │
                └────────────────────────┼──────────────────────────┘
                                         ▼
                          ┌──────────────────────────┐
                          │   NestJS Backend (4000)  │
                          │  ┌────────────────────┐  │
                          │  │ Tenancy Middleware │  │  ← resolves tenant from
                          │  │  (schema switcher) │  │     subdomain or path
                          │  └────────┬───────────┘  │
                          │           ▼              │
                          │  ┌────────────────────┐  │
                          │  │  Auth Module       │  │
                          │  │  - JWT             │  │
                          │  │  - MFA TOTP        │  │
                          │  │  - Google OAuth    │  │
                          │  │  - Login Guard     │  │
                          │  └────────┬───────────┘  │
                          │           ▼              │
                          │  ┌────────────────────┐  │
                          │  │ Feature Modules    │  │
                          │  │  CRM, Finance,     │  │
                          │  └────────┬───────────┘  │
                          └───────────┼──────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
     ┌────────────────┐      ┌────────────────┐     ┌────────────────┐
     │  PostgreSQL 15 │      │     Redis 7    │     │   AWS S3 / FS  │
     │ schema:public  │      │  + BullMQ jobs │     │  (file uploads)│
     │ schema:acme    │      │  + cache       │     │   tenant-scoped│
     │ schema:hotel   │      └────────────────┘     └────────────────┘
     │ schema:...     │
     └────────────────┘
```

### Strategia multi-tenant

Doflow utilizza il pattern **schema-per-tenant** di PostgreSQL:

```sql
-- public schema (directory globale)
public.tenants            -- elenco tenant
public.users              -- directory utenti (cross-tenant per fast lookup)
public.platform_modules   -- moduli disponibili
public.tenant_subscriptions -- chi è iscritto a cosa
public.audit_log          -- audit globale
public.tenant_onboarding  -- stato wizard primo accesso

-- per ogni tenant, uno schema dedicato
acme_corp.users           -- isolato dagli altri tenant
acme_corp.contacts
acme_corp.invoices
acme_corp.tickets
...

hotel_xyz.users
hotel_xyz.bookings        -- modulo verticale Hospitality
hotel_xyz.menu_items
...
```

**Vantaggi**:
- ✅ Isolamento dati a livello DB (no risk di leak tra tenant)
- ✅ Backup/restore granulare per tenant
- ✅ Performance prevedibili (no "noisy neighbor" su tabelle giganti)
- ✅ Conformità GDPR semplificata (data residency per tenant)
- ✅ Possibilità di spostare un singolo tenant su DB dedicato (high-tier customers)

**Trade-off gestiti**:
- ⚠️ Migrazioni schema vanno applicate su tutti gli schemi → gestito da `TenantBootstrapService`
- ⚠️ Limite ~500-1000 schemi/DB Postgres → oltre, sharding orizzontale per cluster di tenants

### Multi-tenancy resolution

Ogni request HTTP passa attraverso il `TenancyMiddleware` che identifica il tenant da:
1. **Sottodominio**: `acme.doflow.it` → tenant `acme`
2. **Path-based**: `app.doflow.it/t/acme/dashboard` → tenant `acme`
3. **JWT claim**: token contiene `tenantId` (per API calls)
4. **Custom domain**: `crm.acmecorp.com` → lookup `tenant_domains` → tenant `acme`

Il middleware setta `req.tenantConnection` con la connessione TypeORM al schema corretto, che tutti i servizi downstream riusano.

---

## 🚀 Funzionalità

### 🔐 Autenticazione & Onboarding

| Feature | Stato | Tier |
|---------|-------|------|
| Email + Password (bcrypt 12 rounds) | ✅ | All |
| **Google OAuth 2.0** ([passport-google-oauth20](https://github.com/jaredhanson/passport-google-oauth2)) | ✅ | All |
| MFA / TOTP (Google Authenticator compatible) | ✅ | All |
| Login Bloom Filter (anti distributed brute force) | ✅ | All |
| Self-service tenant signup (wizard 3-step) | ✅ | All |
| **Onboarding Odoo-style** (settore → moduli → conferma) | ✅ | All |
| Live slug validation (debounced API check) | ✅ | All |
| 14-day trial automatico sui moduli Pro | ✅ | All |
| Refresh token rotation (httpOnly cookie) | 🔜 Iter 6 | All |
| SAML 2.0 / SSO Enterprise | 🔜 Roadmap | Enterprise |
| Magic link / passwordless | 🔜 Roadmap | All |

### 💼 Moduli funzionali (34 totali, organizzati in 8 categorie)

#### Vendite & CRM (5)
- `crm.contacts` — Anagrafica clienti, lead e aziende *(Starter)*
- `crm.deals` — Pipeline & trattative con kanban *(Starter)*
- `crm.quotes` — Preventivi PDF + invio cliente *(Starter)*
- `crm.contracts` — Template + firma elettronica *(Pro)*
- `crm.sales-intel` — Lead enrichment con Apollo.io + outreach AI *(Enterprise, Beta)*

#### Finanza (5)
- `fin.invoices` — Fatturazione elettronica SDI/XML + scadenzario *(Starter)*
- `fin.payments` — Tracciamento incassi + riconciliazione bancaria *(Starter)*
- `fin.expenses` — Note spese con OCR scontrini *(Pro)*
- `fin.subscriptions` — Abbonamenti ricorrenti + renewal automatici *(Pro)*
- `fin.vat-reports` — Liquidazione IVA, esterometro, F24 *(Pro)*

#### Operations (5 + 4 inventory)
- `ops.tasks` / `ops.kanban` / `ops.calendar` *(Starter)*
- `ops.timesheet` / `ops.projects` (Gantt, milestone) *(Pro)*
- `inv.warehouse` / `inv.suppliers` *(Starter)*
- `inv.purchase-orders` (PO automatici da soglia) *(Pro)*
- `inv.logistics` (DDT + tracking corrieri) *(Pro)*

#### Marketing (4)
- `mkt.campaigns` — Email newsletter + sequenze *(Starter)*
- `mkt.lead-capture` — Form embeddabili *(Starter)*
- `mkt.sms` — Marketing SMS *(Pro)*

#### Risorse Umane (4)
- `hr.employees` — Anagrafica dipendenti *(Starter)*
- `hr.attendance` — Timbrature + badge virtuale *(Pro)*
- `hr.leaves` — Workflow ferie/permessi *(Pro)*
- `hr.payroll` — Buste paga + integrazione consulente *(Enterprise)*

#### Support & Servizi (3)
- `sup.tickets` — Helpdesk + SLA *(Starter)*
- `sup.knowledge-base` — FAQ pubbliche/interne *(Pro)*
- `sup.live-chat` — Widget chat sito *(Pro, Beta)*

#### Verticali settoriali (4)
- `vert.hospitality.bookings` — Camere + channel manager *(Pro, Beta)*
- `vert.hospitality.menu` — Menu QR + comande digitali *(Pro, Beta)*
- `vert.beauty` — Trattamenti + schede cliente *(Pro)*
- `vert.manufacturing` — MES light + macchine utensili *(Enterprise)*

### 🎨 UX Highlights

- **Wizard di signup 3-step**: Account → Azienda → Conferma, con slug auto-generato + validazione live
- **Onboarding Odoo-style**: 10 settori pre-configurati che pre-selezionano automaticamente i moduli giusti per quel business
- **Tier-aware locking**: i moduli sopra il tuo piano sono mostrati con lucchetto (drive di upselling)
- **Backend feature enforcement**: le API protette verificano tenant attivo, piano minimo e subscription modulo `ACTIVE/TRIAL`; il lucchetto UI non è l'unica barriera
- **Dashboard dinamica**: composta dai widget dei moduli attivi, riconfigurabile; il backend rifiuta widget sopra piano nel salvataggio layout
- **Design dark/glassmorphism**: gradient blu→viola, blur 16px, micro-animazioni `cubic-bezier(0.22,1,0.36,1)`
- **Font**: Outfit per signup/onboarding (display moderno), Nunito Sans per app interne
- **Responsive desktop-first** con breakpoint mobile completi
- **`data-testid` universale**: ogni elemento interattivo ha un test ID per E2E test
- **Shell applicativa tenant e superadmin** con background gradient, griglia sottile e ambient blobs
- **Header glass bar** per tenant e superadmin con blur e border morbido
- **Componenti aggiornati**: `PageShell`, `PageHeader`, `Card`, `Button` con hero premium, glass panel, border, shadow, hover lift e gradient
- **Sidebar premium**: active pill gradient, logo icon premium, colori semantic token
- **Stati UI allineati**: Loading, empty, error e skeleton states allineati al nuovo stile SaaS

---

## 🚀 Quick Start

### Prerequisiti

- **Node.js 20+**
- **PNPM 10.24+** (`npm i -g pnpm`)
- **PostgreSQL 15+** (locale o Docker)
- **Redis 7+** (locale o Docker)
- (opzionale) **Docker + Docker Compose** per setup automatico

### Setup locale

```bash
# 1. Clona/estrai il progetto
unzip Doflow-PaaS-improved.zip -d Doflow-PaaS
cd Doflow-PaaS

# 2. Crea i file .env (vedi sezione "Environment Variables")
cp .env.example .env
# … modifica POSTGRES_PASSWORD, JWT_SECRET, GOOGLE_OAUTH_*

# 3a. Opzione A: Docker Compose (consigliato)
docker compose up -d postgres redis
# Backend e frontend eseguili separatamente in dev mode

# 3b. Opzione B: install dipendenze + run dev
pnpm install
pnpm -C apps/backend migration:run         # applica migrazioni Postgres
pnpm -C apps/backend dev                   # http://localhost:4000
pnpm -C apps/frontend dev                  # http://localhost:3000

# 4. Apri il browser su http://localhost:3000/signup
#    → crea il tuo primo tenant
#    → completa l'onboarding wizard
#    → benvenuto in Doflow!
```

### Setup produzione (Docker Compose completo)

```bash
# Modifica .env con valori di produzione (no default!)
nano .env

# Build & start tutti i servizi
docker compose up -d --build

# Logs
docker compose logs -f backend frontend

# Healthcheck
curl https://api.tuodominio.com/api/health
```

### Avviare solo i servizi backend (per dev frontend)

```bash
docker compose up -d postgres redis
pnpm -C apps/backend dev
```

---

## 🌍 Environment Variables

### Root `.env` (per docker-compose)

```bash
# Postgres
POSTGRES_USER=doflow
POSTGRES_PASSWORD=<strong-password-here>
POSTGRES_DB=doflow

# JWT (genera con `openssl rand -hex 64`)
JWT_SECRET=<64-char-hex-string>

# Public URLs
PUBLIC_API_URL=https://api.tuodominio.com/api
APP_BASE_URL=https://app.tuodominio.com

# Google OAuth (https://console.cloud.google.com/)
GOOGLE_OAUTH_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-<your-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://api.tuodominio.com/api/auth/google/callback

# CORS whitelist
CORS_ORIGINS=https://app.tuodominio.com,https://tuodominio.com

# SMTP (per email transazionali — opzionale)
MAIL_FROM=noreply@tuodominio.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-key>
```

### `apps/backend/.env` (per dev locale)

```bash
PORT=8001
NODE_ENV=development
DATABASE_URL=postgres://doflow:doflow@localhost:5432/doflow
DB_SYNC=false  # USA migrations in production!
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<dev-secret>
JWT_EXPIRES_IN=15m
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
APP_BASE_URL=http://localhost:3000
```

### `apps/frontend/.env`

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-as-backend>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔌 Endpoints API principali

> Documentazione interattiva disponibile a `/api/docs` (Swagger UI auto-generata)

### Autenticazione (pubblici)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login email + password |
| POST | `/api/auth/signup-tenant` | **Crea nuovo tenant + admin owner** |
| GET | `/api/auth/check-slug?slug=acme` | Validazione live slug (rate-limit 30/min/IP) |
| GET | `/api/auth/google` | Avvia Google OAuth flow |
| GET | `/api/auth/google/callback` | Callback OAuth Google |

### Tenant (autenticati)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/tenant/self-service/plan` | Dettagli piano corrente |
| GET | `/api/tenant/self-service/modules` | Moduli attivi + disponibili |
| POST | `/api/tenant/self-service/onboarding/complete` | Salva scelte wizard primo accesso |
| GET | `/api/tenant/self-service/onboarding/status` | Stato onboarding (per redirect) |
| GET | `/api/tenant/self-service/notifications` | Notifiche tenant |
| GET | `/api/tenant/self-service/tickets` | Lista ticket di supporto |

### Enforcement piani/moduli

Le route annotate con `@RequireFeature('module.key')` sono bloccate lato backend se il tenant non ha:

1. tenant attivo in `public.tenants`;
2. `plan_tier` sufficiente rispetto a `public.platform_modules.minTier`;
3. subscription `ACTIVE` o `TRIAL` non scaduta in `public.tenant_subscriptions`.

Esempi già protetti:

- `crm.sales-intel` → `/api/sales-intel/*`
- `ops.kanban` → `/api/projects/*`
- `vert.beauty` → `/api/clienti`, `/api/trattamenti`, `/api/appuntamenti`, `/api/federicanerone/settings`
- `vert.manufacturing` → `/api/businaro/*`

### Superadmin (richiede ruolo `superadmin`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/superadmin/tenants` | Elenco tenant |
| POST | `/api/superadmin/tenants` | Crea tenant manualmente |
| PUT | `/api/superadmin/tenants/:id` | Aggiorna tenant |
| GET | `/api/superadmin/modules` | Gestione moduli piattaforma |
| GET | `/api/superadmin/audit-log` | Audit log globale |
| GET | `/api/superadmin/system/health` | Health system |

---

## 📁 Struttura del progetto

```
Doflow-PaaS/
├── apps/
│   ├── backend/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/                   # Auth module: JWT, Google OAuth, signup
│   │   │   │   ├── google.controller.ts
│   │   │   │   ├── google.strategy.ts
│   │   │   │   ├── signup.controller.ts
│   │   │   │   ├── signup.service.ts
│   │   │   │   └── dto/
│   │   │   ├── superadmin/             # Tenant management, modules, audit
│   │   │   │   ├── entities/
│   │   │   │   ├── tenants.service.ts
│   │   │   │   └── platform-modules.seed.ts  ← Idempotent seeder
│   │   │   ├── tenant/                 # Tenant-scoped APIs
│   │   │   ├── tenancy/                # Multi-tenant middleware & bootstrap
│   │   │   ├── crm/                    # CRM module (contacts, deals)
│   │   │   ├── finance/                # Invoicing module
│   │   │   ├── sales-intelligence/     # Apollo.io integration
│   │   │   ├── migrations/             # TypeORM migrations
│   │   │   │   └── 1714752000000-InitialPublicSchema.ts
│   │   │   ├── telemetry/              # Global exception filter, audit
│   │   │   ├── app.module.ts           # Root module
│   │   │   └── main.ts                 # Bootstrap
│   │   ├── data-source.ts              # TypeORM CLI DataSource
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/                       # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (tenant)/           # Tenant-scoped pages
│       │   │   │   ├── dashboard/
│       │   │   │   ├── crm/
│       │   │   │   ├── invoices/
│       │   │   │   └── ...
│       │   │   ├── login/
│       │   │   ├── signup/             # ← New 3-step wizard
│       │   │   ├── onboarding/         # ← Odoo-style first-login wizard
│       │   │   ├── superadmin/
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   │   ├── ui/                 # Shadcn-style primitives
│       │   │   └── login-form.tsx
│       │   ├── lib/
│       │   │   ├── api.ts              # Fetch wrapper
│       │   │   └── swr-hooks.ts        # ← SWR hooks for tenant data
│       │   ├── middleware.ts           # Auth + tenant routing
│       │   └── styles/
│       ├── public/
│       ├── next.config.mjs
│       └── package.json
├── infra/
│   ├── nginx/                          # Production reverse proxy
│   └── certbot/                        # TLS certs (gitignored!)
├── memory/                             # Project memory (PRD + credentials)
│   ├── PRD.md
│   └── test_credentials.md
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md                           # ← Sei qui
```

---

## 🧪 Testing

### Backend
```bash
# Unit tests
pnpm -C apps/backend test

# E2E tests
pnpm -C apps/backend test:e2e
```

### Frontend
```bash
pnpm -C apps/frontend test          # Vitest (unit)
pnpm -C apps/frontend test:e2e      # Playwright (E2E)
```

### Smoke test API in 30 secondi
```bash
API=http://localhost:4000/api

# 1. Verifica slug disponibile
curl "$API/auth/check-slug?slug=test123"
# {"available":true}

# 2. Crea tenant + owner
TOKEN=$(curl -X POST "$API/auth/signup-tenant" \
  -H "Content-Type: application/json" \
  -d '{"email":"hello@test.com","password":"Test1234!","companyName":"Hello Inc","slug":"hello-inc","planTier":"PRO"}' \
  | jq -r .token)

# 3. Verifica accesso ai moduli
curl "$API/tenant/self-service/modules" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.active | length'
# 14
```

---

## 🗺️ Roadmap

### ✅ Completato (Q2 2026)
- [x] **Iter 1**: Setup ambiente + sicurezza (CORS, rate limit, no tenant-scan, certs sanitizzati)
- [x] **Iter 2**: Self-service tenant signup wizard 3-step + 34 moduli seed
- [x] **Iter 3**: Onboarding Odoo-style + tier-aware feature gating + tenant lookup polimorfo
- [x] **Iter 4**: Google OAuth 2.0 (signup + login)
- [x] **Iter 5a**: SWR hooks + TypeORM migrations scaffold

### 🔄 In progress (Q3 2026)
- [ ] **Iter 5b**: Refactor `app.module.ts` → feature modules
- [ ] **Iter 5c**: Dynamic imports per `/superadmin/*` (riduce First Load JS)
- [ ] **Iter 6**: Refresh token rotation httpOnly cookie
- [ ] **Iter 7**: Stripe billing integration + plan upgrade flow
- [ ] **Iter 8**: Trial countdown banner + email automatica giorno 11
- [ ] **Iter 9**: Hospitality vertical UI completo (calendar, channel manager, kitchen display)

### 📋 Backlog (2026-2027)
- [ ] Dashboard widget marketplace (componenti riutilizzabili tra moduli)
- [ ] Public API + webhooks per integrazioni di terze parti
- [ ] Mobile app (React Native) — clienti, fattura veloce, scansione documenti
- [ ] AI Assistant cross-module ("Mostrami tutte le fatture scadute del cliente X")
- [ ] Marketplace moduli di terze parti (revenue sharing 30/70)
- [ ] Espansione UE (DACH + Iberia, localizzazione fiscale)
- [ ] SOC 2 Type II compliance
- [ ] ISO 27001 certification

---

## 📝 Convenzioni di sviluppo

### Code style
- **TypeScript strict mode** ovunque
- **ESLint** + **Prettier** preconfigurati
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`)
- **PR review obbligatoria** + CI green prima del merge

### Branching
- `main` — sempre deployabile
- `develop` — integrazione feature
- `feat/*` — singole feature
- `fix/*` — bugfix urgenti

### Git workflow per nuova feature

```bash
git checkout -b feat/iter6-refresh-token
# … sviluppa
pnpm lint && pnpm test
git commit -m "feat(auth): add httpOnly refresh token rotation"
git push origin feat/iter6-refresh-token
# Apri PR → review → merge in develop → merge in main → deploy
```

---

## 🔐 Sicurezza

### Disclosure responsabile
Hai trovato una vulnerabilità? Per favore **NON aprire una issue pubblica**. Scrivici a: `security@doflow.it`

### Misure attive
- ✅ HTTPS obbligatorio in produzione (HSTS preload)
- ✅ Cookie `Secure` + `HttpOnly` + `SameSite=Strict` su sessione
- ✅ Content Security Policy (CSP) restrittiva
- ✅ Helmet middleware (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ SQL injection protection via TypeORM parameterized queries
- ✅ XSS protection via React (auto-escape) + DOMPurify per HTML utente
- ✅ CSRF token su mutazioni cross-origin
- ✅ Audit log immutabile di tutte le azioni sensibili
- ✅ Backup automatici Postgres ogni 6h con retention 30gg
- ✅ Secrets in vault (mai in codice o .env committati)

### Privacy & GDPR
- ✅ Data residency EU (server Frankfurt/Amsterdam)
- ✅ DPA (Data Processing Agreement) automatico al signup
- ✅ Diritto all'oblio: endpoint per cancellazione completa tenant
- ✅ Export dati utente in formato JSON conforme GDPR Art. 20

---

## 📜 License

**Proprietary** — © 2026 Doflow Srl. All rights reserved.

Il codice è confidenziale. Non ridistribuire né condividere senza autorizzazione scritta.

---

## 👥 Team & Contatti

- 🌐 **Website**: [doflow.it](https://doflow.it)
- 📧 **Sales**: `sales@doflow.it`
- 🛠️ **Support tecnico**: `support@doflow.it`
- 🔐 **Security**: `security@doflow.it`
- 💼 **Investor relations**: `investors@doflow.it`

---

<div align="center">

### 💚 Built in Italy with ❤️ for Italian SMBs

*"One platform to run them all."*

</div>
