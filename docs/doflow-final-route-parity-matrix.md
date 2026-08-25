# Doflow replacement — matrice finale route/reference

Reference: `doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b`.
App: working tree `main` basata su
`961c7d0d1886742f9330fad81100a2634596cc02`.

La scansione automatica rileva 30 route nella reference e 237 route compilate
nell'app. Tutte le route reference hanno una destinazione; due deep link sono
equivalenze intenzionali. Il gate Fase 5A.5 ha aperto 30 route canoniche,
verificato 14 redirect legacy, browser Back, refresh/deep link, autorizzazione
e compatibilità del secondo tenant. Stato finale: `GO`.

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
