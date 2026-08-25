# Contratto browser session Doflow

Stato Fase 5A.1: **GO**. Questo documento descrive il contratto web globale;
non autorizza deploy o modifiche infrastrutturali.

## Boundary browser

Il frontend usa esclusivamente `credentials: "include"`, `X-Doflow-Web: 1` e,
per le mutazioni, `X-CSRF-Token`. Non legge, scrive o decodifica JWT. Il server
classifica inoltre come browser le richieste con `Origin` o Fetch Metadata:
omettere l'header proprietario non abilita il bearer. Qualsiasi richiesta
browser che presenta `Authorization` viene rifiutata con
`BROWSER_BEARER_FORBIDDEN`.

Login, invito, signup, MFA e handoff creano o ruotano la sessione server-side e
restituiscono soltanto profilo/stato non sensibile. Il vecchio flusso
Superadmin di impersonation con token in query è disabilitato (`501`) finché
non esisterà un handoff opaco, single-use e auditato.

## Sessione Redis

- ID casuale opaco da 256 bit; nel cookie non sono presenti JWT, tenant, ruolo,
  capability, MFA secret o dati business.
- Chiave `doflow:web-session:<sha256(session-id)>` e indice utente
  `doflow:web-session-user:<sha256(tenant:user-id)>`, senza PII in chiaro.
- Payload server-side: versione, identità tenant-scoped, auth stage
  (`MFA_PENDING`, `MFA_SETUP_NEEDED`, `FULL`), CSRF, creazione, rotazione,
  ultimo accesso, scadenza, remember-me, revoca, hash privacy-safe dello user
  agent e correlation ID.
- TTL sliding: 8 ore senza remember-me; 30 giorni con remember-me. La sessione
  incompleta non supera il gate MFA. Reset password revoca l'indice completo;
  logout elimina la singola chiave e i cookie.

## Cookie e CSRF

| Ambiente | Sessione | CSRF |
|---|---|---|
| locale/test | `doflow_session`, HttpOnly, SameSite=Lax, Path=/ | `doflow_csrf`, leggibile da JS, SameSite=Lax |
| produzione | `__Host-doflow_session`, HttpOnly, Secure, host-only, SameSite=Lax, Path=/ | `doflow_csrf`, Secure, SameSite=Lax; dominio configurabile |

Senza remember-me il cookie è di sessione; con remember-me il `Max-Age` è
coerente con il TTL Redis. Ogni mutazione browser richiede sempre un origin in
`CORS_ORIGINS`. Le mutation session-authenticated richiedono inoltre il
double-submit legato alla sessione. WebSocket usa la stessa sessione nel
handshake, valida l'origin, richiede stage `FULL` e rivalida periodicamente
revoca/scadenza.

Le sole mutation auth che ignorano una sessione cookie eventualmente stale
sono allowlisted per metodo e path esatto:

- bootstrap anonimo: `POST /auth/login`, `/auth/forgot-password` e
  `/auth/signup-tenant`;
- bootstrap con token funzionale: `POST /auth/reset-password`,
  `/auth/accept-invite` e `/auth/handoff/exchange`;
- OAuth bootstrap: `GET /auth/google` e `/auth/google/callback`, che sono metodi
  safe e non usano la vecchia sessione come autorità applicativa.

L'allowlist non comprende prefissi o wildcard. `POST /auth/logout`,
`/auth/mfa/confirm`, `/auth/mfa/verify`, `/auth/handoff` e tutte le altre
mutation protette continuano a risolvere la sessione e a richiedere CSRF.
Il reset password, dopo la validazione del token funzionale, revoca tutte le
sessioni dell'utente; non esiste un endpoint browser separato di revoca globale.

## Topologia produzione

La modalità preferita è API relativa `/api/*` tramite il proxy applicativo:
il cookie `__Host-` resta host-only su `app.doflow.it`. Se il browser chiama
direttamente `https://api.doflow.it`, `CORS_ORIGINS` deve includere esattamente
`https://app.doflow.it`, le credenziali CORS devono restare abilitate e
`WEB_CSRF_COOKIE_DOMAIN=.doflow.it` è necessario affinché l'app possa leggere
il solo cookie CSRF; il cookie sessione resta host-only sul dominio API.

In entrambi i casi `NODE_ENV=production`, HTTPS effettivo e `TRUST_PROXY`
ristretto ai proxy attendibili sono prerequisiti. Cloudflare/Traefik devono
preservare host, origin e protocollo originale. `APP_BASE_URL` e
`TENANT_BASE_DOMAIN` governano la destinazione degli handoff; i codici sono
casuali, hashati in Redis, TTL 90 secondi, host/tenant/stage-bound e single-use.
Nessuna configurazione Coolify, Cloudflare o Traefik è stata modificata in
questa fase.

## Token funzionali ammessi

Reset password e invito restano token opachi monouso; l'handoff è opaco e
single-use; CSRF e access token firmati per file hanno contratti separati. Non
sono bearer di sessione e non sono persistiti come authority auth browser.

## Consumer non-browser preservati

Il backend mantiene il contratto JWT solo quando la richiesta non presenta
`X-Doflow-Web`, `Origin` o Fetch Metadata. Il login API non-browser può
restituire un JWT HS256: stage parziali scadono dopo 15 minuti, stage `FULL`
dopo un giorno; tenant e MFA stage sono verificati dal middleware e dai guard.
L'estrazione avviene soltanto da `Authorization: Bearer`, mai dalla query.

I caller verificati nel repository sono le suite API/integration backend
(`auth-flow-security`, Superadmin access e controller), che provano
separatamente compatibilità, scope e MFA. Non esiste un client bearer nel
bundle frontend. `apps/frontend/src/proxy.ts` usa invece `CRON_SECRET` soltanto
server-to-server per il proxy Next e non importa il client auth browser.

## Gate permanenti

- `pnpm audit:browser-auth`: scansiona runtime frontend, visual gate/spec e
  strategia JWT; blocca storage auth, bearer browser, decode JWT, query token,
  IndexedDB e WebSocket tokenizzato.
- `pnpm acceptance:web-session`: stack locale isolato con PostgreSQL, Redis,
  frontend/backend/WebSocket, due tenant e Superadmin sintetici, Context
  A/B/C/D, restart controllati e teardown ufficiale.
