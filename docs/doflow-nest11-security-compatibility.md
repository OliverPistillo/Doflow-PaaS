# Doflow — NestJS 11 security & compatibility checkpoint

Data: 24 agosto 2026. Branch/SHA base:
`main@961c7d0d1886742f9330fad81100a2634596cc02`.

## Obiettivo e perimetro

Il checkpoint elimina `GHSA-36xv-jgw5-4q75` senza modificare UI/UX, schema
PostgreSQL o dati. Node resta `20.19.6`; produzione e account CEO non sono
stati usati. Il login non è stato modificato: i test ne verificano soltanto il
contratto cookie opaco già accettato.

## Baseline dipendenze

| Package | Prima | Dopo |
|---|---:|---:|
| `@nestjs/common`, `@nestjs/core` | `10.4.22` | `11.1.18` |
| `@nestjs/platform-express` | `10.4.22` | `11.1.18` |
| `@nestjs/platform-socket.io`, `@nestjs/platform-ws` | `10.4.22` | `11.1.18` |
| `@nestjs/websockets` | `10.4.22` | `11.1.18` |
| `@nestjs/testing` | `10.4.22` | `11.1.18` |
| `@nestjs/swagger` | `8.1.1` | `11.4.6` |
| `@nestjs/serve-static` | `4.0.2` | `5.0.3` |
| `express`, `@types/express` | `4.22.1`, `4.17.25` | `5.2.1`, `5.0.3` |
| `reflect-metadata` | `0.1.14` | `0.2.2` |

Config `4.0.4`, JWT `11.0.2`, Passport `11.0.5`, TypeORM integration
`11.0.1`, Throttler `6.5.0`, Schedule `6.1.3`, Event Emitter `3.1.0` e BullMQ
integration `11.0.4` restano invariati: i loro peer ufficiali includono Nest
11. `@nestjs-modules/mailer` è assente. Socket.IO `4.8.1`, raw `ws 8.21.3`,
TypeORM `0.3.31` e BullMQ `5.76.5` sono invariati.

L'installazione frozen con `--strict-peer-dependencies` passa. Il lockfile non
contiene package Nest 10. `path-to-regexp` è risolto a sole versioni sicure
`8.4.0/8.4.2`; l'override mirato copre due advisory emerse attraverso Serve
Static senza mascherare la versione runtime.

## Breaking change gestiti

- Express 5: `forRoutes('*')` diventa `forRoutes('{*splat}')`; gli exclude
  `(.*)` diventano wildcard nominati. Il global prefix `/api` resta invariato.
- Il test runtime conferma che public intake e billing webhook restano
  pubblici, Superadmin/self-service/OAuth non ricevono tenancy impropria, le
  route tenant ricevono entrambi i middleware e le route ignote restano 404.
- Il webhook è escluso sia con path prefissato sia senza prefix, conserva il
  buffer raw e verifica una firma sintetica senza provider reale.
- Query/body parsing, ValidationPipe, status, decorator, DI, dynamic/test
  module, Swagger, static files e URL download restano compatibili.
- `app.enableShutdownHooks()` abilita i lifecycle hook; app close, restart e
  health post-restart sono verificati.
- Il filter telemetry non trasmette 4xx come `SYSTEM_ERROR`, trasmette i 5xx e
  non tenta una seconda risposta quando Express ha già inviato gli header.

## Sicurezza e infrastruttura preservate

L'acceptance verifica cookie HttpOnly opaco, Redis, remember-me, rotazione e
revoca, CSRF, MFA pending/setup, OAuth handoff tenant/host-bound, `/auth/me`,
logout, browser senza bearer, Superadmin public/FULL, secondo tenant e header
spoofing. Raw WebSocket verifica origin, sessione, tenant, heartbeat e revoca;
la gateway Nest conserva i test unitari del contratto realtime.

BullMQ esegue un job reale su Redis isolato, ritenta una failure sintetica e
deduplica il `jobId`; le suite permanenti coprono worker readiness, retry,
recovery, Redis assente, scheduler, event emitter e outbox. TypeORM,
schema-per-tenant, `safeSchema`, transazioni, migrazioni 171–184 e
`DB_SYNC=false` restano invariati. La suite permanente pre-179 è inclusa nel
run globale.

## Risultati

| Gate | Risultato |
|---|---|
| install frozen + peer strict | PASS |
| audit production | PASS — 0 critical/high/moderate/low |
| advisory Nest | assente |
| backend Jest completo | PASS — 94 suite, 1074 test, 0 skip/failure |
| backend build | PASS |
| frontend type-check | PASS |
| frontend build | PASS — 220 pagine |
| ESLint file modificati | PASS — `--max-warnings=0` |
| `pnpm acceptance:nest11` | PASS — 3/3 Playwright |
| teardown | PASS — porte e risorse dedicate rimosse |

## Rollback e rischi residui

Il rollback è applicativo: ripristinare insieme manifest, lockfile, backend e
worker all'ultimo SHA approvato. Non esiste una migrazione DB da revertire e
non è consentito un mix Nest 10/11. Restano deprecation non bloccanti già
presenti e l'avviso AWS SDK che versioni pubblicate dopo gennaio 2027
richiederanno Node 22; questa fase mantiene intenzionalmente Node 20.

Il gate RC globale resta separatamente bloccato dal lint globale legacy e
dall'unica evidenza E2E/visual Context E. Nessun deploy è autorizzato.

Verdetto: `NESTJS 11 SECURITY & COMPATIBILITY GO`.
