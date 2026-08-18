<div align="right">

<a href="README.md">🇮🇹 Italiano</a> | 🇬🇧 <strong>English</strong>

</div>

<div align="center">

<img src="apps/frontend/public/doflow_logo.svg" alt="Doflow" width="190" />

# Doflow App

A multi-tenant business platform for coordinating sales, customers, projects, and company operations.

[![Next.js](https://img.shields.io/badge/Next.js-14.2.34-black?logo=nextdotjs)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10.4.22-E0234E?logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)

</div>

## Overview

Doflow is a SaaS/PaaS business application organized as a monorepo. It provides separate tenant workspaces for managing the sales cycle, customer relationships, project delivery, and operational work, together with a control plane reserved for platform administration.

The backend maintains an explicit separation between tenant users and platform superadmins. Tenant data lives in dedicated PostgreSQL schemas; identities, the module catalog, subscriptions, and platform metadata live in the `public` schema.

## Project status

The current branch contains the acceptance baseline for the Doflow operational core: the latest CRM, project, timeline, file/material, administration, and performance flows are present in application code and covered by targeted tests and dedicated visual gates. This does not mean that every historical page or every integration represented by a dependency is available in every environment.

| Area | Repository-verifiable status |
| --- | --- |
| Tenant core | Controllers, services, and interfaces for CRM, projects, operations, administration, resources, and reporting |
| Auth and onboarding | Email/password, Google OAuth, MFA/TOTP, password recovery, invites, tenant signup, and onboarding |
| Platform | Superadmin control plane for tenants, users, modules, subscriptions, observability, and support |
| Integrations | S3-compatible storage, email, Stripe, Google OAuth, Apollo/Gemini, and AI features require providers and environment variables |
| Roadmap | No dated roadmap is treated as implemented state |

The actual availability of a feature also depends on tenant, role, plan, active modules, and environment configuration. The mere presence of a frontend route or SDK does not guarantee that it is enabled in production.

## Main capabilities

- **Sales and CRM** — leads, companies, contacts, opportunities, pipeline, and quotes. For the operational Doflow tenant, the canonical sales model is:

  ```text
  new → contacted → qualified → appointment → quote → closed_won
  lost / paused
  ```

- **Customers and contacts** — records, relationships with opportunities and projects, contextual details, and record operations.
- **Projects and delivery** — projects, members, milestones, tasks, checklists, comments, and files. For Doflow, the canonical stages are:

  ```text
  to_start → materials → design → development → review → publishing → delivered
  paused
  ```

- **Timeline, activities, and communications** — internal notes, activities, appointments, calls, and external messages recorded in the relevant record context.
- **Files, documents, and materials** — tenant documents, record links, project files, and material requests; object operations require configured S3-compatible storage.
- **Administration** — financial views, invoices and receipts, deadlines, renewals, quotes, and contracts, within role permissions.
- **Team and reporting** — members, skills, availability, workloads, time tracking, operational reports, and consultant performance where enabled.
- **Automations, calendar, and knowledge** — automation rules and runs, calendar events and views, articles, assets, and shared templates.
- **Credentials Vault** — credential inventory, expirations, rotations, permissions, and audit, subject to tenant capabilities.
- **Builder and web proposals** — imports, themes, generation, preparation, preview, and proposal export; the Builder surface is restricted to the Doflow tenant, and some processing depends on storage and AI providers.
- **Auth and onboarding** — tenant-aware login, Google OAuth, MFA/TOTP with explicit stages, `/api/auth/me`, password reset, invites, and opaque single-use cross-host handoffs. `rememberMe` consistently selects session or persistent frontend storage.
- **Superadmin** — tenant, user, module, subscription, metrics, audit, support, and platform configuration management through dedicated backend guards.

## Architecture

```text
┌──────────────────────────────────────────┐
│ Next.js 14 / React 18                    │
│ Tenant app + superadmin control plane    │
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
│ public + tenant schema│  │ BullMQ and realtime │
└───────────────────────┘  └─────────────────────┘
               │
               └──── S3-compatible storage, when configured
```

By default, the frontend uses relative `/api/*` requests, which the Next.js configuration forwards to the NestJS backend. The backend resolves the tenant, authenticates the request, applies role/module guards, and operates on the correct PostgreSQL schema.

## Technology stack

The versions below come from the current manifests and PNPM lockfile resolutions.

| Area | Main technologies and versions |
| --- | --- |
| Runtime and workspace | Node.js `20.19.6`, PNPM `10.24.0`, TypeScript `5.6.3`, PNPM Workspaces |
| Frontend | Next.js `14.2.34`, React `18.3.1`, Tailwind CSS `3.4.19`, Radix UI, SWR `2.4.1`, Zod `4.4.3` |
| Backend | NestJS `10.4.22`, TypeORM `0.3.28`, PostgreSQL driver `8.20.0`, Passport/JWT, class-validator |
| Data and jobs | `postgres:16-alpine` image, `redislabs/rebloom:latest` image, BullMQ `5.76.5`, ioredis `5.10.1` |
| API and quality | Swagger/OpenAPI, Jest, ts-jest, Playwright `1.62.1` |
| Configurable integrations | S3-compatible storage, SMTP, Stripe, Google OAuth, Apollo, and AI providers |

The RedisBloom image is currently referenced with the `latest` tag and must not be treated as an immutable version. Likewise, the presence of integration SDKs does not prove that their services are active in a specific deployment.

## Multi-tenancy and security

- **Schema per tenant** — `public.tenants` maps each tenant to its own `schema_name`; operational data stays in the dedicated schema.
- **Tenant resolution** — the authenticated context, host/header, and public directory participate in resolution. For protected routes, the token tenant is authoritative for feature enforcement.
- **Request-isolated pool** — the tenancy middleware applies `search_path` within a transaction and returns the connection to the pool without residual tenant state.
- **Separate roles** — a tenant `owner` is not a superadmin. Platform routes require a superadmin role, the `public` tenant, and a `FULL` auth stage.
- **Backend enforcement** — guards verify authentication, active tenant, capabilities, plan, and module subscription; hiding a UI item is not a sufficient security control.
- **Safe SQL** — query values must be parameterized. Dynamic schema identifiers must pass through centralized validation (`safeSchema`) and must not be derived directly from untrusted input.
- **Auth hardening** — password hashing, rate limiting, MFA/TOTP, partial authentication stages, and opaque handoffs prevent JWTs from being transferred in redirect URLs.
- **Secrets** — credentials, tokens, and keys belong in the runtime environment, not in the repository or its documentation. Never commit real `.env` files.
- **Schema synchronization** — keep `DB_SYNC=false` in production and apply data changes through controlled, idempotent procedures.

Every new query or integration must preserve tenant isolation, backend authorization, and the absence of cross-tenant access.

## Repository structure

```text
.
├── apps/
│   ├── backend/          # NestJS API, tenancy, modules, and jobs
│   └── frontend/         # Next.js application and control plane
├── docs/                 # technical documentation and visual references
├── infra/                # infrastructure and reverse-proxy references
├── scripts/              # operational utilities and visual gates
├── tests/                # Playwright visual tests
├── .env.example          # public catalog of root environment variables
├── docker-compose.yml    # service / local-development reference
├── package.json          # workspace scripts
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Local development

### Requirements

- Node.js `20.19.6` and PNPM `10.24.0` (also declared through Volta in `package.json`);
- PostgreSQL 16 and Redis/RedisBloom, installed locally or started with Docker;
- Docker with Compose, optional but useful for data services.

### Installation

```bash
pnpm install --frozen-lockfile
```

### Environment configuration

Use `.env.example` as the starting inventory and always replace placeholders outside version control.

- For Docker Compose, create `.env` in the repository root.
- To start the backend directly, create `apps/backend/.env` with at least the local PostgreSQL connection, Redis, `JWT_SECRET`, and `DB_SYNC=false`.
- For the frontend, `apps/frontend/.env.local` can define `INTERNAL_BACKEND_URL`; with an empty `NEXT_PUBLIC_API_URL`, the browser uses `/api` and the Next.js rewrite.
- Add OAuth, mail, billing, storage, or AI variables only when the related integration is needed.

Do not copy real `DATABASE_URL` values, passwords, secrets, or provider keys into the READMEs.

### Start

```bash
# Local data dependencies through Compose
docker compose up -d postgres redis

# Only against the configured local database, when needed
pnpm -C apps/backend migration:run

# Frontend and backend in parallel
pnpm run dev
```

With the default ports, the frontend is available at `http://localhost:3000` and the backend at `http://localhost:4000`.

## Build and test

| Command | Purpose |
| --- | --- |
| `pnpm run build:frontend` | Next.js production build |
| `pnpm run build:backend` | NestJS/TypeScript backend compilation |
| `pnpm run build` | Frontend build followed by backend build |
| `pnpm run dev` | Parallel startup of workspace applications |
| `pnpm -C apps/frontend lint` | Frontend lint command defined by its package |
| `pnpm -C apps/backend exec jest --runInBand` | Backend Jest suite through the existing configuration |
| `pnpm run visual:gate:headed` | Local visual gate with manual authentication |
| `pnpm run visual:gate` | Headless visual gate with an existing session |

There is currently no root `test`, `lint`, or `type-check` script: use only the commands actually defined above or in the relevant application package. The frontend lint command is defined, but without an initialized ESLint configuration it opens the interactive setup and is not yet suitable for non-interactive CI execution. The visual gate is intended for screens covered by references in `docs/design-references/` and requires the authorized environment described in that documentation.

## Production

The Doflow operating model is distinct from the Compose files in the repository:

```text
Internet
  → Cloudflare
  → Cloudflare Tunnel
  → Coolify / reverse proxy on the Doflow server
  → frontend, backend, and data services
```

- [app.doflow.it](https://app.doflow.it) — web application;
- [api.doflow.it](https://api.doflow.it) — backend API;
- [doflow.it](https://doflow.it) — separate public website that can integrate with the application.

`docker-compose.yml` and `infra/docker-compose.yml` are service and local-development references; they are not an authoritative description of the live topology. The presence of a service or provider in those files does not prove that it is the mechanism used in production.

## Health and API

The canonical health endpoint is:

```http
GET /api/health/system
```

The probe aggregates API, PostgreSQL, Redis, realtime/WebSocket, and storage status. Swagger is configured by the NestJS bootstrap at:

```text
/api/docs
```

External access to the API documentation depends on deployment rules. This README is not a replacement for a versioned API catalog.

## Public Lead Intake

The module connects the public website to the tenant CRM through:

```text
doflow.it
  → POST /api/public/lead-intake/:tenantSlug
  → contact (and company, when provided) + lead + opportunity + CRM activity
  → tenant notification
```

The backend restricts enabled tenants through configuration, validates the payload and privacy consent, applies origin and abuse controls, and handles the submission reference idempotently. The default integration targets the Doflow tenant; it must not be extended to other tenants without an explicit, verified decision.

## Roadmap

The roadmap evolves with the product. The features described in this README represent only what is verifiable in the current code and configuration; experimental integrations, unconfigured providers, and historical pages are not presented as available capabilities.

## License

**Proprietary — all rights reserved.**

The repository contains no open-source license and grants no rights to reuse, modify, or redistribute the code. Written authorization is required for any use outside authorized development.
