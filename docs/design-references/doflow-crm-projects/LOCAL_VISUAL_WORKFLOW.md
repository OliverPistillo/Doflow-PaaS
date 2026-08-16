# Workflow visuale locale obbligatorio

## Scopo

Il gate visuale confronta le reference con il frontend realmente renderizzato su localhost. Per la Fase 1 navigation shell la modalità standard è frontend-only: Codex orchestra il processo, Next gira localmente e inoltra `/api/*` al backend operativo senza modificare CORS, backend o database.

## SERVER MODE — predefinito per task frontend-only

Architettura:

```text
Playwright/Chromium
  -> http://localhost:3100/api/*
  -> rewrite Next locale
  -> https://api.doflow.it/api/*
```

Il runner crea una build di produzione standalone e avvia soltanto il frontend con:

```text
INTERNAL_BACKEND_URL=https://api.doflow.it
NEXT_PUBLIC_API_URL=
DOFLOW_VISUAL_SERVER_MODE=1
```

La build viene copiata nel runtime temporaneo `.visual-runtime/` usando lo stesso layout del Dockerfile (`.next/standalone`, `.next/static` e `public`) e avviata con `node apps/frontend/server.js` su `localhost:3100`. Il runtime è ignorato da Git e viene eliminato al termine senza toccare `node_modules`.

Usare esattamente `localhost`, non `127.0.0.1`: il flusso login corrente riconosce esplicitamente l'host localhost. Il server mode non usa Docker, WSL, PostgreSQL locale, Redis locale, migrazioni, seed o backend locale.

### Prima autenticazione o sessione scaduta

Dalla root:

```bash
pnpm visual:gate:headed
```

Il comando:

1. verifica Chromium Playwright e la disponibilità della porta `3100`;
2. esegue la build standalone e avvia il server di produzione su `http://localhost:3100` con il proxy verso il backend server;
3. apre Chromium visibile su `http://localhost:3100/login`;
4. attende che Oliver completi manualmente login ed eventuale MFA nella finestra;
5. verifica in memoria tenant `doflow`, ruolo `owner` o equivalente autorizzato e autenticazione completa;
6. salva temporaneamente lo storage state in `.visual-auth/`, cartella ignorata da Git;
7. verifica la sessione tramite `GET /api/auth/me` passando dal proxy locale;
8. esegue la suite Playwright in modalità headed;
9. produce screenshot privacy-safe in `actual/`.

Email, password, OTP, token, cookie e contenuto dello storage state non devono essere inseriti nella chat, stampati o allegati.

### Gate headless con sessione valida

```bash
pnpm visual:gate
```

Il comando riusa `.visual-auth/storage-state.json`, avvia il solo frontend e lancia la suite headless. Se la sessione manca, non è valida, è scaduta o riceve `401/403`, restituisce:

```text
VISUAL BLOCKED — authentication required
```

e richiede un nuovo `pnpm visual:gate:headed`.

Per eliminare esplicitamente la sessione locale temporanea:

```bash
pnpm visual:gate:auth:clear
```

`.visual-auth/` va trattata come segreto: non versionare, non stampare, non allegare e non includere nei report.

## Firewall read-only

Dopo il login, per ogni richiesta `/api/*` sono consentiti soltanto:

```text
GET
HEAD
OPTIONS
```

Durante il solo flusso headed di autenticazione sono inoltre consentiti i `POST` necessari a:

```text
/api/auth/login
/api/auth/mfa/*
/api/auth/refresh
```

Qualunque altra richiesta `POST`, `PUT`, `PATCH` o `DELETE` viene interrotta e fa fallire il gate. Il log del blocco contiene soltanto metodo, pathname e motivo; non contiene body, token, cookie, header o dati cliente.

Il gate non clicca azioni mutative come Salva, Invia, Completa, Registra, Archivia, Elimina, Crea, Carica, drag-and-drop, cambi di stato o azioni finanziarie. Il normale audit di login/MFA è l'unica mutazione accettata.

## Privacy e artefatti

In server mode sono disabilitati:

- trace Playwright;
- HAR;
- video;
- screenshot automatici dei fallimenti;
- dump di rete;
- logging di header e body API.

Prima degli screenshot la suite maschera:

- contenuto principale;
- email/account e avatar nella sidebar/topbar;
- notifiche;
- dati personali, finanziari e cliente presenti nel contenuto.

Gli screenshot conservano soltanto le informazioni necessarie a validare sidebar, topbar, logo, ordine delle sezioni, active state, responsive e navigazione Impostazioni. `actual/` e `diff/` sono ignorate da Git; le reference PNG non devono essere modificate.

File attesi per la Fase 1:

```text
actual/navigation-commercial-desktop.png
actual/navigation-projects-desktop.png
actual/navigation-settings-desktop.png
actual/navigation-tablet.png
actual/navigation-mobile.png
```

Viewport:

```text
commerciale desktop 1672x941
progetti desktop    1675x939
tablet              1024x768
mobile              390x844
```

## Verifiche della navigation shell

La suite controlla in sola lettura:

- `/companies` e le voci Commerciale;
- `/projects`, `/projects/timeline`, `/projects/tasks`, `/projects/files` e i relativi active state;
- `/settings`, `/settings/users`, `/settings/integrations`, `/settings/security`, ordine e assenza della navigazione superiore duplicata;
- `/commercial/site-proposals`, `/projects/milestones`, `/work`, `/calendar`, `/documents` come route legacy nascoste dal menu e soggette ai permessi;
- apertura, chiusura, scroll, leggibilità e assenza di overflow critico su desktop, tablet e mobile.

Il confronto visuale usa almeno:

```text
references/client-overview.png
references/project-overview.png
```

Il contenuto centrale reale può differire ed è mascherato. Il giudizio riguarda sidebar/topbar bianche, logo, sfondo, gerarchia, ordine, etichette, icone, active state lilla, spacing, larghezze, bordi, ombre, responsive e assenza delle tab Impostazioni duplicate. Il pixel diff è soltanto uno strumento di supporto.

## Stati del gate

- `VISUAL GO — FASE 1 navigation shell`: browser reale eseguito, sessione doflow/ruolo verificati, nessuna mutazione inattesa, cinque screenshot prodotti, desktop/tablet/mobile verificati e nessuna differenza critical/major.
- `VISUAL NO-GO — FASE 1 navigation shell`: browser test realmente eseguito e differenze critical/major osservate.
- `VISUAL BLOCKED — FASE 1 navigation shell`: autenticazione non completabile, backend/proxy non raggiungibile, Chromium non eseguibile o screenshot non producibili.

Non usare `NO-GO` per un test mai eseguito.

## Evidenze nel report

Il report deve indicare URL localhost, proxy, modalità auth, tenant/ruolo/stage verificati senza dati identificativi, route, viewport, reference, screenshot realmente prodotti, differenze classificate, test/build, rischi residui e stato Git. Deve inoltre confermare che non sono stati eseguiti commit, push, merge, deploy, Docker, WSL, migrazioni o seed.
