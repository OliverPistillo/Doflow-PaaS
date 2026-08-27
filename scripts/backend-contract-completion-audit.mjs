import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relative) => readFileSync(path.join(root, relative), "utf8")
const files = {
  schema: read("apps/backend/src/tenant/tenant-backend-contracts-schema.ts"),
  migration: read("apps/backend/src/migrations/1860000000000-CompleteBackendContracts.ts"),
  controller: read("apps/backend/src/tenant/tenant-backend-contracts.controller.ts"),
  service: read("apps/backend/src/tenant/tenant-backend-contracts.service.ts"),
  feed: read("apps/backend/src/tenant/tenant-calendar-feed.controller.ts"),
  companyController: read("apps/backend/src/tenant/tenant-company-intelligence.controller.ts"),
  companyService: read("apps/backend/src/tenant/tenant-company-intelligence.service.ts"),
  flowboardController: read("apps/backend/src/tenant/tenant-flowboards.controller.ts"),
  flowboardService: read("apps/backend/src/tenant/tenant-flowboards.service.ts"),
  bonus: read("apps/backend/src/tenant/tenant-bonus.service.ts"),
  preferences: read("apps/backend/src/tenant/tenant-preferences.service.ts"),
  presence: read("apps/backend/src/realtime/presence-registry.service.ts"),
  commerce: read("apps/backend/src/tenant/tenant-doflow-commerce.service.ts"),
  commerceSchema: read("apps/backend/src/tenant/tenant-doflow-commerce-schema.ts"),
  api: read("apps/frontend/src/lib/tenant-backend-contracts-api.ts"),
  featureApi: read("apps/frontend/src/lib/tenant-feature-api.ts"),
  provider: read("apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx"),
  inbox: read("apps/frontend/src/features/inbox/customer-inbox-provider.tsx"),
  identity: read("apps/frontend/src/features/identity/doflow-identity-provider.tsx"),
  emoji: read("apps/frontend/src/features/chat/chat-rich-content.tsx"),
  matrix: read("docs/design-references/doflow-crm-projects/BACKEND_CONTRACT_MATRIX_4864782.md"),
}

const definitions = [
  [1, "Calendar integrations", [["schema", "calendar_integration_preferences"], ["schema", "calendar_integration_events"], ["controller", "syncCalendarProjection"], ["controller", "revokeIcsToken"], ["feed", "calendarFeed"], ["api", "rotateIcsToken"]]],
  [2, "Company Intelligence mutations", [["companyController", "revokeShare"], ["companyController", "addCompetitor"], ["companyController", "exportReport"], ["companyService", "revoked_at"], ["companyService", "deleted_at=COALESCE"]]],
  [3, "Inbox scheduling/update", [["schema", "customer_inbox_conversations"], ["schema", "customer_inbox_drafts"], ["schema", "customer_inbox_receipts"], ["controller", "scheduleInboxMessage"], ["inbox", "backendContractsApi.inbox.state"]]],
  [4, "Flowboard template/project/duplicate", [["schema", "project_id UUID"], ["schema", "is_template BOOLEAN"], ["flowboardController", "templates()"], ["flowboardController", "duplicate"], ["flowboardService", "cloneGraph"], ["flowboardService", "withTenantIdempotency"], ["featureApi", "flowboardApi"], ["featureApi", "flowboards/templates"]]],
  [5, "Bonus payout", [["bonus", "async payout"], ["bonus", "Idempotency-Key obbligatoria"], ["bonus", "bonus_paid"], ["bonus", "managementStateOnly"]]],
  [6, "Chat emoji preferences", [["preferences", "emojiPreferences"], ["emoji", "/tenant/preferences"], ["emoji", "apiFetch"]]],
  [7, "Commerce settings", [["schema", "commerce_settings ("], ["schema", "commerce_settings_audit"], ["controller", "updateCommerceSettings"], ["service", "optimistic_version"], ["provider", "backendContractsApi.commerceSettings"]]],
  [8, "Customer care settings", [["schema", "customer_care_settings"], ["controller", "updateCustomerCare"], ["service", "owner_user_id"], ["provider", "backendContractsApi.customer.updateCare"]]],
  [9, "Customer finance mutations", [["schema", "customer_finance_snapshots"], ["schema", "customer_finance_audit"], ["controller", "updateCustomerFinance"], ["service", "Deposito, pagato e fatturato"], ["provider", "previousFinance"]]],
  [10, "Customer document metadata", [["schema", "customer_document_metadata"], ["controller", "archiveCustomerDocument"], ["service", "validateDocumentRelation"], ["service", "archived_at=COALESCE"], ["provider", "backendContractsApi.customer.updateDocument"]]],
  [11, "Timed presence expiry", [["presence", "manualKey"], ["presence", "duration === 'today'"], ["presence", "'EX', ttl"], ["featureApi", "duration"]]],
  [12, "Guided calls", [["schema", "guided_calls ("], ["schema", "workflow JSONB"], ["schema", "uq_guided_calls_active_lead"], ["service", "guidedWorkflow"], ["service", "commercial_activities"], ["service", "guidedAudit"], ["provider", "guidedCalls.list"]]],
  [13, "Order line/commercial-field updates", [["commerceSchema", "archived_at TIMESTAMPTZ"], ["commerce", "async updateOrder"], ["commerce", "this.withOperation('order.update'"], ["commerce", "this.orderItems"], ["commerce", "version = version + 1"], ["commerce", "businessEvent"]]],
  [14, "Team Duties version/history", [["schema", "team_duty_versions"], ["schema", "team_duty_reads"], ["controller", "approveTeamDuty"], ["service", "L’autore non può approvare"], ["service", "d.duty_key=$3"], ["identity", "refreshTeamDuties"]]],
]

const contracts = definitions.map(([id, contract, checks]) => {
  const missing = checks.filter(([file, token]) => !files[file].includes(token)).map(([file, token]) => `${file}:${token}`)
  const matrixImplemented = new RegExp(`\\|\\s*${id}\\s*\\|[^\\n]+\\|\\s*IMPLEMENTED\\s*\\|`).test(files.matrix)
  if (!matrixImplemented) missing.push("matrix:IMPLEMENTED")
  return { id, contract, status: missing.length ? "BLOCKED" : "IMPLEMENTED", missing }
})

const adapterSources = [files.api, files.featureApi, files.provider, files.inbox, files.identity, files.emoji].join("\n")
const failures = contracts.filter((contract) => contract.status !== "IMPLEMENTED").map((contract) => `Contract ${contract.id}: ${contract.missing.join(", ")}`)
if (/\b(?:localStorage|sessionStorage)\b/.test(adapterSources)) failures.push("Business contract adapter uses browser storage")
if (!files.controller.includes("@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard)")) failures.push("Unified contract controller auth/tenant guards missing")
if (/^\s*(?:DROP|TRUNCATE|DELETE\s+FROM)\b/im.test(files.migration) || /^\s*(?:DROP|TRUNCATE|DELETE\s+FROM)\b/im.test(files.schema)) failures.push("Destructive migration/schema statement detected")

const report = { status: failures.length ? "BLOCKED" : "PASS", contracts, newMigration: "CompleteBackendContracts1860000000000", destructiveStatements: 0, failures }
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (failures.length) process.exitCode = 1
