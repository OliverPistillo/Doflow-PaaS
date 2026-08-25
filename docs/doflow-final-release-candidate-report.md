# Doflow replacement — report finale Fase 5A.5

Data del gate: 24 agosto 2026. Ambiente: stack locale isolato. Questo report
documenta una Release Candidate; non documenta né autorizza un deploy.

## 1. Branch e SHA

`main` a `961c7d0d1886742f9330fad81100a2634596cc02`.

## 2. Working tree iniziale e finale

Preflight iniziale: 316 file tracked modificati, 3 eliminati, 258 file
untracked individuali, 0 staged. Stato finale previsto dopo il presente
report: 320 modificati, 3 eliminati, 267 untracked individuali, 0 staged. Le
modifiche precedenti sono state preservate; nessun reset/clean/stash/restore
globale è stato eseguito.

## 3. Orchestratore finale

`pnpm acceptance:final` orchestra static gate, rehearsal pre-179, stack
PostgreSQL/Redis/MinIO/backend/frontend, suite browser, visual QA,
migration/mapper/seed replay, backup/restore, evidence e teardown.

## 4. Fixture

Fixture deterministiche `.invalid`: owner, manager, utente limitato, ruoli
operativi, secondo tenant, Superadmin `public/FULL`, team/capability e record
collegati. Tutti i dati business sono creati via PostgreSQL/server; nessuna
fixture browser è autorevole.

## 5. Context A

Owner Doflow: login/MFA, cookie opaco, workflow globale e persistenza dopo
refresh/restart/nuovo context passati.

## 6. Context B

Manager stesso tenant: sessione indipendente, realtime, menzioni, QA e azioni
capability-scoped passati.

## 7. Context C

Utente limitato: payload economici redatti lato backend e mutazioni finance,
Builder, automazioni e Superadmin negate coerentemente.

## 8. Context D

Secondo tenant: auth/MFA, shell compatibile, dati propri e zero accesso o
scrittura cross-schema passati.

## 9. Context E

Superadmin sintetico: anonimo/sessione invalida `401`; owner/admin/manager,
Superadmin tenant-scoped e MFA pending `403`; `public/FULL` consentito. Dieci
API non distruttive, nove superfici, shell separata e revoca logout passati.

Verdetto: `SUPERADMIN CONTEXT E GO`.

## 10. Auth matrix

Password, anti-enumerazione/rate limit, MFA stage/TOTP, remember-me,
Google/handoff sintetici, logout/revoca/expiry, forgot/reset, invito, CSRF,
Origin, WebSocket cookie e assenza bearer browser coperti dai gate backend,
web-session e globali.

## 11. Public intake

Submission ID, idempotenza, tenant allowlist, attribution UTM/click sintetica,
lead/opportunity/activity/timeline/notifica, rate limit e payload invalido
verificati.

## 12. Workflow globale

143 operazioni integrate hanno attraversato Commercial, Document, Commerce,
Delivery, Collaboration e Performance nello stesso stack persistente.

## 13. Builder

Builder preservato in `/commercial/site-proposals/*`; preparazione artifact,
storage, BullMQ, persistenza/restart e capability negativa verificati.

## 14. Delivery e QA

Sette tab canoniche, fase/task/dipendenza/timer, complete/reopen, QA,
request-changes/approve/publish/deliver/support, History e restart passati.

## 15. Commerce e Finance

Catalogo, vendita, ordine/snapshot, progetto da ordine, pagamenti, rimborso,
preventivo, contratto, fattura, nota di credito e rinnovo verificati con
calcoli server-side e redazione capability.

## 16. Collaboration

Commento, risposta, reazione, resolve/reopen, allegato, History, notifica,
deep link, read state, WebSocket reconnect e dedupe passati.

## 17. Automation e Performance

Regola/versione, BullMQ, dedupe, adapter disabilitato, retry sintetico, ledger
append-only, compensazione, ranking snapshot, badge e Missione passati.

## 18. Route legacy

Quattordici redirect legacy verificati con URL diretto, destinazione canonica,
query quando richiesta, assenza loop, Back, refresh e autorizzazione.

## 19. Vecchia UI

La vecchia UI non viene renderizzata nel tenant `doflow`; il dettaglio
progetto usa la route Daniele full-page a sette tab. Builder resta escluso dai
redirect. Il secondo tenant conserva il comportamento compatibile.

## 20. Tenant isolation

Sessione, schema, API, UUID/IDOR, notification/realtime, storage, finance e
Superadmin verificati fra `doflow`, secondo tenant e scope `public`.

## 21. Superadmin

Control Room separata dalla shell tenant, refresh e Back stabili, dati
control-plane sintetici e sole operazioni non distruttive.

## 22. Idempotenza

Risultato globale `true`: doppio submit/Idempotency-Key non duplica record,
audit, timeline, notifiche, job, ledger o snapshot nelle operazioni sensibili.

## 23. Concorrenza

Risultato globale `true`: optimistic version/conflitto, numerazioni, saldi,
timer, QA, versioni e ranking non producono lost update o duplicati.

## 24. Restart e resilienza

Restart frontend/backend/Redis, session contract, cache loss, worker/BullMQ,
timer, notifiche persistenti e WebSocket reconnect verificati.

## 25. Visual gate

Frontend reale `http://localhost:3100`, backend isolato
`http://localhost:3401`, reference Daniele a SHA `e6c3ef5…`, temi chiaro/scuro
e viewport `390×900`, `768×900`, `1440×900`.

Verdetti: `GLOBAL VISUAL GO` e `VISUAL GO`.

## 26. Screenshot

121 PNG in
`docs/design-references/doflow-crm-projects/actual/final-rc`. Copertura:
route canoniche, deep link, dialog ordine/select, contratto, access denied e
Control Room. Nessun diff separato necessario; nessuna differenza critica o
maggiore residua.

## 27. Accessibilità

118 controlli: semantica/ARIA, focus, tastiera, Escape, focus trap, alternativa
al drag, sidebar mobile, dialog title/description, loading/error/access denied.

## 28. Audit autorità browser

Zero bearer browser, business local/session storage, IndexedDB business,
fixture production autorevoli, mutazioni client-only, ranking client-side o
simulazione Automation/Timeline/History.

## 29. Dependency e security audit

PASS: 1044 dipendenze, 0 critical/high/moderate/low; secret scan 1110 file con
0 hit; 0 `.env` tracciati, 0 Client Portal, 0 hostname produzione negli script
acceptance, 0 code execution arbitrario e review CSP/upload/signed URL/log
redaction verde.

## 30. Health

10/10 probe firmati verdi durante i domini e il visual gate.

## 31. Backend suite/test

95/95 suite Jest e 1076/1076 test, zero failure; build backend passata.

## 32. Frontend test

14/14 test Node/unit e type-check passati.

## 33. Lint

Due esecuzioni globali ESLint `--max-warnings=0`: 0 errori, 0 warning.

## 34. Build

Backend NestJS 11 ed export frontend Next.js 16 passati; 220 pagine statiche
e 237 route applicative rilevate.

## 35. Migrazioni e seed

True pre-179 rehearsal: baseline 178, apply 179–184, secondo apply senza
pending, dry/apply/apply mapper, doppio seed, backup/replay/restore,
reconciliation e fault rollback. Max migration finale: `1840000000000`.

## 36. CEO preservation

Due identità direzionali esclusivamente sintetiche: `PRESERVED=2`, mirror 2,
membership 2 e capability complete. Account reali non letti né modificati.

## 37. Bug trovati e corretti

- orchestration: stack/porte ripuliti prima dei gate statici e health retry;
- health: probe firmato HMAC e test di firma/replay;
- fixture: ID direzionali sintetici univoci;
- Nest config: eliminata la seconda esecuzione involontaria di web-session;
- Commercial MFA: finestra TOTP sicura e retry limitato sotto carico;
- Automation: readiness asincrona con timeout diagnostico;
- visual: input data, Select ordine e dettaglio contratto verificabili;
- access denied: heading semantico reale;
- console: rimosso preload logo non consumato;
- visual tracker: boundary ripristinato su browser Back e navigazione frame;
- Superadmin: regressione reload dedicata;
- final evidence: query corretta a `public.doflow_migrations` con audit
  permanente che vieta `public.migrations`.

Ogni fix è minimo e coperto dal gate coinvolto; nessuna nuova feature o
migrazione è stata introdotta.

## 38. Evidence

`.visual-runtime/doflow-final-release-candidate-result.json` contiene il
verdetto `GO`, è ignorato da Git e privo di password, cookie, token, CSRF, MFA
secret, OTP, connection string e PII reale.

## 39. Documentazione

Aggiornati manifest RC, runbook, closure matrix, route parity matrix, visual
acceptance e questo report.

## 40. Rischi residui

Working tree non ancora immutabile; infrastruttura/secret/capacità/DNS/TLS e
provider live richiedono cutover separato; Node 20 e deprecation inventariate
restano vincoli operativi non bloccanti.

## 41. Punti non verificati

Nessuna verifica o scrittura in produzione; nessun provider reale; nessun
deploy; nessun test distruttivo su tenant/account reali. Questi punti sono
intenzionalmente demandati al preflight/cutover autorizzato.

## 42. Teardown

Browser, Playwright, frontend/backend/worker/scheduler e servizi acceptance
chiusi; credenziali/config/PID/storage state temporanei e sole risorse Docker
dedicate rimossi. Evidence e screenshot non sensibili preservati.

## 43. Porte finali

`3100`, `3401`, `55432`, `56379`, `59000`: chiuse.

## 44. Docker finale

Zero container, network e volumi con prefisso acceptance. `doflow-nginx` è
stato soltanto ispezionato in read-only e non è stato usato dal gate.

## 45. Git/deploy

Nessun staging, commit, push, merge, deploy o autodeploy eseguito.

## 46. Produzione e CEO reali

Nessuna migrazione/seed/scrittura produzione e nessuna modifica agli account
CEO reali.

## 47. Reference

Reference `master` a `e6c3ef5920773afc14b3caff88cfe4027400c54b`,
pulita, read-only, non staged, non gitlink e non modificata.

## Verdetto finale

`DOFLOW REPLACEMENT RELEASE CANDIDATE GO`

## Addendum Fase 5B.1A — RC stability gate

La diagnosi del fallimento 5B.1 è stata resa deterministica. Il provider
commerciale subordinava l'intera shell, incluso `<main>`, a un bootstrap
monolitico che attendeva insieme dati essenziali e secondari. Sotto cold start,
il provisioning schema ripetuto per richiesta causava contesa sui cataloghi
PostgreSQL e sul pool, portando Document Revenue oltre 20 secondi; errori
secondari assorbiti potevano lasciare il loader “Sincronizzazione workspace”
attivo indefinitamente.

La correzione separa `shell ready`, `workspace ready` e `secondary data ready`.
La shell autenticata monta sempre `<main>` con marker semantici testabili; i
dati essenziali governano la readiness della route, mentre aggregati,
documenti, KPI, automazioni e notifiche usano loading/error/retry controllati
senza bloccare la shell. Il provisioning riuscito è deduplicato per
DataSource/schema/contesto; i fallimenti restano ritentabili. Non sono state
aggiunte migrazioni o feature e non sono stati modificati login visuale, MFA,
capability, route canoniche, sette tab, Builder o reference.

Profilo mirato prima/dopo:

- bootstrap riprodotto: `<main>`/workspace circa 21,6–22,6 s; Document Revenue
  circa 20,3–21,1 s;
- cold start corretto: `<main>` 302 ms, workspace 1.104 ms, secondary ready
  2.184 ms; 27 richieste, p50 160 ms, p95 847 ms, massimo 1.074 ms;
- warm start corretto: `<main>` 285 ms, workspace 370 ms, secondary ready
  466 ms; 26 richieste, p50 49 ms, p95 154 ms, massimo 230 ms.

Le regressioni mirate sono verdi: readiness Playwright 4/4, readiness Node
7/7, provisioning backend 7/7 ed evidence/orchestratore 15/15. Il CORS locale
rifiuta ora un'origine estranea con `403`, senza allow-origin, `500` o
`SYSTEM_ERROR`. `pnpm acceptance:superadmin` è autonomo; l'orchestratore salva
checkpoint atomici incrementali, preserva evidence parziali, tenta sempre
Context E e teardown e richiede due run consecutivi sulla stessa working tree.

Il verdetto 5B.1A non viene anticipato da questo addendum: la fonte conclusiva
è `.visual-runtime/doflow-rc-stability-result.json`, valida soltanto dopo due
`pnpm acceptance:final` completi e consecutivi da stack vuoto.

I primi tentativi del doppio run hanno inoltre individuato una regressione
deterministica sui permessi parziali: `web_developer` e `project_manager`
erano autorizzati al progetto, ma il bootstrap core richiedeva comunque dati
lead o attività CRM non concessi al rispettivo ruolo; il `403` estraneo alla
route rendeva l'intero workspace non ready. Ogni lettura core è ora
capability-aware e non viene emessa quando il relativo bounded context non è
autorizzato, senza mascherare un eventuale `403` inatteso per un'identità che
dichiara quella capability. Il gate Collaboration isolato è tornato verde
(1/1, 29,5 s) con marker workspace ready e screenshot desktop/tablet/mobile;
il Context globale verifica lo stesso marker per il project manager. La coppia
globale mirata, eseguita dopo tutti i propri prerequisiti, passa 1/1 in 34,0 s.
La coppia finale viene quindi riavviata da zero sulla working tree aggiornata e
congelata.
