# Doflow 4864782 — missing persistence contracts

> **SUPERSEDED (2026-08-27).** This file is the historical pre-implementation inventory. All 14 contracts below are now implemented locally and reconciled in `BACKEND_CONTRACT_MATRIX_4864782.md` and `BACKEND_CONTRACT_COMPLETION_4864782.md`. The migration has not been applied to production.

Reference source: `danieleflow/doflow-gestionale` at `4864782abc0a6a548b616262be1fe7b6366f622e`.

This inventory records reference interactions that cannot truthfully be enabled against the current Doflow backend. The direct frontend port keeps their reference visual surface, but the compatibility layer returns an explicit `BLOCKED — MISSING PERSISTENCE CONTRACT` result (or disables the capability) instead of creating client-only business state. No database migration, parallel store, local-storage authority, or production data change was introduced.

| Surface | Current safe behavior | Missing server contract |
| --- | --- | --- |
| Calendar integrations | Integration controls expose an explicit blocked state. Server-backed calendar records remain available. | Persisted provider connection/configuration and authorization lifecycle. |
| Company Intelligence mutations | Read model can load; unsupported mutation actions return a blocked result. | Authenticated tenant-scoped create/update workflow for the reference mutation shapes. |
| Inbox scheduling and conversation updates | Internal supported messages use the real activity API; scheduled messages and unsupported conversation updates return blocked. Draft text remains transient UI state. | Scheduling, conversation metadata/update, and delivery-state persistence. |
| Flowboard template/project/duplicate operations | Supported board CRUD uses the real Flowboard API; template-backed creation, project linking, and duplication return blocked. | Template identity, project association, and duplicate operation contracts. |
| Bonus payout | Existing preview/recalculate/consolidate operations use real performance APIs; payout returns blocked. | Authorized payout execution and auditable payout state. |
| Chat emoji preferences | Preferences are session-only and are never represented as saved account settings. | Account-scoped recents, favorites, and skin-tone preference fields. |
| Team Duties version/history | `manageTeamDuties` remains disabled. | Persisted, versioned duty definitions plus history/audit semantics. |
| Commerce settings | Save attempts return blocked and never mutate the provider store. | Tenant-scoped persisted commerce rules, supplier profile, document settings, and sales settings. |
| Customer care settings | Save attempts return blocked and never mutate customer status/care fields locally. Creation of a concrete due activity still uses the real activity endpoint. | Customer care mode, recurrence, assignee, next due date, and generated-date state. |
| Customer finance fields | Save attempts return blocked and never mutate customer finance values locally. Server-backed document/revenue data remains read-only through its existing contract. | Authorized mutation endpoint for customer totals, deposits, paid, and invoiced values. |
| Customer document metadata | Create/update/archive attempts return blocked and never add client-only documents, audit records, or timeline events. | Tenant-scoped document metadata CRUD with versioning, authorization, audit, and timeline projection. |
| Timed presence expiry | Permanent manual presence and automatic presence use the real collaboration API; temporary `30m`, `1h`, and `today` selections return false instead of silently becoming permanent. | Server-side expiry timestamp/duration and automatic reversion semantics. |
| Guided calls | Launch/save/complete actions return blocked; no draft, message status, outcome, or synthetic next action is stored in the client. | Versioned guided-call aggregate, draft answers, participants, message attempts, completion outcome, and transactional next-action creation. |
| Order line and commercial-field updates | Creating an order submits only the server DTO fields and lets the backend create immutable price snapshots. Editing status, due date, and notes remains server-backed; attempts to alter lines, customer, sale, salesperson, discount, deposit, installments, or order date return blocked. | Versioned server endpoint for recalculating a draft order and updating its commercial associations. |

The Google Contacts action is not classified as persisted integration state: it generates a local CSV only. The compatibility layer no longer marks leads as exported or writes synthetic timeline events, because no server-side export-history contract exists.

These blockers are deliberate final-gate failures under the task rule “no new migration”. They must remain blocked until the backend exposes explicit tenant-isolated, capability-checked contracts and corresponding regression coverage.
