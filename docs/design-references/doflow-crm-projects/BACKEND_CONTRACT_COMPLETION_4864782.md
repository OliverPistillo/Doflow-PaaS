# Doflow 4864782 — backend contract completion report

Data verifica: 2026-08-27.

## Esito

- Obiettivo: completare i 14 contratti backend/persistenza mancanti del port frontend Doflow, mantenendo congelata l'autorità visuale `danieleflow/doflow-gestionale@4864782abc0a6a548b616262be1fe7b6366f622e`.
- Perimetro frontend: esclusivamente tenant `doflow`.
- Perimetro backend: estensioni schema-per-tenant compatibili con tutti i tenant registrati; nessun dato o schema di produzione è stato modificato.
- Risultato contratti: 14/14 `IMPLEMENTED`.
- Risultato visuale: `VISUAL GO` — gate locale autenticato 14/14.
- Stato operativo: lavoro esclusivamente locale; nessun `git add`, commit, push, merge, rebase, deploy, Coolify o migrazione di produzione.

## Stato iniziale e root cause

Il working tree conteneva già il direct source port della reference 4864782 e la rimozione di Builder. Il release audit era bloccato perché 14 azioni presenti nella UI reference non disponevano ancora di un contratto server completo: in alcuni casi mancava solo l'endpoint o l'adapter, in altri mancava una porzione di persistenza tipizzata. La discovery preventiva ha classificato i contratti in B/C/D/E prima di introdurre la migrazione; non è stato usato un contenitore JSON generico, storage browser come autorità, mock di produzione, Prisma, SQLite, API business Next o un backend parallelo.

La matrice di discovery e la riconciliazione finale sono in [BACKEND_CONTRACT_MATRIX_4864782.md](./BACKEND_CONTRACT_MATRIX_4864782.md).

## Perimetro, freeze e autorità

- Il frontend visuale Doflow è rimasto congelato. Le sole modifiche frontend di questo task sono classificate `NON_VISUAL_DATA_ADAPTER`: client API, provider, mapping, tipi, permessi e gestione degli errori/rollback.
- Login e runtime auth non sono stati modificati. Il diff autoritativo di `apps/frontend/src/components/auth` e `apps/frontend/src/app/login` rispetto a `d3cc801523003ed7de7b08bae0d3427fe659501a` è vuoto.
- I quattro file critici sono ancora source-identical alla reference:
  - `apps/frontend/src/components/ui/sidebar.tsx` — SHA-256 `A73CF70E3443392C6F63988B19BBE5921BB856DE23D65BB9B44CF502515B5375`;
  - `apps/frontend/src/components/nav-main.tsx` — SHA-256 `0D55D01770DAB9F742A35E0D7E419D6B2A4EA9536836CF2BE58A25F46BE51EE6`;
  - `apps/frontend/src/components/dashboard-header.tsx` — SHA-256 `88F17E67CBAE25C04DF37FECBE60DE17213D856C388A1CA9F430B9ECC3885F8A`;
  - `apps/frontend/src/components/dashboard-shell.tsx` — SHA-256 `C0C67FC2E1353527EF3F12A0FDD99705A9E331AE862CDBACA30A8A62CE7FE337`.
- Source parity: 100% di copertura; 257 file `VERBATIM`, 93 `VISUAL_VERBATIM_DATA_ADAPTER`, differenze non spiegate = 0.
- Builder resta estratto in `C:\Doflow-Builder-Extracted` e non è stato reintrodotto né alterato. Reachability frontend, runtime attivo e backend attivo = 0.
- Flow Arcade reachability = 0; Client Portal assente; LiveKit resta nascosto/disabilitato.

## Riconciliazione dei 14 contratti

| ID | Contratto / classe | Root cause e autorità esistente | Implementazione e file principali | Migrazione | Auth, isolamento e test | Stato |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Calendar integrations — E | Eventi/calendario esistevano; mancavano preferenze per utente, proiezione e credenziale ICS revocabile | Preferenze/proiezione tipizzate, token bearer a 256 bit memorizzato solo come SHA-256, rotate/revoke/sync e feed ICS tenant-safe. `tenant-backend-contracts-*`, `tenant-calendar-feed.controller.ts`, adapter calendario | Sì | JWT e tenant context sulla gestione; risoluzione feed senza esposizione token o tenant altrui; Google restituisce `configured=false` senza configurazione server | IMPLEMENTED |
| 2 | Company Intelligence mutations — D | List/get/analyze esistevano; mancavano ACL share, competitor, export e delete | Share/revoke, competitor add/remove, export audit e soft delete. Controller/service Company Intelligence, schema e provider/API | Sì | Feature `crm.sales-intel`, capability costo/gestione, ownership/admin e validazione utente nello stesso tenant | IMPLEMENTED |
| 3 | Inbox scheduling/update — D | Comunicazioni commerciali esistevano; mancavano stato conversazione, scheduling, receipt, draft e filtri | Aggregate inbox tipizzato, messaggi interni pianificati, optimistic update, receipt, draft e filtri server. Controller/service unificato e provider/API inbox | Sì | JWT, customer capability e schema autenticato; idempotency obbligatoria per schedule/update; realtime tenant-bound | IMPLEMENTED |
| 4 | Flowboard template/project/duplicate — D | CRUD/versioni esistevano; mancavano template, associazione progetto e duplicate | Endpoint template, associazione a progetto accessibile e duplicazione transazionale con nuovi ID per board/nodi/edge/versione. Controller/service Flowboard e adapter | Sì | PRO e capability Flowboard, progetto/template nello stesso schema, amministratore tenant per creare template; test su foreign UUID e remapping ID | IMPLEMENTED |
| 5 | Bonus payout — B | Request, wallet, ledger, history, audit e idempotency esistevano; mancava la mutation payout | Transizione gestionale a `paid`, debit ledger univoco, reference, history e audit; nessun trasferimento o payment provider. Controller/service Bonus e adapter | No | `canManagePointPolicies`, divieto self-payout/approval, row lock e idempotency key obbligatoria | IMPLEMENTED |
| 6 | Chat emoji preferences — C | Endpoint preferenze tenant-user già presente; mancavano shape validata e adapter | Recent/favorite emoji bounded e skin tone allowlisted, hydrate/update server nel hook non visuale | No | Scope utente nel tenant autenticato; nessun localStorage come autorità | IMPLEMENTED |
| 7 | Commerce settings — E | Commerce esisteva senza aggregate settings tipizzato | Colonne esplicite, allowlist/validazione, optimistic update atomico, audit e hydrate server. Controller/service/schema unificati e provider/API commerce | Sì | Lettura separata dalla mutation; `canManageCommerceRules`; audit senza dump indiscriminato del payload | IMPLEMENTED |
| 8 | Customer care settings — E | Customer/activity esistevano; mancavano cadence, owner e due state | Impostazioni versionate per company, mode/recurrence/date validate, assignee attivo nello stesso tenant e marker idempotente attività. Controller/service e provider/API | Sì | `canViewCustomers`/`canEditCustomers`, verifica company e assignee nello schema autenticato | IMPLEMENTED |
| 9 | Customer finance mutations — E | Autorità finance esistente, ma non lo snapshot/adjustment esplicito della reference | Snapshot in centesimi interi, invarianti, optimistic version, idempotency, audit append-only e rollback adapter. Controller/service e provider/API | Sì | Capability valori commerciali/regole commerce; il server resta autorità KPI e non produce side effect di pagamento/fattura | IMPLEMENTED |
| 10 | Customer document metadata — E | I documenti blob richiedono storage reale e non potevano simulare record metadata-only | Registry metadata separato, versionato, category/visibility/relation validate, progetto dello stesso customer e soft archive | Sì | Capability customer/documenti, nessun path arbitrario e nessuna relazione cross-customer | IMPLEMENTED |
| 11 | Timed presence expiry — D | Redis presence tenant/user/session con TTL esisteva; mancava l'override manuale temporizzato | Override server con 30m, 1h, fine giornata e forever, TTL, expiry metadata e fallback heartbeat. Presence registry/service e provider/API | No | Chiavi e canali tenant+user; expiry server-authoritative, nessuna dichiarazione offline affidata al browser | IMPLEMENTED |
| 12 | Guided calls — E | Mancava il workflow persistente; LiveKit non è requisito del workflow e resta off | Aggregate/versione, partecipanti, messaggi e audit append-only; completion transazionale/idempotente con attività successiva e appointment opzionale | Sì | Scope lead, capability reale, utenti/assignee nello stesso tenant, optimistic version e idempotency obbligatoria | IMPLEMENTED |
| 13 | Order line/commercial fields — D | PATCH ordine esisteva ma rifiutava righe e campi commerciali | Modifica solo in bozza, validate le relazioni tenant, ricostruzione snapshot righe, totale ricalcolato solo server-side, transaction/version/idempotency e audit | Sì, solo colonna `archived_at` sulle righe | Capability own/all order e regole commerce; stale version/double submit protetti | IMPLEMENTED |
| 14 | Team Duties version/history — E | Team/identity esistevano; mancavano duty version, history e receipt | Versioni append-only, approval separata, read receipt del subject, optimistic update e soft lifecycle. Controller/service/schema e identity provider/API/permissions | Sì | `canManageRoles`, autore non può approvare, subject-only acknowledgement, owner protection invariata | IMPLEMENTED |

## Migrazione

- Nuove migrazioni: 1.
- Nome: `1860000000000-CompleteBackendContracts.ts`.
- Registro/migration manifest: aggiornato e coperto dai test di runtime/produzione.
- Tabelle nuove: 21.

  `calendar_integration_preferences`, `calendar_integration_events`, `company_intelligence_report_shares`, `company_intelligence_competitors`, `company_intelligence_exports`, `customer_inbox_conversations`, `customer_inbox_user_state`, `customer_inbox_drafts`, `customer_inbox_receipts`, `commerce_settings`, `commerce_settings_audit`, `customer_care_settings`, `customer_finance_snapshots`, `customer_finance_audit`, `customer_document_metadata`, `guided_calls`, `guided_call_messages`, `guided_call_audit`, `team_duties`, `team_duty_versions`, `team_duty_reads`.

- Colonne additive su tabelle esistenti: 8.
  - `company_intelligence_reports.optimistic_version`;
  - `flowboards.project_id`, `is_template`, `template_key`;
  - `commercial_communications.scheduled_at`, `sent_at`, `idempotency_key`;
  - `order_items.archived_at`.
- Indici nuovi: 6: `idx_calendar_integration_events_active`, `idx_flowboards_project`, `idx_flowboards_template`, `uq_commercial_communications_idempotency`, `idx_customer_document_metadata_company`, `uq_guided_calls_active_lead`.
- Constraint: PK/unique/check espliciti e stati tipizzati; identificatori schema validati con `safeSchema`.
- Idempotenza DDL: `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` e provisioning `provisionSchemaOnce`.
- Test migrazione: schema tenant sintetico vuoto, schema sintetico popolato, due tenant, seconda applicazione, registro, indici, constraint e schema non valido.
- Statement distruttivi: 0. `down()` intenzionalmente non distruttivo.
- Esecuzione produzione: non eseguita.

## File modificati per questo task

Backend e migrazione:

- `apps/backend/src/migrations/1860000000000-CompleteBackendContracts.ts`;
- `apps/backend/src/tenant/tenant-backend-contracts-schema.ts`;
- `apps/backend/src/tenant/tenant-backend-contracts.controller.ts`;
- `apps/backend/src/tenant/tenant-backend-contracts.service.ts`;
- `apps/backend/src/tenant/tenant-calendar-feed.controller.ts`;
- controller/service/schema esistenti per Bonus, Company Intelligence, Flowboard, Commerce, document revenue, preferences e presence;
- `apps/backend/src/tenant/tenant.module.ts`, manifest di migrazione e relativi test.

Frontend, esclusivamente adapter non visuali:

- `apps/frontend/src/lib/tenant-backend-contracts-api.ts`;
- `apps/frontend/src/lib/tenant-feature-api.ts`;
- provider/adapters Calendar, Commercial Leads, Inbox, Flowboard, Bonus, Company Intelligence, Identity/Team Duties, Presence e Chat emoji;
- `apps/frontend/src/lib/permissions.ts` e handler non visuali dell'ordine.

Audit, test e documentazione:

- `scripts/backend-contract-completion-audit.mjs`;
- `scripts/final-release-audit.mjs`;
- `apps/backend/src/tenant/tenant-backend-contracts.spec.ts` e test universal/migration;
- `tests/frontend/commerce-cash-runtime.test.mjs` e `tests/frontend/universal-features-runtime.test.mjs`;
- matrice, inventario superseded e questo report.

Il resto del grande diff locale appartiene al direct port 4864782 e alla precedente estrazione/rimozione Builder; è stato preservato.

## Comportamento prima/dopo

Prima, le 14 superfici avevano handler bloccati, stato transiente/browser-only o contratti server incompleti. Dopo, tutte passano attraverso Nest e la persistenza del tenant autenticato, con validation, capability, optimistic concurrency/idempotency e audit dove il rischio lo richiede. L'output visuale della reference non è stato reinterpretato.

L'ultima correzione di robustezza ha reso l'hydration customer compatibile anche con risposte parziali: care, finance, documents e guided calls vengono mappati solo quando gli array sono realmente presenti. Questo evita il precedente `undefined.map` senza alterare markup o stile.

## Route e interazioni verificate

- Shell autenticata e navigazione Doflow su `http://localhost:3100`, con richieste relative `/api/*` e backend remoto in sola lettura durante il gate.
- Dashboard e tutte le route reference del manifest, comprese Inbox, Calendar, Company Intelligence, Flowboard, Bonus, Commerce, clienti, ordini, progetti e Team Space.
- Dettaglio progetto full-page con le sette tab canoniche: Panoramica, Attività, Fasi, Produzione e QA, Documenti, Pagamenti e Timeline.
- Contratti Nest sotto `/tenant/backend-contracts/*`, `/tenant/flowboards/*`, `/tenant/bonus/requests/:id/payout`, `/tenant/company-intelligence/*` e feed pubblico bearer `/calendar-integrations/ics/:token`.

## Verifica visuale

- Riferimento: `docs/design-references/doflow-crm-projects/references/` e reference source 4864782.
- Viewport PNG canoniche: customer `1672x941`; project `1675x939`.
- Viewport obbligatorie verificate: desktop `1440x900`, tablet `1024x768`, mobile `390x844`.
- Il gate copre inoltre `1348x888`, `768x900` e `390x900`, light/dark e sidebar expanded/collapsed.
- Screenshot actual: `docs/design-references/doflow-crm-projects/actual/reference-4864782/` (371 PNG più un manifest JSON; 372 file complessivi).
- Esempi:
  - `desktop-1440x900-light-expanded-dashboard.png`;
  - `tablet-1024x768-light-dashboard.png`;
  - `mobile-390x844-light-dashboard.png`.
- Diff: `docs/design-references/doflow-crm-projects/diff/README.md`; nessun nuovo pixel diff necessario dopo il gate completo.
- Iterazioni:
  1. una prima esecuzione aveva rilevato una mutation di lettura Inbox; l'autorità è stata resa read-only durante l'hydration;
  2. la prima riesecuzione finale ha rilevato `undefined.map` su un envelope customer parziale; l'adapter è stato reso difensivo;
  3. riesecuzione finale: 14/14 PASS, `REFERENCE 4864782 LOCAL VISUAL PARITY GO`.
- Differenze residue: nessuna critica o maggiore. Un warning LCP sull'asset reference `flow-warning.webp` è non bloccante e non è stato “corretto” per non violare il freeze.
- Desktop, tablet e mobile: utilizzabili; nessuna funzione essenziale persa.

## Test, build e audit

- Backend Jest completo: 79 suite, 745 test, tutti PASS.
- Backend mirato universal + contratti: 2 suite, 54 test, tutti PASS.
- Spec migrazione/contratti finale: 1 suite, 9 test, tutti PASS.
- Frontend Node completo: 52/52 PASS.
- Frontend TypeScript: PASS.
- ESLint strict, zero warning: PASS.
- Frontend build Next.js 16.3.2: PASS, 224 pagine generate.
- Backend build TypeScript: PASS.
- Source parity: PASS, copertura 100%, differenze inspiegate 0.
- UI purity/semantic tokens: PASS, 7/7; Flow Arcade e Builder reachability 0.
- Browser auth authority: PASS, 818 file, 0 failure.
- Collaboration runtime audit: PASS, client-only authority 0.
- Automation authority audit: PASS.
- Backend contract completion audit: PASS, 14/14 IMPLEMENTED, destructive statements 0.
- Release candidate audit: PASS.
- Final security audit: PASS: secret hit 0, Client Portal route 0, arbitrary code 0, data-blob persistence 0, demo account 0, production-host hit 0.
- Visual gate locale autenticato: PASS, 14/14.
- `git diff --check`: PASS.

Le verifiche condivise coprono JWT/tenant guard, account corrente/attivo, denial prima del SQL per no-auth/suspended/read-only, rifiuto dello spoof tenant, schema autenticato, foreign UUID non accessibile, capability action-level, owner protection, idempotency/replay e separazione di ruoli. La suite sintetica esercita due tenant distinti senza usare `federicanerone` o tenant reali come banco di prova.

## Stato Git finale

- `HEAD` = `origin/main` = `7c7821f754fb5a122254ab1a1db9ba2fd9287c19`.
- `git status --short -uall`: 220 modificati, 154 eliminati, 196 untracked; 570 path complessivi e staged = 0.
- `git diff --stat`: 330 file tracked cambiati, 19.735 inserimenti e 25.740 eliminazioni. Gli untracked non sono inclusi in questo stat.
- Le 154 eliminazioni sono la rimozione Builder già presente; il grande port visuale 4864782 preesistente è stato preservato; le aggiunte backend-contract sono raggruppate nella sezione file di questo report.
- `git diff --check` termina con exit code 0. Riporta soltanto avvisi di normalizzazione LF/CRLF del working tree Windows, non errori di whitespace.
- `git diff --cached --name-only` è vuoto: nessun file è stato aggiunto allo staging.

## Rischi residui e punti non verificati

- La migrazione 186 non è stata applicata a un database PostgreSQL reale né in produzione, per esplicito vincolo del task. È stata verificata con runner DDL sintetico su schema vuoto/popolato, multi-tenant e repeated apply.
- Google Calendar OAuth resta non configurato e non viene simulato; le credenziali provider non sono memorizzate in tenant plaintext.
- LiveKit resta off; i Guided Calls implementano il workflow gestionale, non audio/video.
- Nessun invio esterno schedulato o payout finanziario reale viene dichiarato come effettuato: sono stati implementati soltanto gli stati gestionali server-authoritative previsti.
- Il gate browser usa dati reali in sola lettura e maschera i dati sensibili; non valida l'applicazione della nuova migrazione in produzione.

## Verdetto

Tutte le condizioni del gate locale sono soddisfatte: 14 contratti implementati, backend e frontend verdi, autorità auth invariata, source/visual parity preservata, isolamento tenant verificato, Builder/Arcade/Client Portal assenti dal runtime e nessuna operazione di pubblicazione eseguita.

VISUAL GO
