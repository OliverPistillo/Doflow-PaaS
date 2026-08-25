# Doflow replacement closure matrix

Audit locale del 21 agosto 2026 contro la reference read-only
`doflow-gestionale-reference` a SHA
`e6c3ef5920773afc14b3caff88cfe4027400c54b`.

Legenda stato:

- `API`: lettura e mutazione primaria disponibili nel backend NestJS.
- `Server Core`: PostgreSQL è autorevole per la funzione del bounded context indicato; il
  provider conserva soltanto cache/optimistic state con rollback.
- `Misto`: la route usa API, ma almeno una mutazione resta autorevole nel provider React.
- `Gap`: contratto backend, capability o E2E richiesto non è completo.

## Gate trasversale Fase 5A.4

Il lint globale frontend è stato chiuso il 24 agosto 2026. La baseline reale
era 0 errori e 673 warning in 153 file; `pnpm lint:frontend:strict` analizza
l’intera `apps/frontend` con ESLint 9 e `--max-warnings=0` e termina con 0
errori/0 warning in due esecuzioni stabili. Nessuna regola, plugin o directory
è stata esclusa; nuovi disable e ignore sono zero. Type-check, 14/14 test Node
frontend, otto audit statici e build frontend/backend sono verdi. Dettaglio ed
evidence: `docs/doflow-global-frontend-lint-zero-report.md` e
`.visual-runtime/global-frontend-lint-result.json`.

Le capability indicate sono i confini osservati. `tenant JWT` significa che la
route è protetta e tenant-scoped, ma non prova da sola l'autorizzazione fine
richiesta dall'acceptance.

| Superficie reference | Route Doflow | API / servizio backend | Confine capability | Stato verificato | Gap residuo |
|---|---|---|---|---|---|
| Login | `/login` | `/api/auth/login`, session-stage, MFA | auth reale + Redis | API | Suite visuale login/MFA passata prima delle route applicative |
| Dashboard | `/dashboard` | `/api/tenant/doflow/commerce/economics` e summary bounded contexts | valori commerce globali/assegnati dalla sessione | Server Core Commerce | trend e KPI di Fase 3A aggregati in PostgreSQL; fiscalità/ricorrenze escluse alla Fase 3B |
| Commerciale | `/dashboard/commercial` | `/api/tenant/commercial/*`, CRM, commerce e collaboration | capability Commercial Core dalla sessione | Server Core | provider ancora ampio per domini fuori scope |
| Lead | `/dashboard/commercial/leads` | `POST /api/tenant/commercial/leads`, `/api/tenant/crm/opportunities` | create/view assigned/view all/edit/assign/value | Server Core | export Google Contatti fuori scope |
| Lead detail | `/dashboard/commercial/leads/[leadId]` | CRM opportunity/activity, attribution e timeline | capability record-scoped | Server Core | flusso lead→vendita completo fuori scope |
| Pipeline | `/dashboard/commercial/pipeline` | `/api/tenant/commercial/pipeline/:id/transition`, `/pipeline/reorder` | edit assigned/assign | Server Core | smoke browser isolato multi-sessione passato il 21 agosto 2026 |
| Clienti | `/dashboard/clienti` | CRM companies/contacts + `/api/tenant/commercial/customers/:id` | view/edit customers, archive | Server Core | conversione e visibilità multi-sessione isolate passate il 21 agosto 2026 |
| Cliente detail | `/dashboard/clienti/[clientId]` | CRM, Delivery e `/api/tenant/doflow/commerce/economics/customer/:id` | confini record-scoped per dominio + redazione economica backend | Server Core per amministrazione Commerce | documenti/assistenza e domini Fase 3B restano separati; sette tab reference preservate |
| Attività | `/dashboard/attivita` | CRM activities + `/api/tenant/commercial/activities/reorder` | view activities/edit assigned/edit customers | Server Core | approvazione lavoro progetto e QA fuori scope |
| Progetti | `/dashboard/progetti` | `/api/tenant/delivery/projects` + generazione da ordine Commerce | capability Delivery record-scoped e `canGenerateProjectFromOrder` | Server Core | doppia generazione ordine→progetto verificata idempotente in isolamento |
| Progetto detail / QA | `/dashboard/progetti/[projectId]` | Delivery Core + `/api/tenant/doflow/commerce/economics/project/:id` | capability Delivery record-scoped e finance backend | Server Core | sette tab Daniele canoniche preservate; Pagamenti usa ordini/movimenti reali e dichiara indisponibile la Fase 3B |
| Catalogo | `/dashboard/catalogo` | `/api/tenant/doflow/commerce/categories`, `/services` e children | view/manage catalog backend | Server Core | fixture non importate; piani, extra e promozioni corrispondenti alla reference sono snapshot server |
| Vendite | `/dashboard/vendite` | `/api/tenant/doflow/commerce/sales` | view/manage own/global sales backend | Server Core | vendita distinta da opportunità e ordine; E2E vendita→ordine passato in isolamento |
| Ordini | `/dashboard/ordini[/id]` | `/api/tenant/doflow/commerce/orders`, `/project`, `/history` | view/manage own/global orders, generate project | Server Core | codice, prezzi, sconti, imposte, totali, stato economico e snapshot sono server-authoritative |
| Pagamenti | `/dashboard/pagamenti` | `/api/tenant/doflow/commerce/payments`, `/refunds`, `/economics` | record/refund/allocation/global values backend | Server Core | pagamenti confermati, rimborsi separati, allocazioni e redazione provati nei tre context isolati |
| Preventivi | `/dashboard/preventivi` | briefing/quotes APIs | tenant JWT | Misto | doppia versione→accettazione non provata E2E |
| Fatture | `/dashboard/fatture` | `/api/tenant/finance/invoices` | finance permission service | API | nota di credito e limiti negativi non provati end-to-end |
| Contratti | `/dashboard/contratti` | `/api/tenant/contracts` | tenant JWT | Misto | creazione versione resta client-only; firma E2E assente |
| Rinnovi | `/dashboard/rinnovi` | `/api/tenant/finance/renewals` | finance permission service | Misto | attiva/reminder/genera ordine/archivia client-only |
| Campagne | `/dashboard/campagne` | `/api/tenant/doflow/commerce/campaigns`, `/api/tenant/commercial/leads/:id/attribution` | view/manage campaigns + edit lead | Server Core | adapter Meta/Google non configurati restano indisponibili; nessuna metrica esterna inventata |
| Documenti | `/dashboard/documenti` | `/api/tenant/documents` + MinIO | document permission service | Misto | alcune mutazioni cliente client-only |
| Archivio | `/dashboard/archivio` | `/api/tenant/commercial/archive/:resource/:id[/restore]` | `canManageArchive` + record scope | Server Core per record commerciali | bounded context non commerciali ancora misti |
| Duplicati | `/dashboard/duplicati` | `/api/tenant/commercial/duplicates`, `/decision`, `/merge` | inspect/merge duplicates | Server Core | smoke browser isolato con merge idempotente e secondario archiviato passato il 21 agosto 2026 |
| Automazioni | `/dashboard/automazioni` | `/api/tenant/automations` + BullMQ | tenant JWT | API | catena business completa e dedupe E2E assenti |
| Notifiche | `/dashboard/notifiche` | `/api/tenant/notifications` | tenant JWT | Misto | quattro mutazioni di stato client-only |
| Scadenze | `/dashboard/scadenze` | `/api/tenant/calendar/deadlines` | tenant JWT | API | test browser completo assente |
| Impostazioni | `/dashboard/impostazioni` | identity/preferences/goals | Doflow capability service | Misto | commerce settings client-only |
| Builder | `/commercial/site-proposals` | `/api/tenant/commercial/site-proposals` + MinIO + BullMQ | `TenantSiteProposalsDoflowGuard` | API | visual/E2E completo e negative capability browser non passati |
| Redirect legacy | `/pipeline`, `/companies`, `/projects`, ecc. | layout tenant redirect | tenant `doflow` only | API | smoke osservato, matrice Playwright legacy non aggiornata |

## Commercial Core — matrice di autorità

| Funzione | Route / componente | Hook / client | Endpoint | Controller / service | Tabelle | Capability | Test identificabile | Stato / residuo |
|---|---|---|---|---|---|---|---|---|
| Creazione lead | `/dashboard/commercial/leads`, provider composition | `commercialApi.createLead` | `POST /tenant/commercial/leads` | `TenantCommercialCoreController` / `createLead` | companies, contacts, leads, opportunities, attribution, history, outbox | create, assign, campaigns | `tenant-commercial-core.service.spec.ts` | Server Core; unica transazione/idempotency |
| Lista/dettaglio/ricerca/filtri | lead list/detail | cache vuota + `commercialApi.opportunities` | `GET /tenant/crm/opportunities[/:id]` | `TenantCrmController` / `TenantCrmService` | opportunities + company/contact/lead/attribution | view all o assigned; value redaction | `tenant-crm.service.spec.ts` | Server Core |
| Modifica/assegnazione/next action | lead detail/pipeline | `commercialApi.updateOpportunity` | `PATCH /tenant/crm/opportunities/:id` | CRM controller/service | opportunities, commercial_history, audit_log, outbox | edit assigned/global, assign, values | `tenant-crm.service.spec.ts` | Server Core; optimistic version |
| Transizione pipeline | pipeline board | `commercialApi.transitionOpportunity` | `PATCH /tenant/commercial/pipeline/:id/transition` | core controller/service | opportunities, idempotency, history, audit, outbox | edit assigned/global | `tenant-commercial-core.service.spec.ts` | Server Core; no-op senza evento |
| Riordino pipeline | pipeline board | `commercialApi.reorderPipeline` | `PATCH /tenant/commercial/pipeline/reorder` | core controller/service | opportunities + history/audit/outbox | edit record | `tenant-commercial-core.service.spec.ts` | Server Core; transazionale |
| Azienda/cliente aggregato | clienti/detail | `commercialApi.companies`, `customerAggregate` | CRM companies + `GET /tenant/commercial/customers/:id` | CRM/core service | companies + relazioni | view/edit customers, value visibility | CRM/core specs | Server Core |
| Contatti/primario | cliente detail | CRM client + `setPrimaryContact` | contacts CRUD + `POST .../primary` | CRM/core service | contacts | edit customers | CRM/core specs | Server Core; vincolo un primario |
| Comunicazioni | cliente detail | `commercialApi.communications` | `GET/POST/PATCH /tenant/commercial/...communications` | core service | commercial_communications, commercial_activities, history/outbox | view/edit customers | core spec + timeline spec | Server Core |
| Attività dirette/appuntamenti | attività/detail/kanban | CRM activities + `reorderActivities` | CRM activity CRUD + `PATCH /tenant/commercial/activities/reorder` | CRM/core service | commercial_activities | view/edit assigned/customers, archive | core/CRM/timeline specs + frontend audit | Server Core; workflow di produzione escluso |
| Conversione | pipeline board | `commercialApi.convertOpportunity` | `POST /tenant/commercial/leads/:id/convert` | core service | company/contact/lead/opportunity/activity/attribution/idempotency/history/outbox | edit lead + edit customers | core spec | Server Core; transazionale/idempotente |
| Duplicati/decisioni | duplicati page | `useCommercialDuplicates` | `GET /duplicates`, `POST /duplicates/decision` | core service | duplicate_decisions, idempotency, history/outbox | inspect duplicates | core spec + `commercial-core-frontend.test.mjs` | Server Core; query abort/invalidation |
| Fusione | comparison sheet | `commercialApi.mergeDuplicates` | `POST /duplicates/merge` | core service | record CRM e riferimenti, duplicate decisions/history/outbox | merge duplicates | core spec | Server Core; omogenea e lead↔cliente, secondario archiviato |
| Campagne/attribution | campagne + lead detail | commerce API + `updateAttribution` | campaigns CRUD + `PATCH /leads/:id/attribution` | commerce/core service | campaigns, commercial_attributions | view/manage campaigns + edit lead | core spec | Server Core; modello dichiarato `manual_last_touch` |
| Public intake | form pubblico | API pubblica | `POST /public/lead-intake/:tenantSlug` | public intake service | company/contact/lead/opportunity/attribution/activity/submission/history/outbox | allowlist/rate limit/idempotency | `public-lead-intake.service.spec.ts`, CRM pipeline spec | Server Core; nessun IP grezzo nel CRM |
| Timeline/History | lead/cliente panel | timeline API | tenant timeline routes | timeline/core/CRM services | commercial_activities, audit_log, commercial_history, outbox | capability record + finance redaction | timeline/core/CRM specs | Server Core; actor/timestamp/correlation server-side |

## Commercial Core — evidenza runtime isolata

Acceptance locale eseguita il 21 agosto 2026 con PostgreSQL, Redis e storage
dedicati, backend NestJS su `localhost:3401` e frontend Next.js su
`localhost:3100`. Il bootstrap rifiuta database/Redis non locali, imposta
`DB_SYNC=false` e usa soltanto tenant e utenti sintetici `.invalid`. La suite
riproducibile è:

```text
pnpm acceptance:commercial
```

La suite Playwright `tests/acceptance/commercial-core-isolated.spec.ts` usa tre
browser context distinti e ha verificato:

- cookie sessione HttpOnly, CSRF browser, record Redis tenant-scoped con TTL e
  revoca logout; nessun bearer o fallback demo nel browser;
- creazione/modifica/assegnazione/transizione lead via UI, refresh completo,
  nuovo browser context e persistenza dopo riavvio separato di frontend e
  backend;
- seconda sessione autorizzata sul tenant `doflow` con modifica osservata dal
  primo utente dopo refresh;
- conversione e merge ripetuti con la stessa Idempotency-Key: un cliente, un
  registro completato, un history e un outbox per operazione; secondario
  archiviato e restore indipendente rifiutato;
- intake pubblico ripetuto con lo stesso `submission_id`: una submission e una
  attribution, senza IP grezzo nei campi persistiti;
- tenant sintetico secondario isolato anche contro spoofing via header, body e
  query; conteggi cross-schema `0` in entrambe le direzioni;
- nessuna collezione Commercial Core autorevole in `localStorage`.

I conteggi PostgreSQL dell'ultimo run verde hanno rilevato `1` lead canonico,
`1` cliente, `1` registry/history/outbox per conversione, `1` per merge, `1`
submission intake e `1` attribution; nessuna copia cross-tenant. Il report
runtime non sensibile resta in
`.visual-runtime/commercial-core-acceptance-result.json` (directory ignorata).

## Provider audit

`scripts/audit-commercial-provider.mjs` risolve anche i helper richiamati dalle
azioni esposte. Risultato corrente:

Prima della fase: `11.679` righe, `128` azioni, `57` mutazioni client-only.

Dopo la fase: `10.393` righe e `128` azioni; l'audit statico riporta `27`
mutazioni client-only, tutte classificate fuori dal bounded context Commercial
Core (notifiche, commerce settings, contratti/rinnovi, export esterno,
approvazione lavoro di progetto, documenti, onboarding/QA/delivery, care/finance
e linking attività-progetto). Le mutazioni client-only Commercial Core residue
sono `0`. Tipi e adapter server sono stati estratti in moduli separati; la cache
Commercial Core parte vuota e non usa persistenza browser.

## Evidenza visuale diagnostica storica

- Cliente:
  `docs/design-references/doflow-crm-projects/actual/closure-new-client-detail-diagnostic.png`
  (`1274x995`, full-page diagnostico)
- Progetto:
  `docs/design-references/doflow-crm-projects/actual/closure-new-project-detail-diagnostic.png`
  (`1280x720`, viewport diagnostica)

Questa diagnosi aveva classificato come `NO-GO` la presenza di sette tab perché
la confrontava con il pannello condiviso a quattro tab della precedente
esperienza Doflow. La decisione è conservata come traccia storica ma è
**SUPERATA**: Oliver ha ordinato la sostituzione completa con il gestionale di
Daniele e il codice della reference read-only al commit
`e6c3ef5920773afc14b3caff88cfe4027400c54b` rende canoniche le sette tab del
dettaglio progetto. Il tema e la sovrapposizione della sidebar erano problemi
separati, poi corretti e verificati nella visual QA Delivery.

## Delivery Core — baseline di autorità prima della Fase 2

Inventario acquisito il 21 agosto 2026 prima di modificare il bounded context
Delivery. La reference read-only usa i quindici stati produttivi
`not_started`, `onboarding`, `in_progress`, `blocked`, `qa_internal`,
`internal_review`, `ready_client`, `client_review`, `changes_requested`,
`ready_publish`, `published`, `delivered`, `support`, `suspended` e
`cancelled`. Il modello legacy Doflow a otto stati è ancora quello canonizzato
dal backend corrente e deve essere sostituito senza cambiare il comportamento
degli altri tenant.

Classificazione: `A` lettura server; `B` mutazione server; `C` mutazione
client-only; `D` fixture/simulazione; `E` stato UI effimero; `F` fuori scope.

| Azione / consumer | Classe baseline | Endpoint / service / tabella osservati | Capability / transazione / evento | Gap da chiudere in Fase 2 |
|---|---:|---|---|---|
| Lista e dettaglio progetti; route `/dashboard/progetti[/id]` | A | `GET /tenant/projects[/:id]`; `TenantProjectsService`; `projects` | ruolo tenant generico; nessuna transazione di lettura | capability Delivery record-scoped e stato canonico reference |
| Creazione, modifica, stato e archivio progetto | B/C | `POST/PATCH/DELETE /tenant/projects`; `projects` | scritture singole + `audit_log`; provider crea actor/timestamp e Timeline locale | transazione, versione, idempotenza sorgente, History/outbox, risposta server autorevole |
| Membri e project manager | B | `/tenant/projects/:id/members`; `project_members` | manager role; query singole | utente attivo/tenant, supervisore/capability, History/notifica, ultimo responsabile |
| Fasi produttive | B/C | milestone CRUD; `milestones` | scritture singole; provider calcola stato/progresso e Timeline | modello fase reale, peso/responsabile/checklist, reorder atomico e ricalcolo server |
| Task e attività collegate | A/B/C | task CRUD `/tenant/projects`; CRM activity CRUD; `tasks`, `commercial_activities` | ruolo generico; provider collega progetto/fase localmente | collaboratori, fase, dipendenze, transizioni/versione, link atomici e invalidazione |
| Checklist task | A/B | `/tenant/projects/tasks/:id/checklist`; `task_checklist_items` | ruolo generico | item obbligatori, versione/audit e blocco completamento |
| Scadenze e storico scadenze | A/B/C | `tasks.due_at`, `projects.due_date`; calendario | nessuno storico dedicato | `original_due_at`, history append-only, notifica e aggregato server |
| Timer e sessioni lavoro | A/B/C | `/tenant/team/time-entries`; `time_entries` | browser decide ID, start/stop, durata e timestamp | un timer attivo per utente, lock/idempotenza, durata e actual time server-side |
| Invio lavoro, QA, modifiche, approvazione e riapertura | C | sole azioni provider (`submit/approve/requestChanges/reopen`) | capability frontend; Timeline/audit/punti locali | workflow transazionale tenant-scoped, no self-approval, versione/correlation/notifiche |
| Checklist QA progetto | C | `setProjectQaItem` nel provider | actor/timestamp browser | persistenza, required gate, supervisore, History e no-op idempotente |
| Pubblicazione interna e consegna | C | `publishProjectClientUpdate`, `deliverProject` nel provider | precondizioni e Timeline locali | record pubblicazione, transizioni validate, audit/outbox/notifiche e idempotenza |
| Commenti e file progetto | A/B | project comment/file-link API; `project_comments`, `project_file_links` | ruolo generico; Timeline aggrega commenti | record-level capability, correlation/actor server; file storage resta dominio documenti |
| Timeline e History progetto | A/C | `/tenant/timeline`; audit/comment/task union | eventi backend parziali; eventi workflow simulati nel provider | workflow event append-only, un evento business per operazione/no-op |
| Notifiche e realtime Delivery | C/D | notifications generiche e `ProjectsEventsService` separato | nessun outbox Delivery | persistenza PostgreSQL + outbox; push realtime non bloccante |
| Carico team e dashboard | C/D | `team-workload-view` calcola collezioni provider | capability frontend | aggregazione SQL server-side per stima, tempo, capacità, blocchi e QA |
| Filtri, dialog, Sheet, DnD temporaneo, tick timer derivato | E | stato React | nessuna autorità business | può restare client-side con rollback/invalidation |
| Finance, contratti, rinnovi, provider esterni e Client Portal | F | bounded context separati | invariati | esclusi salvo link tenant-scoped già esistenti |

Misura provider baseline Fase 2: `10.393` righe, `128` azioni e `27`
mutazioni client-only. Le mutazioni Delivery client-only identificate includono
approvazione/richiesta modifiche, QA progetto, pubblicazione, consegna e tutti i
link attività↔progetto/fase; timer e fasi hanno chiamate API parziali ma restano
autorevoli nel browser per durata, stato, progresso, actor o Timeline.

## Delivery Core — chiusura server-authoritative della Fase 2

Implementazione e acceptance isolate eseguite il 21 agosto 2026. Il boundary
frontend è `tenant-delivery-api.ts`; il boundary backend è
`TenantDeliveryCoreController` / `TenantDeliveryCoreService`. Il tenant e
l'actor derivano esclusivamente dalla sessione autenticata e tutte le
mutazioni passano da capability backend, transazione PostgreSQL, versione
ottimistica, workflow event, audit e outbox.

| Area | Endpoint Delivery | Persistenza / vincolo | Capability principale | Stato |
|---|---|---|---|---|
| Progetti | `GET/POST /tenant/delivery/projects`, `GET/PATCH/DELETE /projects/:id`, `PATCH /status`, `POST /restore` | `projects`; `version`; dedupe `order_id` / `source_event_id`; soft delete | view assigned/all, create, edit, reopen, archive | Server Core |
| Membri e supervisori | `POST/PATCH/DELETE /projects/:id/members[/memberId]` | `project_members`; utente attivo; stesso schema; ultimo responsabile protetto | manage members / supervise | Server Core |
| Fasi | `POST/PATCH/DELETE /projects/:id/phases[/phaseId]`, `PATCH /phases/reorder` | `milestones`; peso, responsabile, date reali/previste, versione; progresso ricalcolato | manage projects/tasks | Server Core |
| Task e attività | `POST/PATCH/DELETE /projects/:id/tasks[/taskId]`, `PATCH /status`, `PATCH /tasks/reorder`, link/unlink activity | `tasks`, `task_assignees`, `commercial_activities`; versioni e link tenant-scoped | manage tasks / assigned activities | Server Core |
| Dipendenze e checklist | `POST/DELETE /dependencies`, `POST/PATCH /tasks/:id/checklist` | `task_dependencies`, `task_checklist_items`; no self-reference, duplicati o cicli; required gate | manage tasks | Server Core |
| Scadenze | aggiornamento task/progetto e History del workspace | `original_due_at`, `task_due_date_history`; reason/correlation/actor server | edit/manage tasks | Server Core |
| Timer | `GET /timers/active`, `POST /timers/start`, `POST /timers/:id/stop`, `PATCH/DELETE /timers/:id` | `delivery_time_sessions`; unique timer attivo per utente; clock e durata server; stop key | track time / view team time | Server Core |
| QA e supervisione | `POST/PATCH /qa/items`, `POST /qa/submit`, `/qa/changes`, `/qa/approve` | `project_qa_items`, task work state, workflow event; self-approval negata; required gate | submit QA / supervise / approve | Server Core |
| Pubblicazione e consegna | `POST /publish`, `/deliver`, `/support` e transizione progetto | `project_publications`, timestamp/autore progetto, workflow event | publish / deliver / reopen | Server Core interno; nessun provider esterno dichiarato |
| Commenti e History | `POST /comments`, `GET /history` | `project_comments`, `project_workflow_events`, audit append-only | record-scoped Delivery | Server Core |
| Carico | `GET /workload` | aggregazione SQL di task, stime, sessioni, capacità, blocchi e QA | own/global workload | Server Core |
| Idempotenza e notifiche | header `Idempotency-Key` su mutazioni | `delivery_idempotency`, `delivery_outbox`, notifiche PostgreSQL; realtime non bloccante | capability dell'operazione | Server Core |
| Builder | `/tenant/commercial/site-proposals` + `project_id` | guard `canUseBuilder`; link proposta→progetto tenant-scoped | `canUseBuilder` | Server Core; shell cookie verificata |

La macchina a stati canonica Doflow è composta da:
`not_started`, `onboarding`, `in_progress`, `blocked`, `qa_internal`,
`internal_review`, `ready_client`, `client_review`, `changes_requested`,
`ready_publish`, `published`, `delivered`, `support`, `suspended`, `cancelled`.
Gli alias legacy sono normalizzati soltanto quando non ambigui; `materials`,
`design` e gli altri stati fase-like restano diagnostici nel mapper esplicito.

### Evidenza runtime Delivery

Lo stack riproducibile usa PostgreSQL `localhost:55432`, Redis
`localhost:56379`, storage `localhost:59000`, backend `localhost:3401` e
frontend `localhost:3100`, con `NODE_ENV=test`, `DB_SYNC=false`, segreti casuali
temporanei e identità `.invalid`. `pnpm acceptance:delivery:test` è passato con
tre browser context indipendenti. L'ultimo run ha rilevato:

- `1` progetto, `2` task attivi, `1` timer concluso, `1` pubblicazione e `1`
  commento persistenti;
- `35` workflow event, `35` audit, `37` outbox, `12` notifiche e `34` righe di
  idempotenza;
- refresh, nuovo context, secondo utente e restart frontend/backend positivi;
- timer, QA, stato, Timeline e notifiche persistenti dopo restart;
- auto-approvazione negata, conflitto ottimistico controllato e operazioni
  ripetute idempotenti;
- `0` progetti e `0` notifiche trapelati al tenant secondario, anche con
  spoofing header/query;
- Builder autorizzato/negato e `project_id` della proposta uguale al progetto
  Delivery creato;
- `0` collezioni Delivery autorevoli in `localStorage`.

Il mapper legacy è stato eseguito prima in dry-run e poi in apply esplicito sul
solo database isolato; una seconda apply della migrazione non ha prodotto
errori e il successivo `migration:run` ha riportato `No migrations are pending`.

### Audit provider e visuale mirata

L'audit statico Fase 2 misura `8.879` righe rispetto a `10.393`: `1.514` righe
rimosse (`14,6%`), `32` azioni Delivery risolte, `0` mutazioni client-only,
nessun boundary API mancante, nessun workflow simulato e nessuno storage
browser vietato.

Il Playwright visuale mirato ha passato `2` test e prodotto `48` screenshot in
`docs/design-references/doflow-crm-projects/actual/delivery-core/` per
`390x900`, `768x900` e `1440x900`, tema chiaro/scuro. Sono stati verificati
overflow, dialog/Sheet, Escape, focus, keyboard, timer dopo reload, QA non solo
cromatico, alternativa accessibile al drag-and-drop, access denied e link
Builder→progetto.

### Reconciliation autorevole delle fonti

La precedente regola a quattro tab è **SUPERATA** e non è più un criterio di
acceptance corrente. Per UI, UX, navigazione e struttura del dettaglio progetto
prevale
`doflow-gestionale-reference/src/features/commercial/components/commercial-project-detail-page.tsx`
al commit `e6c3ef5920773afc14b3caff88cfe4027400c54b`, che dichiara nell’ordine:
`overview`, `activities`, `phases`, `production`, `documents`, `payments` e
`timeline` (Panoramica, Attività, Fasi, Produzione e QA, Documenti, Pagamenti,
Timeline).

I PNG `project-overview`, `project-flow`, `project-activities` e `project-files`
restano documentazione visuale storica e continuano a informare shell,
gerarchia e token quando compatibili, ma non autorizzano il ripristino del
vecchio pannello. La visual acceptance mirata verifica ora esattamente sette tab,
ordine e label, contenuto server-backed, deep link `?tab=`, refresh, browser
Back, focus/tastiera, overflow interno mobile, dialog/Sheet con Escape, access
denied, console pulita e assenza di mutazioni inattese.

Il run di reconciliation del 21 agosto 2026 ha chiuso il falso blocker:

- la visual QA isolata ha passato `2/2` test e rigenerato `48` screenshot, con
  sei evidenze `project-detail-*` e sei `qa-workflow-*` su `390x900`, `768x900`
  e `1440x900`, tema chiaro/scuro;
- la Timeline usa `GET /api/tenant/delivery/projects/:id/history` e mostra eventi
  persistenti, actor e timestamp server-side; Pagamenti usa soltanto ordine,
  pagamenti e fatture realmente restituiti dalle API finance e rispetta
  `canViewAdministration`;
- l’acceptance Delivery isolata ha passato `1/1` test server-authoritative; le
  suite backend mirate hanno passato `14/14` test; type-check, ESLint mirato a
  zero warning, build backend e build frontend (`220` route) sono verdi;
- l’audit provider conferma `32` azioni Delivery, `0` mutazioni client-only,
  nessun boundary API mancante, workflow simulato, storage vietato o endpoint
  Delivery obsoleto.

Verdetti formali della reconciliation:

- `DELIVERY VISUAL TARGETED GO`;
- `DELIVERY CORE SERVER AUTHORITY GO`.

## Commerce & Cash Core — chiusura server-authoritative della Fase 3A

Audit e acceptance isolate chiusi il 22 agosto 2026. Il boundary frontend è
`tenant-commerce-api.ts`; controller e service backend sono
`TenantDoflowCommerceController` e `TenantDoflowCommerceService`. Tenant,
actor, capability, timestamp, codice ordine, valuta e importi autorevoli
derivano dalla sessione e dal database. Ogni mutazione in scope usa DTO,
transazione PostgreSQL, optimistic version, idempotenza, History, audit e
outbox; il push realtime è post-commit e non può annullare il movimento.

Classificazione finale delle azioni osservate:

| Classe | Azioni Fase 3A | Stato finale |
|---|---|---|
| A — lettura server | categorie, catalogo/children, vendite, ordini/dettaglio/snapshot, pagamenti/rimborsi, economics globale/cliente/progetto, History | API tenant-scoped; payload economico redatto o negato dal backend |
| B — mutazione server | CRUD/archivio/ripristino catalogo, vendita, ordine, progetto da ordine, pagamento, rimborso, allocazione implicita ordine | transazione, capability, versione, Idempotency-Key, audit/History/outbox |
| C — mutazione client-only | nessuna azione Commerce & Cash in scope | `0` secondo audit statico production runtime |
| D — fixture/simulazione | fixture della reference e dati demo storici | non caricati; solo seed sintetico `.invalid` dello stack acceptance |
| E — stato UI effimero | dialog, filtri, sort, selezione, bozza righe ordine, cache invalidabile | ammesso; nessuna persistenza autorevole browser |
| F — fase futura | preventivi/versioni/accettazione, contratti/firma, fatture/note di credito, numerazione fiscale, rinnovi/provider | lasciati alla Fase 3B e dichiarati non disponibili, mai simulati |

| Area / consumer | Input e output autorevole | Endpoint / service | Tabelle e transazione | Capability / idempotenza / eventi | Stato |
|---|---|---|---|---|---|
| Categorie e catalogo — `/dashboard/catalogo` | DTO descrittivi; prezzi, valuta, aliquota, versioni e children restituiti dal server | `GET/POST/PATCH/DELETE /tenant/doflow/commerce/categories`, `/services`, restore | `service_categories`, `services`, `service_promotions`, `service_extras`, `service_billing_plans` | view/manage catalog; operation registry; History/audit/outbox | Server Core |
| Piani, extra e promozioni — dialog servizio | validità, combinabilità, limiti, stato e prezzi validati server-side | children transazionali del servizio | tabelle children con FK servizio, soft-delete e versioni | manage catalog; stesso tenant/operazione del servizio | Server Core; nessuna variante separata inventata |
| Vendite — `/dashboard/vendite` | customer/lead/opportunity/service/owner; valore e stato persistiti | `GET/POST/PATCH/DELETE /sales` | `sales`, `sale_items` | view/manage own/global sales; idempotenza, version, History/outbox | Server Core |
| Ordini — `/dashboard/ordini[/id]` | il browser invia riferimenti e righe richieste; codice, snapshot, imponibile, imposte, totale e stato sono calcolati/restituiti dal server | `GET/POST/PATCH/DELETE /orders`, restore, `/history` | `orders`, `order_items`; lock codice tenant; una transazione | view/manage own/global orders; Idempotency-Key; History/audit/outbox/notifica | Server Core |
| Snapshot | nome/descrizione/piano/quantità/prezzo/sconto/IVA/valuta/versione/timestamp immutabili | creazione ordine; dettaglio ordine | `order_items` snapshot; nessuna rilettura catalogo per ricalcolare lo storico | capability ordine; test prezzo/descrizione/IVA/archivio successivi | Server Core |
| Progetto da ordine | solo ID ordine; progetto Delivery e link persistente restituiti | `POST /orders/:id/project` → Delivery Core | `orders.project_id` + `projects.order_id`; advisory lock/transazione | `canGenerateProjectFromOrder`; stessa/differente key non duplica; un evento | Server Core |
| Pagamenti e allocazioni — `/dashboard/pagamenti` | ordine, importo richiesto, data, metodo, riferimento; valuta/stato/actor server-side | `GET/POST /payments`, `PATCH/DELETE /payments/:id` | `payments`, `payment_allocations`; confermati soltanto negli aggregati | record payments/allocations; riferimento unico; idempotenza, History/audit/outbox | Server Core |
| Rimborsi | pagamento originario, importo, data, motivo e riferimento; movimento separato | `POST /refunds` | riga `payments` di tipo refund + allocazione; lock pagamento/ordine | record refunds; blocco pending/cross-tenant/valuta/zero/negativo/sovra-rimborso/duplicato | Server Core |
| Economics globale — dashboard | KPI e trend aggregati, non collezioni complete | `GET /economics/summary` | aggregate SQL su ordini, pagamenti confermati, rimborsi | valori globali o own-scoped backend; nessun dato fiscale Fase 3B | Server Core |
| Economics cliente/progetto | summary, ordini e movimenti autorizzati | `GET /customers/:id/economics`, `/projects/:id/economics` | query record-scoped sulle stesse tabelle | view administration/global values; redazione/403 prima del payload | Server Core |
| Timeline/History/outbox | massimo un evento business per operazione; correlation/operation/actor/timestamp server | `GET /history/:type/:id`; helper `businessEvent` | `commerce_history`, `audit_log`, `commerce_outbox`, notifications | dedupe via `commerce_idempotency`; realtime post-commit | Server Core |

### Schema, migrazione e mapping legacy Fase 3A

La migrazione additiva `1810000000000-CreateCommerceCashCoreAuthority.ts` e lo
schema runtime non usano `DROP`, `TRUNCATE` o `DB_SYNC=true`. Le tabelle
Commerce sono tenant-schema; `payments` è consolidata con Finance e i rimborsi
restano movimenti collegati, non una seconda contabilità. Nello stack isolato
la migrazione Commerce è stata applicata due volte e il successivo
`migration:run` ha restituito `No migrations are pending`.

`map-doflow-commerce-legacy.ts` accetta soltanto target `doflow`, è dry-run di
default e richiede conferma esplicita per apply. Dry-run, apply e seconda apply
sono passati nel database isolato; sul seed pulito i conteggi legacy e gli
ambigui erano `0`, quindi nessun ordine, pagamento, rimborso o snapshot è stato
inventato.

### Evidenza runtime, browser e provider Fase 3A

`pnpm acceptance:commerce:test` ha passato `1/1` test in `1,1` minuti con
PostgreSQL `localhost:55432`, Redis `localhost:56379`, storage
`localhost:59000`, backend `localhost:3401` e frontend `localhost:3100`. Tre
context funzionali più il context negative-capability hanno verificato login
reale/MFA, catalogo, vendita, ordine/snapshot, doppia Idempotency-Key, progetto
singolo, pagamenti concorrenti, rimborso, refresh, nuovo context, restart di
entrambi i runtime, CSRF/session revoke, IDOR/spoofing e secondo tenant.

La prova PostgreSQL finale contiene, per il marker sintetico del run: `1`
ordine, `1` riga snapshot, `2` pagamenti confermati, `1` rimborso, `3`
allocazioni e `1` progetto; totale `2305,80`, incassato netto `2105,80` e
residuo `200,00`. Sono presenti `22` registry idempotenza, `6` History, `3`
audit e `6` outbox. Nessuna collezione Commerce autorevole è presente in
`localStorage`.

L'audit `pnpm audit:commerce-cash` misura il provider a `7.808` righe contro
la baseline `8.879`: `1.071` righe rimosse, `0` store browser autorevoli, `0`
mutazioni client-only Fase 3A e nessun token vietato. Le mutazioni residue del
provider appartengono ai bounded context Fase 3B/Fase 4 già classificati.

La QA autenticata ha prodotto `54` screenshot mascherati in
`docs/design-references/doflow-crm-projects/actual/`: nove superfici per
`390x900`, `768x900`, `1440x900`, tema chiaro/scuro. Sono inclusi Catalogo,
Vendite, Ordini, Pagamenti, dettaglio ordine, Pagamenti progetto,
amministrazione cliente, dashboard e access denied. La reference non contiene
PNG specifici Commerce; sono stati usati il codice reference Daniele allo SHA
registrato e i PNG `client-administration.png` / `project-overview.png` per
shell, gerarchia e token compatibili. Le sette tab progetto canoniche restano:
Panoramica, Attività, Fasi, Produzione e QA, Documenti, Pagamenti, Timeline.

Verdetti formali Fase 3A:

- `VISUAL GO`;
- `COMMERCE & CASH CORE SERVER AUTHORITY GO`.

## Document & Revenue Core — chiusura server-authoritative della Fase 3B

Audit e acceptance isolate chiusi il 23 agosto 2026. Il boundary frontend è
`tenant-document-revenue-api.ts`; controller e service backend sono
`TenantDoflowDocumentRevenueController` e
`TenantDoflowDocumentRevenueService`. La Fase 3B riusa ordini, vendite,
pagamenti, progetti, idempotenza, History, audit e outbox già accettati nella
Fase 3A: non introduce un secondo sistema Commerce o Delivery.

| Area / consumer | Autorità e invarianti | Endpoint principali | Persistenza | Stato |
|---|---|---|---|---|
| Preventivi — `/dashboard/preventivi` | numero `PREV-*`, prezzi, imposte, totali, stato, actor e timestamp server-side; righe snapshot immutabili; nuova versione non distruttiva | `GET/POST /document-revenue/quotes`, `PATCH /quotes/:id`, `POST /quotes/:id/versions` | `quotes`, `quote_items`, registry/history/audit/outbox Commerce | Server Core |
| Accettazione preventivo | una sola vendita e un solo ordine canonici; ripetizione e doppio click restituiscono gli stessi link | `POST /quotes/:id/accept` | `quotes`, `sales`, `orders`, `order_items` nella stessa transazione | Server Core idempotente |
| Contratti — `/dashboard/contratti` | generazione da ordine, versioni e artefatti immutabili, stato e firma interna; nessun provider/firma esterna simulati | `POST /contracts`, `PATCH /contracts/:id`, `/versions`, `/send`, `/sign`, `/archive` | `contracts`, `contract_versions`, `contract_artifacts`, `contract_send_events`, `contract_signers` | Server Core; adapter esterno disabilitato |
| Fatture locali — `/dashboard/fatture` | numerazione `FAT-LOCAL-*`, snapshot ordine, imponibile/imposte/totale e stato derivati dal server; esplicitamente non SDI | `POST /invoices`, `PATCH /invoices/:id/transition` | `invoices`, `invoice_items`, history/audit/outbox | Server Core locale, non fiscale |
| Note di credito | movimento separato `NC-LOCAL-*`; blocco zero/negativo/sovra-storno/duplicato; fattura originaria immutata | `POST /invoices/:id/credit-notes` | `invoices` tipo credit note + righe snapshot | Server Core |
| Rinnovi — `/dashboard/rinnovi` | servizio ricorrente e snapshot dal contratto/ordine; promemoria manuale; ordine di rinnovo canonico e idempotente | `POST /renewals`, `PATCH /renewals/:id`, `/remind`, `/order`, `/archive` | `recurring_services`, `renewals`, `orders`, history/audit/outbox | Server Core; nessun addebito/provider automatico |
| Amministrazione cliente e riepiloghi | aggregazioni per cliente su fatture, note e pagamenti; payload monetario rimosso prima della risposta senza capability finance | `GET /document-revenue/state`, `GET /document-revenue/summary` | aggregate SQL tenant-scoped | Server Core redatto |

La migrazione additiva
`1820000000000-CreateDocumentRevenueCoreAuthority.ts` consolida versioni,
artefatti, invii, firme, recurring service e collegamenti senza `DROP`,
`TRUNCATE` o `DB_SYNC=true`. È stata applicata due volte nel solo PostgreSQL
isolato; la seconda esecuzione e il successivo migration check sono rimasti
idempotenti.

### Evidenza runtime, browser e provider Fase 3B

`pnpm acceptance:document-revenue:test` ha passato `1/1` test in circa `1,5`
minuti con tre browser context indipendenti. Sono stati verificati login reale
con MFA, capability e redazione, isolamento del secondo tenant e spoofing
inefficace, CSRF, snapshot preventivo, versione, accettazione e link
vendita/ordine, contratto/versione/invio/firma interna, fattura locale, nota di
credito, rinnovo/promemoria/ordine, refresh, nuovo context e restart di entrambi
i runtime. La prova PostgreSQL del marker finale contiene `1` preventivo con
`1` riga, `1` contratto con `2` versioni, `1` invio, `1` firma, `1` fattura,
`1` nota di credito, `1` rinnovo, `1` recurring service, `4` artefatti, `12`
History, `12` audit e `12` outbox.

L'audit statico misura il provider a `6.727` righe contro la baseline Fase 3A
di `7.808`: `1.081` righe rimosse, `0` mutazioni client-only Fase 3B e `0`
store browser autorevoli. Le route non usano più gli endpoint legacy quote,
contract, finance invoice o finance renewal.

La QA visuale autenticata ha passato `1/1` test e prodotto `24` screenshot in
`docs/design-references/doflow-crm-projects/actual/`: Preventivi, Contratti,
Fatture locali e Rinnovi a `1440x900`, `1024x768` e `390x844`, tema
chiaro/scuro, con console runtime pulita. Il confronto usa le quattro route e
`contract-renewal-operations-page.tsx` della reference Daniele allo SHA
registrato; non esistono PNG specifici Fase 3B, quindi shell, gerarchia e token
restano quelli dei riferimenti Doflow compatibili.

Verdetti formali Fase 3B:

- `VISUAL GO`;
- `DOCUMENT & REVENUE CORE SERVER AUTHORITY GO`.

## Collaboration, Notifications & Realtime — chiusura server-authoritative della Fase 4A

Audit e acceptance isolate chiusi il 24 agosto 2026. Il boundary frontend è
`tenant-doflow-collaboration-api.ts`, affiancato dalle API notifiche già
tenant-scoped; controller e service backend sono
`TenantDoflowCollaborationController` e
`TenantDoflowCollaborationService`. Tenant, actor, capability, timestamp,
operation/correlation ID e destinatari derivano dal contesto autenticato. Le
mutazioni usano DTO allowlist, controllo record-level, transazione PostgreSQL,
versione ottimistica, idempotenza, History, audit e outbox. Realtime e BullMQ
operano dopo il commit e non possono annullare la mutazione business.

Classificazione finale delle azioni osservate:

| Classe | Azioni Fase 4A | Stato finale |
|---|---|---|
| A — lettura server | commenti e reply, menzioni, reaction aggregate, allegati, History/audit record, lista/summary/preferenze notifiche | API tenant e record-scoped; nessun payload cross-tenant o record non assegnato |
| B — mutazione server | crea/modifica/elimina soft, resolve/reopen, reaction toggle, accesso allegato, read/unread/archive/delete notifica, preferenze | transazione, capability, optimistic version, Idempotency-Key, audit/History/outbox |
| C — mutazione client-only | nessuna azione collaboration/notifica in scope | `0` secondo audit statico del runtime production |
| D — fixture/simulazione | dati reference e demo storici | non caricati; solo record e identità sintetiche `.invalid` nello stack isolato |
| E — stato UI effimero | editor, dialog, filtro notifiche, apertura pannello e cache invalidabile | ammesso; nessuna collezione autorevole in `localStorage` |
| F — fase futura | automazioni generali, punti/classifiche, delivery esterna email/WhatsApp/push e provider antivirus attivo | esclusi dalla Fase 4A; nessuna tabella o API punti/classifiche introdotta |

| Area / consumer | Autorità e invarianti | Endpoint principali | Persistenza | Stato |
|---|---|---|---|---|
| Commenti trasversali — lead, cliente, progetto, attività, ordine, preventivo, contratto, fattura, rinnovo, documento, Builder e pagamento | testo max 10.000, reply con parent valido, actor/timestamp server, edit/delete dell'autore o capability manager, soft delete | `GET/POST /tenant/doflow/collaboration/comments`, `PATCH/DELETE /comments/:id` | `record_comments`; versione e `deleted_at`; record access prima del payload | Server Core |
| Resolve/reopen e reaction | no-op non produce eventi; conflitto su versione stale; emoji allowlist e toggle per utente | `PATCH /comments/:id/resolve`, `POST /comments/:id/reactions` | `record_comments`, `record_comment_reactions` con vincolo unico | Server Core idempotente |
| Menzioni e reply | destinatario attivo, stesso tenant e autorizzato al record; dedupe menzione; una notifica persistita | create/update comment | `record_comment_mentions`, `notifications` estesa con comment/operation/correlation | Server Core; nessun fan-out cross-tenant |
| Allegati | soltanto documenti tenant autorizzati; MIME/dimensione/zero-byte validati; token opaco monouso e download no-store | `POST /attachments/:id/access`, `GET /attachments/access/:token` | `record_comment_attachments`, `collaboration_attachment_tokens`, storage isolato | Server Core; adapter antivirus predisposto ma non dichiarato attivo |
| History e audit | append-only; massimo un evento business per operazione effettiva; nessun evento per no-op | `GET /comments/:id/history`, `GET /collaboration/audit` | `collaboration_history`, `audit_log`, `collaboration_outbox` | Server Core |
| Notifiche — header e `/dashboard/notifiche` | lista, unread, deep link esatto, preferenze e stato read/unread/archive server-side | `/tenant/notifications`, `/summary`, `/:id/read`, `/:id/unread`, `/:id/archive`, `/preferences` | `notifications` tenant-schema e preferenze | Server Core |
| Realtime | handshake solo con sessione opaca valida, origin allowlist, heartbeat e revalidazione; evento privo di payload sensibile; errore push non rollbacka PostgreSQL | WebSocket `/ws` | sessione Redis, outbox PostgreSQL, worker BullMQ | Server Core post-commit |

La migrazione additiva
`1830000000000-CreateCollaborationNotificationsRealtimeAuthority.ts` crea o
consolida `record_comments`, `record_comment_mentions`,
`record_comment_attachments`, `record_comment_reactions`,
`collaboration_history`, `collaboration_idempotency`, `collaboration_outbox` e
`collaboration_attachment_tokens`, ed estende `notifications` con riferimenti
opachi all'operazione e al commento. Non usa `DROP`, `TRUNCATE` o
`DB_SYNC=true`; non contiene strutture punti, ranking o automazioni Fase 4B.

Il mapper `map-doflow-collaboration-legacy.ts` accetta soltanto il target
`doflow`, è dry-run di default e richiede apply esplicita. Nell'esecuzione
ufficiale isolata dry-run, apply e seconda apply hanno riportato `0` commenti
legacy eleggibili, `0` ambigui e `0` record inventati. La seconda applicazione
delle migrazioni ha restituito `No migrations are pending`.

### Evidenza runtime, browser e provider Fase 4A

`pnpm acceptance:collaboration` ha eseguito da stack vuoto migrazioni, seed
sintetici, mapping, build backend/frontend e Playwright; il test browser ha
passato `1/1` in `50,3` secondi. Tre ruoli/context logici indipendenti hanno
verificato owner con MFA, utente Doflow limitato e owner di un secondo tenant.
Sono coperti create/reply/mention/edit/soft-delete/resolve/reopen/reaction,
version conflict, no-op, XSS come testo, allegati reali MinIO, token monouso,
CSRF invalido, record-level denial, IDOR/spoofing, redazione tenant, read/unread
e preferenze notifiche, deep link, refresh, nuovo context, riavvio Redis con
sessione opaca ancora valida, riavvio backend/frontend, reconnect WebSocket e
revoca sessione. Redis usa un volume acceptance dedicato con AOF; gli script
Lua vengono ricaricati automaticamente dopo `NOSCRIPT`.

La prova PostgreSQL del marker sintetico finale contiene `3` commenti sul
progetto, `10` History, `6` outbox, `10` audit e una sola notifica per la
menzione. Nessuna notifica è stata duplicata dopo reconnect e nessun UUID,
testo o marker Doflow è comparso nel secondo tenant. L'audit statico misura
`0` percorsi di authority client-only e nessuna collezione collaboration o
notifiche autorevole in `localStorage`.

Il provider era `6.727` righe al termine della Fase 3B ed è ora `8.063` righe:
l'aumento di `1.336` righe deriva soprattutto dalla normalizzazione di
formattazione e dagli adapter/surface server-backed trasversali; non
reintroduce mutazioni client-only. Gli audit Commerce e Document restano a
`0` mutazioni client-only nei rispettivi bounded context.

La QA visuale autenticata ha prodotto nove screenshot in
`docs/design-references/doflow-crm-projects/actual/`: pannello collaboration
del dettaglio progetto a `1440x900`, `768x900`, `390x900`, e pagina notifiche
nelle stesse viewport in tema chiaro e scuro. Il confronto usa il dettaglio
progetto canonico e la shell della reference Daniele allo SHA registrato; le
sette tab restano, nell'ordine, Panoramica, Attività, Fasi, Produzione e QA,
Documenti, Pagamenti e Timeline. Non esiste un PNG specifico Fase 4A e non è
stato fabbricato un diff artificiale.

Verdetti formali Fase 4A:

- `VISUAL GO`;
- `COLLABORATION & REALTIME CORE SERVER AUTHORITY GO`.

## Automations, Points, Rankings & Mission — chiusura server-authoritative della Fase 4B

Audit e acceptance isolate chiusi il 24 agosto 2026. Le route Doflow
`/dashboard/automazioni` e `/automations/*` usano esclusivamente i client
`tenant-automations-api.ts` e `tenant-performance-api.ts`. Il tenant, l'actor,
le capability, l'operation/correlation ID e i timestamp sono ricavati dalla
sessione server; regole, run, punti, classifiche e obiettivi non hanno più una
fonte business nel browser.

| Area / consumer | Autorità e invarianti | Endpoint principali | Persistenza | Stato |
|---|---|---|---|---|
| Regole e versioni | DTO/allowlist, versione ottimistica obbligatoria per Doflow, History append-only; update stale `409` | `/tenant/automations/rules`, `/:id/enable`, `/:id/disable` | `automation_rules`, `automation_rule_versions`, activity/audit | Server Core |
| Esecuzioni BullMQ | enqueue transazionale, registry per Idempotency-Key, action claim, retry limitato e dead-letter; provider esterni disabilitati esplicitamente | `POST /rules/:id/run`, `/runs/:id/retry`, `GET /runs/:id/actions` | `automation_runs`, `automation_execution_registry`, `automation_action_logs`, `automation_dead_letters`, `automation_outbox` | Server Core idempotente |
| Punti | policy versionata e formula spiegabile; ledger append-only; rettifica separata con motivazione e idempotenza | `GET /tenant/doflow/performance`, `PATCH /point-policy`, `POST /point-ledger/adjustments` | `point_policies`, `point_policy_versions`, `point_ledger`, `performance_event_registry` | Server Core |
| Classifiche | query aggregate server-side, configurazione versionata, periodo chiuso consolidato una sola volta; snapshot immutabile, revisione/revoca esplicita | `/rankings/preview`, `/rankings/:period/:role/consolidate`, `/snapshots/:id/recalculate`, `/snapshots/:id/revoke` | `ranking_configs`, `ranking_config_versions`, `ranking_snapshots`, `ranking_revisions` | Server Core |
| Missione e obiettivi | CRUD server, metriche allowlist e visibilità company/role/user; utente limitato riceve soltanto il proprio perimetro | `/tenant/doflow/goals`, `/:id`, `/:id/archive` | `doflow_goals` | Server Core scoped |
| Adapter | registry con stato/configurazione e nomi dei secret, mai valori; adapter sintetico consentito soltanto nello stack acceptance | `/tenant/doflow/performance/adapters/acceptance-synthetic` | `automation_adapters` | Reali disabilitati finché non configurati |

La migrazione additiva
`1840000000000-CreateAutomationPerformanceAuthority.ts` consolida versioni,
registry idempotenza/esecuzione, outbox, dead-letter, adapter, policy/ledger,
configurazioni e snapshot ranking. Non usa `DROP`, `TRUNCATE` o
`DB_SYNC=true`. Nel PostgreSQL isolato la migrazione e i mapper sono stati
applicati due volte: la seconda esecuzione ha restituito `No migrations are
pending`; il mapper ha versionato le 15 regole legacy senza inventare punti,
run o snapshot.

### Evidenza runtime, browser e rimozione dell'autorità client Fase 4B

`pnpm acceptance:automation-performance` ha completato setup e teardown
ufficiali e ha passato `1/1` scenario browser in circa 1,5 minuti sullo stack
locale isolato. Tre browser context hanno verificato
owner con MFA, utente Doflow limitato e owner del secondo tenant. Sono coperti
creazione/versionamento regola, conflitto ottimistico, due run concorrenti con
la stessa Idempotency-Key e un solo record, BullMQ/action registry, errore
adapter, tre tentativi e dead-letter, retry autorizzato, policy/ledger,
rettifica idempotente, consolidamento/revoca ranking, obiettivo Missione,
payload own-only, IDOR/tenant isolation, refresh, nuovo context e persistenza
dopo riavvio Redis, frontend e backend.

La prova PostgreSQL del marker finale contiene `2` regole, `1` run canonico,
`2` versioni, `2` claim di esecuzione, `1` dead-letter, `1` movimento ledger,
`1` snapshot e `3` audit; il run in dead-letter è stato riprovato con adapter
sintetico acceptance abilitato e il retry è terminato `success`. L'audit statico registra `0` store autorevoli nel
browser, `0` calcolatori ranking client, `0` mutazioni punti client e Missione
server-backed. L'audit Delivery controlla 32 azioni e registra `0` mutazioni
client-only; anche la generazione di una ricorrenza commerciale non collegata
a progetto persiste ora sul server con optimistic rollback.

Il provider misurava `8.063` righe dopo la Fase 4A e misura `7.765` righe:
`298` righe nette rimosse. Le mutazioni client-only Fase 4B residue sono `0`;
i fallback vuoti delle query automazioni sono stati rimossi e le route
`/automations/*` non attendono più l'idratazione del provider commerciale.

La QA autenticata ha prodotto dieci screenshot in
`docs/design-references/doflow-crm-projects/actual/`: overview, elenco regole,
editor/dettaglio, punti, classifiche, esecuzioni, errore/retry, Missione tablet
e mobile e accesso limitato. Le viewport sono esattamente `1440x900`,
`768x900` e `390x900`, in tema chiaro e scuro; `pageErrors` è vuoto. Il
confronto usa le route e i componenti Automazioni/Performance della reference
Daniele allo SHA registrato e la shell Doflow esistente; non esiste un PNG
specifico Fase 4B, quindi non è stato costruito un diff artificiale.

Verdetti formali Fase 4B:

- `VISUAL GO`;
- `COLLABORATION & AUTOMATION PHASE GO`.

## Fase 5A — checkpoint storico prima della chiusura 5A.1–5A.5

Checkpoint eseguito il 24 agosto 2026 sulla working tree `main` basata su
`961c7d0d1886742f9330fad81100a2634596cc02`. La scansione route confronta
automaticamente le 30 route della reference Daniele con 237 route correnti:
nessuna funzione reference è senza destinazione e due deep link sono
equivalenze documentate (`activities/[activityId]` verso Attività con query e
`projects/[projectId]` verso il dettaglio progetto canonico). Builder e sette
tab progetto sono preservati; il Client Portal resta assente.

I gate compilazione/test eseguiti nel checkpoint sono verdi: installazione
frozen, 89/89 suite e 1037/1037 test backend, 11/11 test frontend, type-check,
build backend e build Next production (220 pagine). I cinque audit statici dei
bounded context Delivery, Commerce, Document, Collaboration e
Automations/Performance registrano zero authority client-only nelle azioni
precedentemente accettate. L’audit production è passato da 87 vulnerabilità
(1 critical, 37 high) a zero critical/high e una moderate Nest 10.

`pnpm acceptance:final` ha completato con exit code zero sullo stack locale
isolato. Le sei suite Playwright Commercial, Delivery, Commerce, Document &
Revenue, Collaboration/Realtime e Automation/Performance sono passate in
sequenza. Migrazioni e mapper sono stati ripetuti, i due seed non hanno
sovrascritto i CEO sintetici, il dump post-acceptance è stato ripristinato in
un secondo database con conteggi riconciliati, il probe health finale è passato
e il teardown ha rimosso servizi, container, network, volumi e credenziali.
Durante il gate è stato corretto il loop causato dai `403` classificati
erroneamente come `SYSTEM_ERROR`; un test permanente verifica che soltanto i
`5xx` siano trasmessi alla Control Tower. Il logo cliente attende ora la
risposta server prima di comunicare successo e non è più un’autorità locale.

Il gate release globale è tuttavia bloccato da condizioni automatiche:

- ESLint globale produce 728 warning in 168 file con `--max-warnings=0`;
- il rehearsal aggiunto prova replay/idempotenza, checksum CEO e
  backup/restore, ma non parte ancora da una fixture realistica precedente
  alle migrazioni `179..184`;
- manca un’unica evidenza Playwright Fase 5A che copra integralmente Context
  A/B/C/D/E, in particolare Context E Superadmin, e il visual gate globale;
- l’audit production conserva una moderate Nest 10 che richiede migrazione a
  Nest 11.1.18 o successivo.

### Fase 5A.1 — browser bearer removal

Checkpoint chiuso il 24 agosto 2026. Il frontend web usa come unica authority
sessioni opache HttpOnly persistite in Redis; `auth-storage.ts` è rimosso,
`jwt.ts` non contiene decoder o token e `api.ts` è cookie-only con CSRF. Login,
MFA, signup, invite, handoff, Superadmin e WebSocket non espongono bearer al
browser. La rilevazione browser usa anche Origin/Fetch Metadata e il mock
Superadmin che apriva `?token=` è stato disabilitato.

`pnpm audit:browser-auth` passa su 753 file. `pnpm acceptance:web-session`
passa sui Context A/B/C/D con due tenant, Superadmin public, MFA, remember-me,
rotazione/revoca, handoff host/tenant-bound, CSRF, WebSocket, restart
backend/Redis e teardown. Il contratto operativo è documentato in
`docs/doflow-browser-session-contract.md`.

Verdetto formale Fase 5A.1:

- `BROWSER BEARER REMOVAL GO`.

Il verdetto globale Fase 5A resta `DOFLOW REPLACEMENT RELEASE CANDIDATE
BLOCKED` per i blocker indipendenti ancora elencati; la Fase 5A.1 non li amplia
né li risolve.

### Fase 5A.2 — true pre-179 migration, backup e restore rehearsal

Checkpoint chiuso il 24 agosto 2026 con il comando riproducibile
`pnpm acceptance:migration-pre179`. Il runner programmatico TypeORM applica
solo `171–178`; prima del backup la baseline non contiene migrazioni, tabelle,
colonne o indici authority `179+` e nessun helper runtime/bootstrap è stato
avviato. La fixture legacy SQL contiene due tenant sintetici, due CEO canonici
con valori sintetici e record collegati Commercial, Delivery, Finance,
Documenti, Contratti, Collaboration e Automazioni.

Le migrazioni `179–184` sono state applicate in ordine e il secondo run ha
riportato zero pending. Dry-run non mutativo, apply e seconda apply sono
passati: Delivery ha normalizzato `development` in `in_progress`, conservando
`kickoff` come ambiguità esplicita; Commerce non ha reinterpretato fatture né
inventato ordini/rimborsi; Collaboration ha preservato l'UUID del commento;
Automation ha versionato la regola senza inventare run, punti o snapshot.

Il doppio seed ha preservato due CEO (`PRESERVED=2`), checksum identità/auth,
mirror e membership. Relazioni e somme economiche coincidono; il secondo
tenant resta invariato nei dati e senza UUID cross-schema. Backup pre e post
in formato custom sono stati verificati; il replay indipendente e il restore
post coincidono deterministicamente dopo normalizzazione dei soli timestamp
tecnici. Backend restaurato `DB_SYNC=false`, health/API `200`; fault
transazionale in rollback; teardown completo e porte chiuse. Evidence:
`.visual-runtime/pre179-migration-rehearsal-result.json`; report non sensibile:
`docs/doflow-pre179-migration-rehearsal-report.md`.

Verdetto formale Fase 5A.2:

- `TRUE PRE-179 MIGRATION REHEARSAL GO`.

### Fase 5A.3 — NestJS 11 security & compatibility

Checkpoint chiuso il 24 agosto 2026. Tutti i package core/platform/testing
sono allineati a Nest `11.1.18`; Swagger `11.4.6`, Serve Static `5.0.3`,
Express `5.2.1`, tipi Express `5.0.3` e `reflect-metadata 0.2.2` formano un
peer graph coerente. Non resta alcun package Nest 10 diretto o transitive.

I matcher legacy `*` e `(.*)` di `AppModule` sono sostituiti da wildcard
nominati Express 5. Un test runtime permanente verifica public intake,
webhook, Superadmin, self-service, OAuth, route tenant e 404; ha inoltre
corretto l'esclusione tenancy reale del webhook. Raw body/firma sintetica,
status 400–500, headers già inviati, shutdown hook, Swagger e file statici
sono coperti.

Suite backend: 94/94, 1074/1074, zero skip/failure. `acceptance:nest11` passa
3/3 su stack PostgreSQL/Redis/MinIO isolato: cookie/CSRF/MFA/handoff,
Superadmin, due tenant, raw WebSocket, Builder, public intake, webhook
sintetico, BullMQ retry/idempotenza, health/restart e teardown. Type-check e
build frontend passano su 220 pagine. Audit production finale: zero
critical/high/moderate/low; `GHSA-36xv-jgw5-4q75` assente.

Evidence: `.visual-runtime/nest11-upgrade-result.json`; dettaglio:
`docs/doflow-nest11-security-compatibility.md`.

Verdetto formale Fase 5A.3:

- `NESTJS 11 SECURITY & COMPATIBILITY GO`.

Il verdetto globale Fase 5A resta bloccato esclusivamente dai gate separati
ancora aperti (lint globale e unico E2E/visual globale con Context E); questa
fase non autorizza un deploy.

Artefatti prodotti: matrice route finale, audit RC permanente, comando
`pnpm acceptance:final`, fixture checksum CEO sintetica, runbook conservativo
e manifest RC. Nessuno di questi artefatti autorizza il deploy.

Verdetto storico del checkpoint iniziale Fase 5A, superato dalla Fase 5A.5:

- `DOFLOW REPLACEMENT RELEASE CANDIDATE BLOCKED`.

## Fase 5A.5 — Final global E2E, visual gate e Release Candidate

Chiusura eseguita il 24 agosto 2026 sulla working tree `main` basata su
`961c7d0d1886742f9330fad81100a2634596cc02`. Il comando unico
`pnpm acceptance:final` ha completato installazione frozen strict, gate
statici, true pre-179 rehearsal, stack locale isolato, acceptance di dominio,
web session, NestJS/BullMQ, Context A–E, visual globale, migration/mapper/seed
replay, preservazione CEO sintetica, backup/restore, health e teardown.

Risultati finali:

- backend: 95/95 suite, 1076/1076 test, build verde;
- frontend: due lint strict 0 errori/0 warning, type-check, 14/14 test e build
  di 220 pagine;
- E2E globale: 143 operazioni; idempotenza e concorrenza verdi;
- Context A owner, B manager, C limitato, D secondo tenant ed E Superadmin
  passati;
- Context E: matrice negativa `401/403`, scope `public/FULL`, 10 API sicure,
  9 superfici, shell separata e revoca logout;
- route: 30 reference coperte, 14 redirect legacy verificati, due equivalenze
  deep-link, vecchia UI non renderizzata nel tenant `doflow`;
- visual: 121 screenshot, 118 controlli accessibilità, viewport `390×900`,
  `768×900`, `1440×900`, chiaro/scuro, sette tab progetto, zero console
  error/warning e zero `5xx` inattesi;
- authority: zero bearer browser, zero store business autorevoli e zero
  mutazioni client-only nei bounded context chiusi;
- security/dependency: PASS, zero critical/high/moderate/low su 1044
  dipendenze, zero Client Portal;
- migrazioni: baseline 178, max 184, secondo run senza pending,
  replay/restore/fault rollback e mapping idempotente;
- health: 10/10;
- teardown: porte `3100`, `3401`, `55432`, `56379`, `59000` chiuse, zero
  container/network/volumi acceptance e credenziali temporanee rimosse.

Bug bloccanti corretti con regressione mirata: scadenza TOTP sotto carico,
duplicazione della suite web-session nella config Nest, semantica heading
dell'access denied, preload logo non usato, boundary richieste su browser Back
e reload Superadmin, readiness Automation e query finale della tabella
TypeORM (`public.doflow_migrations`). Non sono state aggiunte feature o
modifiche di schema.

Evidence macchina: `.visual-runtime/doflow-final-release-candidate-result.json`.
Screenshot: `docs/design-references/doflow-crm-projects/actual/final-rc`.
Manifest e runbook sono aggiornati. Produzione, provider live, account CEO
reali e reference non sono stati toccati; nessun commit, push o deploy è stato
eseguito.

Verdetti finali:

- `SUPERADMIN CONTEXT E GO`;
- `GLOBAL VISUAL GO`;
- `DOFLOW REPLACEMENT RELEASE CANDIDATE GO`.

## Fase 5B.1 — release lock e preflight produzione read-only

Tentativo eseguito il 24 agosto 2026 su `main` alla base
`961c7d0d1886742f9330fad81100a2634596cc02`, con `origin/main` identico e
reference Daniele pulita/non indicizzata.

I gate pre-commit sono verdi: install frozen strict, audit dipendenze senza
vulnerabilità, secret scan 0 hit, browser authority PASS, due lint strict
0/0, type-check, frontend mirato 11/11, backend 95/95 e 1.076/1.076, build
backend/frontend, rehearsal pre-179 completa e `git diff --check`.

Il nuovo `pnpm acceptance:final` ha superato i bounded context, web-session e
Nest/BullMQ, ma è fallito nell'acceptance globale: il Context A non ha visto
`<main>` entro 20 secondi mentre il workspace restava nel loader di
sincronizzazione; il Context E ha poi fallito a cascata per evidence globale
assente. Il runner ha eseguito teardown completo.

Il preflight produzione è bloccato: domini/TLS/health pubblici sono verdi,
ma non sono verificabili Coolify/autodeploy, baseline database, CEO reali,
Redis/storage dettagliati, backup/restore e percorso origine rispetto al
container locale `doflow-nginx` in restart loop.

Nessun codice è stato modificato in 5B.1. Nessuno staging, commit, push,
deploy, migrazione/seed produzione o modifica CEO è stato eseguito.

Report:

- `docs/doflow-release-lock-report.md`;
- `docs/doflow-production-preflight-report.md`;
- `docs/doflow-release-file-inventory.csv`.

Verdetti:

- `DOFLOW RELEASE LOCK BLOCKED`;
- `DOFLOW PRODUCTION PREFLIGHT BLOCKED`;
- `DOFLOW 5B.1 BLOCKED`;
- `PUSH HELD — CONTROLLED CUTOVER REQUIRED`.

## Fase 5B.1A — RC stability gate

| Area | Stato prima della doppia acceptance finale | Evidenza |
| --- | --- | --- |
| Shell/workspace readiness | Correzione implementata; regressioni mirate verdi | `<main>` indipendente dai dati secondari, marker semantici e retry controllato |
| Query aggregate | Root cause identificata e stabilizzata senza migrazione | cold workspace 1.104 ms; warm 370 ms nel bootstrap mirato |
| Loader infinito | Corretto | runtime Playwright 4/4, Node readiness 7/7 |
| CORS origine estranea | Corretto nello stack locale | `403`, nessun allow-origin, nessun `500`/`SYSTEM_ERROR` |
| Context E | Orchestrazione autonoma disponibile | comando reale `pnpm acceptance:superadmin` |
| Evidence finale | Scrittura atomica e incrementale implementata | test orchestrazione 15/15 |
| Delivery-only bootstrap | Corretto dopo i primi run finali | nessuna query lead/attività CRM senza capability; Collaboration isolata 1/1 e Context A/B/C/D mirato 1/1 (34,0 s) |
| Doppio run finale | Non anticipato dalla documentazione | `.visual-runtime/doflow-rc-stability-result.json` |

La fase può diventare `DOFLOW RC STABILITY GO` soltanto quando l'evidence
macchina contiene due run distinti, consecutivi e verdi sulla stessa working
tree, conteggi logici identici, `SUPERADMIN CONTEXT E GO`, `GLOBAL VISUAL GO`,
health 10/10 e teardown senza residui. Il verdetto produzione resta
separatamente `DOFLOW PRODUCTION PREFLIGHT BLOCKED`.

## Fase 5B.1C — production migration runner e cutover CLI

| Area | Autorità/trigger | Fail-closed e isolamento | Evidence richiesta |
| --- | --- | --- | --- |
| Production DataSource | `DATABASE_URL`; 11 migrazioni JS compilate `dist/migrations`: 171 e 175–184, senza 172–174 | `synchronize:false`, `doflow_migrations`, history prefisso esatto del manifest | image inspection e status runner |
| Startup schema | `dist/scripts/production-backend-entrypoint.js` | runner prima di NestJS; failure/lock timeout/pending post-run terminano nonzero | baseline 178→184, health e porta assente su failure |
| Advisory lock schema | connessione PostgreSQL dedicata e coppia Doflow stabile | timeout/backoff finiti, unlock e destroy in `finally`; nessun duplicato tra container | due container sullo stesso DB, uno in attesa, history 11 record unici |
| Restart | stesso artefatto e DB a max 184 | zero pending = no-op; nessun mapper/seed | migration/business fingerprint invariati e health verde |
| Cutover status | CLI compilata, default target osservato | sola lettura, nessuna PII | hash pre/post invariato |
| Cutover dry-run | `dry-run --tenant=doflow` | sola lettura; ambiguità riportate, nessun dato inventato | mapper/seed impact e reconciliation prevista |
| Cutover apply | conferma letterale, backup-ref, max 184, zero pending, lock separato | solo `doflow`; altri tenant e `federicanerone` rifiutati; mapper×2 e seed×2 | exit code, idempotenza, report redatto |
| Cutover verify | CLI compilata post-apply | sola lettura; conteggi, UUID, relazioni, somme, duplicati e registry | reconciliation PASS |
| CEO preservation | fingerprint pre/post in memoria | nessun valore auth nel report; una variazione critica blocca apply | due CEO sintetici preservati, booleani/fingerprint brevi |
| Secondo tenant | hash e cross-schema query | nessuna lettura/scrittura cross-tenant | hash invariato e cross-tenant zero |
| Docker production image | esatto `apps/backend/Dockerfile` | niente sorgenti TS/data-source/env/reference necessari; CMD Node compilato | `pnpm acceptance:production-startup` |
| Teardown | sole risorse `doflow-production-startup-acceptance-*` | niente prune e nessun tocco a `doflow-nginx` | porte chiuse, zero container/network/volume/image dedicati |

Artefatti canonici:

- `apps/backend/src/scripts/run-production-migrations.ts`;
- `apps/backend/src/scripts/production-backend-entrypoint.ts`;
- `apps/backend/src/scripts/doflow-production-cutover.ts`;
- `scripts/production-startup-acceptance.mjs`;
- `docs/doflow-production-migration-runner.md`;
- `.visual-runtime/production-migration-runner-result.json`.

Il runner automatico modifica soltanto lo schema TypeORM pending. Mapping,
seed e reconciliation dati restano comandi manuali post-backup. Nessun SQL
manuale, `DB_SYNC=true`, history finta o migration revert è ammesso.

### Evidence locale Fase 5B.1C

| Gate | Risultato verificato |
| --- | --- |
| Production image | `PRODUCTION MIGRATION RUNNER & DOFLOW CUTOVER CLI GO`; image `sha256:831a8a7372598d1f99675a4b77ec20a3f7651198056b894050dd6f66e59152ef` |
| Migration path | max 178→184; 11 file compilati 171, 175–184; zero pending; restart no-op |
| Concorrenza/failure | secondo startup attende il lock senza duplicati; fault exit 1, NestJS/porta bloccati, history e fingerprint business rollback, retry riuscito |
| Cutover sintetico | status/dry-run/apply/apply/verify exit 0; CEO preservati; secondo tenant invariato; reconciliation PASS |
| Idempotenza seed/mapper | pass mapper post-seed; automation rules/versions 16/16 al primo e al secondo apply |
| Backend | 103/103 suite, 1114/1114 test; +8 suite/+38 test rispetto alla baseline |
| Frontend/build | runtime 36/36; type-check PASS; lint strict due volte 0 warning; build backend/frontend PASS; Next 220 pagine |
| Migrazioni/audit | true pre-179 rehearsal GO; audit dipendenze completo/production 0 dopo override `brace-expansion` 1.x 1.1.18; security/browser-auth/release authority PASS |
| Gate globale | due `pnpm acceptance:final` consecutivi sulla stessa fingerprint; Context A–E GO; Context E autonomo GO; visual GO; health 10/10; `DOFLOW RC STABILITY GO` |

### Pre-cutover Fase 5B.2

Il preflight production ha confermato Coolify su `main`/Dockerfile, autodeploy
via webhook e rollback applicativo. Il backup PostgreSQL custom e lo snapshot
MinIO sono verificati, hanno copie off-server con checksum identico e restano
esclusi da Git. Backup-ref CLI:
`doflow-prod-precutover-20260825T092025Z`.

Il push può procedere soltanto dopo release inventory, secret scan, staged
review e ultimo controllo del remoto. Migrazioni automatiche e cutover CLI
restano fail-closed; nessun SQL manuale e nessun `DB_SYNC=true` sono ammessi.
