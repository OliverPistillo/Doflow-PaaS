# Doflow replacement — matrice finale route/reference

Reference funzionale storica: `doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b`.
Reference visuale canonica corrente: `origin/daniele-design@b9a08eea2acaabf23ed56c75111f714c551374f8`
più `TARGET — Reference Daniele.png` a `1348×888` (lo screenshot prevale in
caso di divergenza).

App: working tree `main` basata su
`2eb8f6a4dae4fb990d8bbc4c9da65fb04ba5f220`, identica a `origin/main` e
intenzionalmente dirty/non staged.

La scansione corrente rileva 241 route applicative e la build Next genera 224
pagine. L'audit UI purity attraversa 227 moduli sorgente e 51 entry route
Doflow. Il gate finale ha aperto tutte le superfici canoniche incluse nella
matrice visuale, verificato alias legacy, browser Back, refresh/deep link,
autorizzazione e compatibilità del secondo tenant. Stato finale: `GO`.

| Route reference | Route Doflow | Componente / equivalenza | Autorità server principale | Evidenza finale | Stato |
|---|---|---|---|---|---|
| `/login` | `/login` | `UnifiedAuthPage` | Auth, WebSession/Redis, `public.users` | auth matrix + 6 screenshot responsive/tema | GO |
| `/activities/[activityId]` | `/dashboard/attivita?activityId=[activityId]` | `CommercialActivitiesPage` + `ActivityDetailSheet` | Delivery/CRM activity, History/audit | deep link query, refresh e Back | GO — equivalenza |
| `/dashboard` | `/dashboard` | `RoleAwareDashboard` | aggregate Commercial/Delivery/Finance/Performance | redazione capability + visual | GO |
| `/dashboard/archivio` | stessa | `CommercialArchivePage` | archive/restore bounded context | archive/restore globale | GO |
| `/dashboard/attivita` | stessa | `CommercialActivitiesPage` | activity/task/timer Delivery | workflow, restart, visual | GO |
| `/dashboard/automazioni` | stessa | `AuthorizedAutomationsPage` | engine, BullMQ, registry/outbox | dedupe/retry + responsive | GO |
| `/dashboard/campagne` | stessa | `AuthorizedCampaignsPage` | Commercial campaign projection | public intake/attribution + visual | GO |
| `/dashboard/catalogo` | stessa | `AuthorizedCommercePage` | Commerce service/catalog schema | Commerce E2E + visual | GO |
| `/dashboard/clienti` | stessa | `AuthorizedClientsPage` | CRM companies/contacts/customers | conversione, redazione, visual | GO |
| `/dashboard/clienti/[clientId]` | stessa | `CommercialClientDetailPage` | CRM + Delivery + Finance | IDOR, capability, responsive | GO |
| `/dashboard/commercial` | stessa | `AuthorizedCommercialDashboard` | Commercial aggregate | globale + visual | GO |
| `/dashboard/commercial/leads` | stessa | `CommercialLeadsPageLayout` | CRM lead/history/outbox | intake, merge, conversione | GO |
| `/dashboard/commercial/leads/[leadId]` | stessa | `LeadDetailRoute` | lead/opportunity/timeline | record scope + responsive | GO |
| `/dashboard/commercial/pipeline` | stessa | `CommercialFullPipelinePage` | transition server-side | concorrenza + responsive | GO |
| `/dashboard/contratti` | stessa | `AuthorizedContractRenewalPage` | contract/version/signature | versioni, firma e dialog | GO |
| `/dashboard/documenti` | stessa | `CommercialDocumentsPage` | documents/storage access | tenant isolation + visual | GO |
| `/dashboard/duplicati` | stessa | `AuthorizedDuplicatesPage` | duplicate/merge transaction | merge idempotente | GO |
| `/dashboard/fatture` | stessa | `AuthorizedDocumentCyclePage` | invoice/credit-note service | finance/redazione + responsive | GO |
| `/dashboard/impostazioni` | stessa | `CommercialSettingsPage` | team/preferences/capabilities | capability + visual | GO |
| `/dashboard/notifiche` | stessa | notification page server client | notifications/realtime/outbox | reconnect/deep link + responsive | GO |
| `/dashboard/ordini` | stessa | `AuthorizedCommercePage` | orders/items/snapshots | idempotenza + dialog/select | GO |
| `/dashboard/pagamenti` | stessa | `AuthorizedCommercePage` | payment/refund/allocation | finance redaction + visual | GO |
| `/dashboard/preventivi` | stessa | `AuthorizedDocumentCyclePage` | quote/version/acceptance | immutabilità + responsive | GO |
| `/dashboard/progetti` | stessa | `CommercialProjectsPage` | projects/phases/activities | Delivery + visual | GO |
| `/dashboard/progetti/[projectId]` | stessa | `CommercialProjectDetailPage` | Delivery + Finance + Collaboration | sette tab, deep link, responsive | GO |
| `/dashboard/rinnovi` | stessa | `AuthorizedContractRenewalPage` | recurring/renewal service | idempotenza + visual | GO |
| `/dashboard/scadenze` | stessa | `CommercialDeadlinesPage` | aggregate server-backed | capability + visual | GO |
| `/dashboard/vendite` | stessa | `AuthorizedCommercePage` | sale/sale items | Commerce + visual | GO |
| `/projects/[projectId]` | `/dashboard/progetti/[projectId]` | route full-page canonica Daniele | Delivery project authority | redirect, query, Back, sette tab | GO — equivalenza |

## Funzioni trasversali

| Funzione | Route / componente | Autorità | Evidenza finale | Stato |
|---|---|---|---|---|
| Builder | `/commercial/site-proposals/*` | controller/service tenant-scoped, PostgreSQL, storage, BullMQ | globale, restart/persistenza e 6 screenshot | GO |
| Forgot/reset | `/forgot-password`, `/reset-password` | token hash single-use, rate limit, revoca | auth matrix globale | GO |
| MFA | `/[tenant]/mfa` | auth stage e session rotation | A–E + session acceptance | GO |
| Superadmin | `/superadmin/*` | scope `public`, guard Superadmin | matrice negativa, 10 API, 9 superfici, 6 screenshot | GO |
| Client Portal | nessuna | rimosso intenzionalmente | scan route tree: zero route | assente |

## Route legacy e vecchia UI

Il layout tenant mantiene una allowlist di redirect alla nuova UI per
Commercial, CRM, Delivery, Finance, documenti, notifiche, impostazioni e
report. `/commercial/site-proposals` resta esclusa dal redirect perché è il
Builder obbligatorio. Il gate globale ha verificato 14 alias: URL diretto,
destinazione canonica, query quando necessaria, assenza loop, browser Back,
refresh, autorizzazione e mancato rendering della vecchia UI nel tenant
`doflow`. Il secondo tenant mantiene la shell compatibile e non riceve il
workflow Doflow tenant-specifico.

Verdetto: `DOFLOW REPLACEMENT RELEASE CANDIDATE GO`.

## Addendum finale — Full Daniele Design (25 agosto 2026)

Il precedente `GLOBAL VISUAL GO` basato graficamente su `master/e6c3ef…`, la
shell ibrida e lo screenshot Oliver sono **SUPERATI**. Restano utili soltanto
come evidenza storica e funzionale. La nuova baseline è il TARGET allegato,
integrato con il branch visuale `daniele-design@b9a08ee…`, tema `default`.

| Area / route | Componente o adattamento corrente | Shell / dati | Stato |
| --- | --- | --- | --- |
| `/login`, `/forgot-password`, `/reset-password`, `/[tenant]/mfa` | host auth riallineato alla reference; flussi e contratti auth invariati | pre-auth Daniele; WebSession/CSRF server | ADATTATO — GO |
| `/dashboard` | `DashboardGreeting`, `FinancialSummaryChart`, `DashboardGoalsCard`, KPI server-backed | Daniele 248/64; default | REFERENCE/ADATTATO — GO |
| `/dashboard/commercial*`, lead e pipeline | componenti commerciali esistenti nella nuova shell | API Commercial Core | ADATTATO — GO |
| `/dashboard/clienti*` | liste e dettaglio cliente | API CRM/Delivery/Finance | ADATTATO — GO |
| `/dashboard/attivita`, `/dashboard/progetti*`, `/dashboard/scadenze` | lavoro e dettaglio progetto full-page a sette tab | API Delivery Core | ADATTATO — GO |
| `/dashboard/catalogo`, `/dashboard/vendite`, `/dashboard/ordini*`, `/dashboard/pagamenti` | superfici Commerce nella composizione Daniele | API Commerce & Cash | ADATTATO — GO |
| `/dashboard/preventivi`, `/dashboard/contratti`, `/dashboard/fatture`, `/dashboard/rinnovi` | document cycle nella composizione Daniele | API Document & Revenue | ADATTATO — GO |
| `/dashboard/documenti`, `/dashboard/archivio`, `/dashboard/notifiche` | documenti/collaboration server-backed | API/MinIO/realtime | ADATTATO — GO |
| `/dashboard/team-space`, `/dashboard/calendario`, `/dashboard/supporto`, `/dashboard/flow-arcade` | route reali aggiunte per le voci canoniche della reference | Daniele shell; nessun link morto | REFERENCE/ADATTATO — GO |
| `/dashboard/automazioni`, `/automations/rules`, `/automations/runs` | workspace reali, senza redirect wildcard che nasconda regole/run | API Automation/Performance | ADATTATO — GO |
| `/dashboard/impostazioni` | impostazioni nella nuova shell | capability correnti | ADATTATO — GO |
| `/commercial/site-proposals/*` | Builder preservato, marker e shell Daniele | API/MinIO/BullMQ | ADATTATO — GO |
| `/superadmin/*` | Control Room separata | shell Superadmin | PRESERVATO — GO |
| tenant diversi da `doflow` | `LegacyTenantShell` esplicita | `data-sidebar-kind="tenant-legacy"` | PRESERVATO — GO |

Marker runtime verificati:

- `data-doflow-shell="daniele-design"`;
- `data-doflow-theme="default"`;
- `data-doflow-ui-generation="replacement"`;
- `data-builder-shell="daniele-design"`;
- assenza del marker legacy nel tenant `doflow`.

L'allowlist di redirect tenant-only copre gli alias legacy realmente presenti;
`/commercial/site-proposals/*` resta esclusa perché è il Builder canonico. Le
route Automation regole/run restano invece raggiungibili come workspace reali.

Evidence: 75 screenshot, viewport `390×900`, `768×900`, `1348×888` e
`1440×900`, Context A–E, Back/refresh/deep link, 4/4 test visuali, health
10/10 e teardown pulito. Verdetti: `GLOBAL VISUAL GO` e `VISUAL GO`.
