import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const frontendUrl = process.env.DOFLOW_VISUAL_FRONTEND_URL || "http://localhost:3100"
const frontendAddress = new URL(frontendUrl)
if (frontendAddress.protocol !== "http:" || frontendAddress.hostname !== "localhost") {
  throw new Error("Mocked Doflow visual acceptance is localhost-only and refuses remote or production origins")
}
const frontendOrigin = frontendAddress.origin
const actualDir = path.resolve(
  "docs",
  "design-references",
  "doflow-crm-projects",
  "actual",
  "reference-4864782",
)

const USER_ID = "10000000-0000-4000-8000-000000000001"
const MEMBER_ID = "20000000-0000-4000-8000-000000000001"
const ACTIVE_USER_ID = "10000000-0000-4000-8000-000000000002"
const ACTIVE_MEMBER_ID = "20000000-0000-4000-8000-000000000002"
const INVITED_MEMBER_ID = "20000000-0000-4000-8000-000000000003"
const COMPANY_ID = "11111111-1111-4111-8111-111111111111"
const CONTACT_ID = "22222222-2222-4222-8222-222222222222"
const OPPORTUNITY_ID = "33333333-3333-4333-8333-333333333333"
const PROJECT_ID = "44444444-4444-4444-8444-444444444444"
const TASK_ID = "55555555-5555-4555-8555-555555555555"

const ownerCapabilities = [
  "canViewAllLeads",
  "canViewAssignedLeads",
  "canViewCustomers",
  "canEditCustomers",
  "canViewProjects",
  "canViewActivities",
  "canManageRoles",
  "canViewSales",
  "canViewOrders",
  "canManagePayments",
  "canViewQuotes",
  "canViewContracts",
  "canViewInvoices",
  "canViewRenewals",
  "canManageArchive",
  "canViewCampaigns",
  "canInspectDuplicates",
  "canViewAutomations",
  "canViewAutomationErrors",
  "canReadNotifications",
  "canViewGlobalWorkload",
  "canViewGlobalPoints",
  "canViewOwnPoints",
  "canViewRankings",
  "canViewAdministration",
] as const

const ownerMember = {
  id: MEMBER_ID,
  user_id: USER_ID,
  email: "owner.visual@acceptance.invalid",
  display_name: "Owner visuale",
  first_name: "Owner",
  last_name: "Visuale",
  tenant_role: "owner",
  operational_role: "ceo_label",
  job_title: "Direzione",
  status: "active",
  availability_status: "available",
  capacity_hours_per_week: 40,
  skills: ["leadership"],
  created_at: "2026-08-01T09:00:00.000Z",
  updated_at: "2026-08-20T09:00:00.000Z",
  metadata: { protected_owner: true, fixture: "visual-read-only" },
}

const activeMember = {
  id: ACTIVE_MEMBER_ID,
  user_id: ACTIVE_USER_ID,
  email: "member.visual@acceptance.invalid",
  display_name: "Membro operativo",
  first_name: "Membro",
  last_name: "Operativo",
  tenant_role: "manager",
  operational_role: "project_manager",
  job_title: "Project manager",
  status: "active",
  availability_status: "available",
  capacity_hours_per_week: 36,
  created_at: "2026-08-03T09:00:00.000Z",
  updated_at: "2026-08-21T09:00:00.000Z",
  skill_items: [{ id: "40000000-0000-4000-8000-000000000001", name: "Delivery", slug: "delivery", level: "lead" }],
  metadata: { fixture: "visual-read-only" },
}

const invitedMember = {
  id: INVITED_MEMBER_ID,
  user_id: null,
  email: "invited.visual@acceptance.invalid",
  display_name: "Invitato visuale",
  first_name: "Invitato",
  last_name: "Visuale",
  tenant_role: "user",
  operational_role: "web_developer",
  status: "invited",
  availability_status: "unavailable",
  capacity_hours_per_week: 40,
  created_at: "2026-08-22T09:00:00.000Z",
  updated_at: "2026-08-22T09:00:00.000Z",
  metadata: { fixture: "visual-read-only", invite_status: "pending" },
}

const company = {
  id: COMPANY_ID,
  name: "Cliente Visuale",
  status: "active_client",
  source: "Referral",
  email: "cliente.visual@acceptance.invalid",
  phone: "+39 0200000000",
  industry: "Servizi digitali",
  owner_user_id: ACTIVE_USER_ID,
  created_at: "2026-07-01T09:00:00.000Z",
  updated_at: "2026-08-20T10:00:00.000Z",
}

const contact = {
  id: CONTACT_ID,
  company_id: COMPANY_ID,
  first_name: "Referente",
  last_name: "Visuale",
  email: "referente.visual@acceptance.invalid",
  phone: "+39 0211111111",
  is_primary: true,
}

const opportunity = {
  id: OPPORTUNITY_ID,
  company_id: COMPANY_ID,
  company_name: company.name,
  contact_id: CONTACT_ID,
  contact_name: `${contact.first_name} ${contact.last_name}`,
  contact_email: contact.email,
  contact_phone: contact.phone,
  title: "Nuovo sito istituzionale",
  service_type: "Sito web",
  lead_source: "referral",
  value_estimate: 2500,
  probability: 70,
  stage: "qualified",
  assigned_to: ACTIVE_USER_ID,
  next_action: "Confermare il perimetro del progetto",
  next_action_at: "2026-08-28T09:00:00.000Z",
  created_at: "2026-07-01T09:00:00.000Z",
  updated_at: "2026-08-20T10:00:00.000Z",
}

const activity = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company_id: COMPANY_ID,
  opportunity_id: OPPORTUNITY_ID,
  project_id: PROJECT_ID,
  type: "call",
  title: "Call di allineamento",
  description: "Raccolte le priorità operative del cliente.",
  status: "in_progress",
  assigned_to: ACTIVE_USER_ID,
  due_at: "2026-08-29T09:30:00.000Z",
  updated_at: "2026-08-20T09:30:00.000Z",
}

const project = {
  id: PROJECT_ID,
  name: "Progetto Website Visuale",
  company_id: COMPANY_ID,
  company_name: company.name,
  contact_id: CONTACT_ID,
  contact_name: `${contact.first_name} ${contact.last_name}`,
  opportunity_id: OPPORTUNITY_ID,
  type: "website",
  status: "development",
  priority: "high",
  progress: 68,
  project_manager_id: ACTIVE_USER_ID,
  project_manager_email: activeMember.email,
  due_date: "2026-09-15",
  created_at: "2026-07-02T09:00:00.000Z",
  updated_at: "2026-08-20T11:00:00.000Z",
}

const projectTask = {
  id: TASK_ID,
  project_id: PROJECT_ID,
  title: "Completare responsive mobile",
  status: "in_progress",
  priority: "high",
  assignee_id: ACTIVE_USER_ID,
  assignee_email: activeMember.email,
  due_at: "2026-09-01",
}

const teamOptions = {
  tenantRoles: ["admin", "manager", "editor", "user", "viewer"],
  operationalRoles: ["ceo_label", "project_manager", "commercial", "web_developer"],
  employmentTypes: ["employee", "contractor"],
  memberStatuses: ["pending", "active", "suspended", "archived"],
  availabilityStatuses: ["available", "busy", "unavailable"],
  skillLevels: ["junior", "mid", "senior", "lead"],
  availabilityTypes: ["working", "leave"],
  availabilityEntryStatuses: ["planned", "approved"],
  timeActivityTypes: ["delivery", "commercial"],
  timeStatuses: ["draft", "submitted", "approved"],
  moduleKeys: ["dashboard", "crm", "projects", "team", "automations", "settings"],
  sensitiveFieldsVisible: true,
}

type FixtureOptions = Record<string, never>
type FixtureObservation = {
  blocked: Array<{ method: string; url: string }>
  apiPaths: string[]
  webSockets: string[]
  crossOriginWebSockets: string[]
  externalWebSockets: string[]
  consoleMessages: string[]
  runtimeErrors: string[]
}

function list(items: unknown[] = [], limit = 500) {
  return { items, total: items.length, limit, offset: 0 }
}

function fixtureBody(url: URL, _options: FixtureOptions) {
  const pathName = url.pathname
  const capabilities = [...ownerCapabilities]

  if (pathName === "/api/auth/me") {
    return {
      user: {
        id: USER_ID,
        email: ownerMember.email,
        role: "owner",
        tenantId: "doflow",
        tenantSlug: "doflow",
        authStage: "FULL",
        mfa_pending: false,
      },
    }
  }
  if (pathName === "/api/tenant/doflow/identity") {
    return {
      preferences: {
        leadOpenMode: "quick",
        clientOpenMode: "quick",
        leadList: { sort: "updated-desc", group: "none" },
        clientList: { sort: "updated-desc", group: "none" },
      },
      capabilities,
      explicitCapabilities: [],
      assignments: [
        {
          userId: USER_ID,
          roles: ["administrator", "commercial", "web_developer", "project_manager"],
          capabilities,
          explicitCapabilities: [],
        },
        {
          userId: ACTIVE_USER_ID,
          roles: ["project_manager"],
          capabilities: ["canViewCustomers", "canViewProjects", "canManageProjects", "canViewCampaigns"],
          explicitCapabilities: ["canViewCampaigns"],
        },
      ],
    }
  }
  if (pathName === "/api/tenant/preferences") {
    return {
      onboardingStatus: "completed",
      activeTourId: null,
      tourStep: 0,
      completedTourIds: ["main"],
      dismissedTourIds: [],
      suggestionsEnabled: true,
      animationsEnabled: true,
      reducedMotion: false,
      illustratedEmptyStates: true,
      contextualAssistant: true,
      seenReleaseVersion: "0",
    }
  }
  if (pathName === "/api/tenant/team/members") return list([ownerMember, activeMember, invitedMember])
  if (pathName === "/api/tenant/team/options") return teamOptions
  if (pathName === "/api/tenant/team/me/module-permissions") {
    const allowed = { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true }
    return {
      role: "owner",
      audience: "executive",
      modules: Object.fromEntries([
        "dashboard", "crm", "briefing", "quotes", "projects", "calendar", "documents", "notifications", "team", "knowledge", "contracts", "paperwork", "finance", "reports", "automations", "credentials", "settings",
      ].map((key) => [key, allowed])),
    }
  }
  if (pathName === "/api/tenant/team/workload") {
    return list([{
      team_member_id: MEMBER_ID,
      display_name: ownerMember.display_name,
      email: ownerMember.email,
      operational_role: ownerMember.operational_role,
      status: "active",
      availability_status: "available",
      capacity_hours_per_week: 40,
      openTasks: 0,
      overdueTasks: 0,
      dueSoonTasks: 0,
      activeProjects: 0,
      loggedMinutesThisWeek: 0,
      loggedMinutesThisMonth: 0,
      utilizationPercent: 0,
      isOverloaded: false,
      warnings: [],
    }, {
      team_member_id: ACTIVE_MEMBER_ID,
      display_name: activeMember.display_name,
      email: activeMember.email,
      operational_role: activeMember.operational_role,
      status: "active",
      availability_status: "available",
      capacity_hours_per_week: 36,
      openTasks: 3,
      overdueTasks: 0,
      dueSoonTasks: 1,
      activeProjects: 2,
      loggedMinutesThisWeek: 720,
      loggedMinutesThisMonth: 2880,
      utilizationPercent: 50,
      isOverloaded: false,
      warnings: [],
    }])
  }
  if (pathName === "/api/tenant/team/skills") {
    return list([{ id: "30000000-0000-4000-8000-000000000001", name: "Leadership", slug: "leadership", category: "Direzione" }])
  }
  if (/\/api\/tenant\/team\/members\/[^/]+\/module-permissions$/.test(pathName)) return list([])
  if (/\/api\/tenant\/team\/members\/[^/]+\/activity$/.test(pathName)) return list([])

  if (pathName === `/api/tenant/crm/opportunities/${OPPORTUNITY_ID}`) return opportunity
  if (pathName === "/api/tenant/crm/opportunities") return list([opportunity])
  if (pathName === `/api/tenant/crm/companies/${COMPANY_ID}`) return company
  if (pathName === "/api/tenant/crm/companies") return list([company])
  if (pathName === `/api/tenant/crm/contacts/${CONTACT_ID}`) return contact
  if (pathName === "/api/tenant/crm/contacts") return list([contact])
  if (pathName === "/api/tenant/crm/activities") return list([activity])
  if (pathName === "/api/tenant/crm/communications") return list([])
  if (pathName === "/api/tenant/delivery/projects") return { items: [project] }
  if (pathName === `/api/tenant/delivery/projects/${PROJECT_ID}`) {
    return { project, members: [], phases: [], tasks: [projectTask], qa: [], timers: [], publications: [] }
  }
  if (pathName === `/api/tenant/delivery/projects/${PROJECT_ID}/history`) return { items: [] }
  if (pathName === "/api/tenant/projects") return list([project])
  if (pathName === `/api/tenant/projects/${PROJECT_ID}`) return project
  if (pathName === `/api/tenant/projects/${PROJECT_ID}/tasks`) return list([projectTask])
  if (pathName === "/api/tenant/record-operations/materials") return { items: [] }
  if (pathName === "/api/tenant/record-operations/administration") {
    return { summary: { total_invoiced: 0, total_paid: 0, total_remaining: 0 }, quotes: [], contracts: [], invoices: [], payments: [], deadlines: [], recurring_services: [], renewals: [] }
  }
  if (pathName === `/api/tenant/doflow/commerce/customers/${COMPANY_ID}/economics`) {
    return { summary: { order_count: 0, ordered: 0, gross_collected: 0, refunded: 0, net_collected: 0, residual: 0 }, sales: [], orders: [], payments: [], projects: [] }
  }
  if (pathName === `/api/tenant/doflow/commerce/projects/${PROJECT_ID}/economics`) {
    return { summary: { total: 0, grossCollected: 0, refunded: 0, netCollected: 0, residual: 0, status: "not_available" }, orders: [], payments: [], deadlines: [] }
  }

  if (pathName === "/api/tenant/doflow/document-revenue/state") {
    return { quotes: [], contracts: [], invoices: [], renewals: [], customer_finance: [], redacted: false }
  }
  if (pathName === "/api/tenant/doflow/performance") {
    return {
      pointPolicy: null,
      policy: null,
      pointLedger: [],
      rankingConfigs: [],
      rankingSnapshots: [],
      goals: [],
      mission: { items: [] },
      adapters: [],
      permissions: {
        admin: true,
        canViewFinance: true,
        canViewGlobalPoints: true,
        canManagePolicy: true,
        canManageRankings: true,
        canManageGoals: true,
      },
    }
  }
  if (pathName === "/api/tenant/doflow/performance/rankings/preview") {
    return { period: url.searchParams.get("period"), role: url.searchParams.get("role"), rows: [] }
  }
  if (pathName === "/api/tenant/automations/summary") {
    return {
      totalRules: 0,
      enabledRules: 0,
      disabledRules: 0,
      totalRuns: 0,
      todayRuns: 0,
      successfulRunsToday: 0,
      partialRunsToday: 0,
      failedRunsToday: 0,
      runningRuns: 0,
      queuedRuns: 0,
      successRate: 0,
    }
  }
  if (pathName === "/api/tenant/notifications/summary") {
    return {
      unreadNotifications: 0,
      urgentNotifications: 0,
      taskOverdueNotifications: 0,
      assignedTaskNotifications: 0,
      financeNotifications: 0,
      todayDigestAvailable: false,
    }
  }
  if (pathName === "/api/tenant/bonus") {
    return {
      wallet: { availablePoints: 180, provisionalPoints: 25, reservedPoints: 0 },
      policy: { rules: { pointEuroCents: 10, minimumRequestPoints: 100 } },
      ledger: [{ id: "bonus-1", points: 25, bucket: "consolidated", reason: "Obiettivo completato", occurredAt: "2026-08-20T09:00:00.000Z" }],
      requests: [],
      pendingRequests: [],
      periods: [],
      canManage: true,
      currentUserId: USER_ID,
    }
  }
  if (pathName === "/api/tenant/collaboration/conversations") {
    return list([
      { id: "conversation-general", title: "Generale", kind: "team", unreadCount: 0, participants: [{ userId: USER_ID }, { userId: ACTIVE_USER_ID }], lastMessage: { id: "message-conversation-general", conversationId: "conversation-general", authorId: USER_ID, body: "Allineamento operativo completato.", createdAt: "2026-08-27T08:30:00.000Z" } },
      { id: "conversation-production", title: "Produzione", kind: "group", unreadCount: 0, participants: [{ userId: USER_ID }, { userId: ACTIVE_USER_ID }], lastMessage: null },
    ])
  }
  if (pathName === "/api/tenant/collaboration/calls/status") return { enabled: false }
  if (pathName === "/api/tenant/collaboration/presence") return list([])
  if (/\/api\/tenant\/collaboration\/conversations\/[^/]+\/messages$/.test(pathName)) {
    const conversationId = pathName.split("/").at(-2) || "conversation-general"
    return { items: [{ id: `message-${conversationId}`, conversationId, authorId: USER_ID, authorName: ownerMember.display_name, body: conversationId === "conversation-general" ? "Allineamento operativo completato." : "Pianificazione produzione aggiornata.", createdAt: "2026-08-27T08:30:00.000Z" }], nextCursor: null }
  }
  if (/\/api\/tenant\/collaboration\/conversations\/[^/]+$/.test(pathName)) {
    return { id: pathName.split("/").at(-1), title: pathName.endsWith("production") ? "Produzione" : "Generale", kind: "team", participants: [{ userId: USER_ID }, { userId: ACTIVE_USER_ID }] }
  }
  if (pathName === "/api/tenant/crm/pipeline") return { model: "visual-fixture", stages: [{ stage: "qualified", label: "Qualificato", count: 1, totalValue: 2500, items: [opportunity] }] }
  if (pathName === "/api/tenant/doflow/commerce/economics/summary") {
    return {
      sold: 0,
      order_count: 0,
      ordered: 0,
      gross_collected: 0,
      refunded: 0,
      net_collected: 0,
      residual: 0,
      open_orders: 0,
      paying_customers: 0,
      trend: [],
    }
  }

  // All remaining GET endpoints receive an empty deterministic page. There is
  // deliberately no route.continue() fallback for `/api/*`.
  return list([])
}

async function installLocalReadOnlyFixture(page: Page, options: FixtureOptions = {}): Promise<FixtureObservation> {
  const observation: FixtureObservation = {
    blocked: [],
    apiPaths: [],
    webSockets: [],
    crossOriginWebSockets: [],
    externalWebSockets: [],
    consoleMessages: [],
    runtimeErrors: [],
  }
  const benignBrowserNoise = [
    /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/i,
    /Download the React DevTools/i,
  ]
  const isBenign = (message: string) => benignBrowserNoise.some((pattern) => pattern.test(message))

  page.on("pageerror", (error) => {
    const message = `pageerror: ${error.stack || error.message}`
    if (!isBenign(message)) observation.runtimeErrors.push(message)
  })
  page.on("console", (message) => {
    const entry = `console.${message.type()}: ${message.text()}`
    observation.consoleMessages.push(entry)
    const seriousWarning = message.type() === "warning" && (
      /hydration|hydrated|react|maximum update depth|error boundary|unique ["']?key["']? prop/i.test(message.text()) ||
      /image with src[\s\S]*(?:width|height)[\s\S]*modified|maintain the aspect ratio/i.test(message.text()) ||
      /DialogContent[\s\S]*(?:DialogTitle|aria-describedby)/i.test(message.text())
    )
    if ((message.type() === "error" || seriousWarning) && !isBenign(entry)) observation.runtimeErrors.push(entry)
  })

  await page.routeWebSocket("**/*", async (webSocket) => {
    const url = new URL(webSocket.url())
    observation.webSockets.push(webSocket.url())
    const httpProtocol = url.protocol === "wss:" ? "https:" : "http:"
    const comparableOrigin = `${httpProtocol}//${url.host}`
    const isCrossOrigin = comparableOrigin !== frontendOrigin
    const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
    if (isCrossOrigin) observation.crossOriginWebSockets.push(webSocket.url())
    const isFrontendDevSocket = !isCrossOrigin && url.pathname.startsWith("/_next/")
    if (isFrontendDevSocket) {
      // The local Next dev HMR channel is part of the frontend under test and
      // is required to finish loading freshly compiled client chunks.
      webSocket.connectToServer()
      return
    }
    if (!isLoopback) {
      observation.externalWebSockets.push(webSocket.url())
      observation.blocked.push({ method: "WS", url: webSocket.url() })
      await webSocket.close({ code: 1008, reason: "External WebSocket blocked by visual fixture" })
      return
    }
    // Application sockets (including same-origin `/ws` rewritten to the
    // optional :3401 backend) are fully mocked and never reach a server.
    webSocket.onMessage(() => undefined)
  })

  await page.route("**/*", async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method().toUpperCase()

    if (url.origin !== frontendOrigin) {
      if (["xhr", "fetch"].includes(request.resourceType())) {
        observation.blocked.push({ method, url: request.url() })
      }
      await route.abort("blockedbyclient")
      return
    }
    if (!url.pathname.startsWith("/api/")) {
      await route.continue()
      return
    }

    observation.apiPaths.push(url.pathname)
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      observation.blocked.push({ method, url: request.url() })
      await route.abort("blockedbyclient")
      return
    }
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: method === "HEAD" ? "" : JSON.stringify(fixtureBody(url, options)),
    })
  })
  return observation
}

function visibleSidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]:visible')
}

async function waitForDoflowShell(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-tenant-ui", "doflow-reference")
  await expect(page.locator('[data-slot="sidebar-wrapper"]')).toBeVisible()
  await expect(page.locator('[data-slot="sidebar-inset"]')).toBeVisible()
  await expect(page.locator('[data-slot="sidebar-inset"] > header')).toBeVisible()
  if ((page.viewportSize()?.width || 0) < 768) await expect(visibleSidebar(page)).toHaveCount(0)
  else await expect(visibleSidebar(page)).toBeVisible()
  await expect(page.getByText("Sincronizzazione workspace", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Workspace non disponibile", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-sidebar-kind="tenant-legacy"]')).toHaveCount(0)
}

async function assertTheme(page: Page, theme: "light" | "dark") {
  await expect
    .poll(() => page.locator("html").evaluate((element, expected) => element.classList.contains(expected), theme))
    .toBe(true)
}

async function assertNoDocumentOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }
      })
      .filter((item) => item.right > window.innerWidth + 1 || item.left < -1)
      .sort((left, right) => right.right - left.right)
      .slice(0, 8)
    const farthest = [...document.querySelectorAll<HTMLElement>("body *")]
      .sort((left, right) => right.getBoundingClientRect().right - left.getBoundingClientRect().right)[0]
    const ancestors: Array<Record<string, unknown>> = []
    let current: HTMLElement | null = farthest
    while (current && ancestors.length < 12) {
      const rect = current.getBoundingClientRect()
      const style = getComputedStyle(current)
      ancestors.push({
        tag: current.tagName.toLowerCase(),
        slot: current.dataset.slot || current.dataset.sidebar || "",
        className: typeof current.className === "string" ? current.className.slice(0, 180) : "",
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        minWidth: style.minWidth,
        overflowX: style.overflowX,
        display: style.display,
      })
      current = current.parentElement
    }
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      offenders,
      ancestors,
    }
  })
  expect(metrics.overflow, `Overflow orizzontale su ${page.url()}: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(1)
}

async function assertInviteOverflowContained(page: Page, dialog: Locator) {
  const dialogWidth = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(
    dialogWidth.scrollWidth,
    `Il DialogContent non deve avere overflow orizzontale (${dialogWidth.scrollWidth}px > ${dialogWidth.clientWidth}px)`,
  ).toBeLessThanOrEqual(dialogWidth.clientWidth + 1)

  const overflowingCopy = await dialog.locator("p").evaluateAll((paragraphs) =>
    paragraphs
      .filter((paragraph) => paragraph.scrollWidth > paragraph.clientWidth + 1)
      .map((paragraph) => paragraph.textContent?.trim() || "[paragrafo senza testo]"),
  )
  expect(overflowingCopy, "Le descrizioni del dialogo devono andare a capo senza tagliarsi").toEqual([])

  const table = dialog.getByRole("table")
  await expect(table).toBeVisible()
  const tableWrapper = table.locator("xpath=..")
  const tableMetrics = await tableWrapper.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }))
  expect(["auto", "scroll"]).toContain(tableMetrics.overflowX)
  expect(tableMetrics.scrollWidth).toBeGreaterThanOrEqual(tableMetrics.clientWidth)

  if ((page.viewportSize()?.width || 0) < 768) {
    expect(tableMetrics.scrollWidth).toBeGreaterThan(tableMetrics.clientWidth + 1)
    const horizontalScroll = await tableWrapper.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
      const result = { left: element.scrollLeft, max: element.scrollWidth - element.clientWidth }
      element.scrollLeft = 0
      return result
    })
    expect(horizontalScroll.max).toBeGreaterThan(0)
    expect(horizontalScroll.left).toBeGreaterThan(0)
  }
}

async function assertSidebarWidth(page: Page, expected: number) {
  await expect.poll(async () => {
    const actual = (await visibleSidebar(page).boundingBox())?.width || 0
    return Math.abs(actual - expected)
  }).toBeLessThanOrEqual(2)
}

async function collapseSidebar(page: Page) {
  const root = page.locator('[data-slot="sidebar"][data-state]').first()
  await page.locator('[data-slot="sidebar-trigger"]').click()
  await expect(root).toHaveAttribute("data-state", "collapsed")
  await assertSidebarWidth(page, 48)
}

async function openTeamAccount(page: Page) {
  if ((page.viewportSize()?.width || 0) < 768) {
    await page.locator('[data-slot="sidebar-trigger"]').click()
    await expect(visibleSidebar(page).getByRole("link", { name: "Team e account", exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(visibleSidebar(page)).toHaveCount(0)
  } else {
    await expect(visibleSidebar(page).getByRole("link", { name: "Team e account", exact: true })).toBeVisible()
  }
  await expect(page).toHaveURL(/\/dashboard\/team-space\?tab=team-accounts$/)
  await expect(page.locator('[data-team-account-admin="server"]')).toBeVisible()
  const activeMemberButton = page.getByRole("button", { name: /Membro operativo/ })
  await expect(activeMemberButton).toBeVisible()
  await activeMemberButton.click()
  await expect(page.getByText("Invitato visuale", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sospendi", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Rimuovi", exact: true })).toBeVisible()
  await expect(page.getByRole("checkbox", { name: /^View Customers/ })).toBeChecked()
  await expect(page.getByRole("checkbox", { name: /^View Customers/ })).toBeDisabled()
  await expect(page.getByRole("checkbox", { name: /^View Campaigns/ })).toBeChecked()
  await expect(page.getByRole("checkbox", { name: /^View Campaigns/ })).toBeEnabled()
  await expect(page.getByRole("checkbox", { name: /^dashboard: can_create/ })).toBeEnabled()
  await expect(page.getByRole("checkbox", { name: /^automations: can_view/ })).toBeDisabled()
}

async function captureInviteDialog(page: Page, prefix: string) {
  await page.getByRole("button", { name: "Invita membro", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Invita membro" })
  await expect(dialog).toBeVisible()
  const capacity = dialog.getByText("Capacità settimanale", { exact: true })
  const roles = dialog.getByRole("heading", { name: "Ruoli Doflow" })
  const capabilities = dialog.getByRole("heading", { name: "Capability esplicite" })
  const modules = dialog.getByRole("heading", { name: "Override permessi modulo" })
  const skills = dialog.getByRole("heading", { name: "Competenze iniziali" })

  await assertInviteOverflowContained(page, dialog)

  for (const section of [capacity, roles, capabilities]) {
    await section.scrollIntoViewIfNeeded()
    await expect(section).toBeInViewport()
  }
  await assertNoDocumentOverflow(page)
  await privacySafeScreenshot(page, `${prefix}-invite-top.png`)

  for (const section of [modules, skills]) {
    await section.scrollIntoViewIfNeeded()
    await expect(section).toBeInViewport()
  }
  await expect(dialog.getByRole("checkbox", { name: /^Invito dashboard: can_create/ })).toBeEnabled()
  await expect(dialog.getByRole("checkbox", { name: /^Invito automations: can_view/ })).toBeDisabled()
  await assertNoDocumentOverflow(page)
  await privacySafeScreenshot(page, `${prefix}-invite-permissions-skills.png`)
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function gotoSurface(page: Page, surface: Surface) {
  await page.goto(surface.route, { waitUntil: "domcontentloaded" })
  await waitForDoflowShell(page)
  if (surface.teamAccount) await openTeamAccount(page)
  if (surface.slug === "automazioni") {
    await expect(page.getByRole("heading", { name: "Automazioni", exact: true })).toBeVisible()
  }
}

async function privacySafeScreenshot(page: Page, filename: string) {
  // Next dev chrome is local tooling, not product UI, and otherwise overlaps
  // the collapsed footer avatar that this visual gate intentionally verifies.
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()))
  const masks: Locator[] = [
    page.locator('[data-visual-sensitive]:visible'),
    page.locator('[data-record-sensitive]:visible'),
    page.locator('input[type="email"]:visible'),
  ]
  await page.screenshot({
    path: path.join(actualDir, filename),
    animations: "disabled",
    caret: "initial",
    mask: masks,
    maskColor: "#94a3b8",
  })
}

type Surface = { slug: string; route: string; teamAccount?: boolean }
const surfaces: Surface[] = [
  { slug: "dashboard", route: "/dashboard" },
  { slug: "commercial", route: "/dashboard/commercial" },
  { slug: "leads", route: "/dashboard/commercial/leads" },
  { slug: "pipeline", route: "/dashboard/commercial/pipeline" },
  { slug: "clients", route: "/dashboard/clienti" },
  { slug: "client-detail", route: `/dashboard/clienti/${COMPANY_ID}?tab=overview` },
  { slug: "projects", route: "/dashboard/progetti" },
  { slug: "project-detail", route: `/dashboard/progetti/${PROJECT_ID}?tab=overview` },
  { slug: "activities", route: "/dashboard/attivita" },
  { slug: "calendar", route: "/dashboard/calendario" },
  { slug: "team-space", route: "/dashboard/team-space" },
  { slug: "inbox", route: "/dashboard/inbox" },
  { slug: "company-intelligence", route: "/dashboard/company-intelligence" },
  { slug: "team-account", route: "/dashboard/team-space?tab=team-accounts", teamAccount: true },
  { slug: "automazioni", route: "/dashboard/automazioni" },
  { slug: "support", route: "/dashboard/supporto" },
  { slug: "settings", route: "/dashboard/impostazioni" },
]

async function shellGeometry(page: Page, variant: MatrixVariant, surface: Surface) {
  const result = await page.evaluate(({ variantSlug, surfaceSlug }) => {
    const sample = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        padding: style.padding,
        gap: style.gap,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        borderRadius: style.borderRadius,
      }
    }
    const sampleVisible = (selector: string) => {
      const element = [...document.querySelectorAll<HTMLElement>(selector)].find((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        padding: style.padding,
        gap: style.gap,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        borderRadius: style.borderRadius,
      }
    }
    return {
      variant: variantSlug,
      surface: surfaceSlug,
      sidebar: sample('[data-sidebar="sidebar"]'),
      sidebarHeader: sample('[data-sidebar="header"]'),
      brand: sample('[data-sidebar="header"] img'),
      navRow: sample('[data-sidebar="content"] [data-sidebar="menu-button"]'),
      inset: sample('[data-slot="sidebar-inset"]'),
      header: sample('[data-slot="sidebar-inset"] > header'),
      search: sampleVisible('[aria-label="Apri ricerca globale"]'),
      main: sample('[data-slot="sidebar-inset"] > :not(header)'),
      heading: sample('[data-slot="sidebar-inset"] h1'),
      firstCard: sample('[data-slot="sidebar-inset"] [data-slot="card"]'),
    }
  }, { variantSlug: variant.slug, surfaceSlug: surface.slug })

  const headerHeight = result.header?.height ?? 0
  expect(headerHeight, "L'header reference deve restare 64px nella shell espansa/responsive").toBeGreaterThanOrEqual(62)
  expect(headerHeight).toBeLessThanOrEqual(66)
  if (result.navRow) {
    expect(result.navRow.height, "Le righe navigazione reference devono essere alte 32px").toBeGreaterThanOrEqual(30)
    expect(result.navRow.height).toBeLessThanOrEqual(34)
  }
  if (result.search) {
    const searchTarget = variant.width < 768 ? 32 : 36
    expect(result.search.height, `Il trigger ricerca reference deve essere alto ${searchTarget}px`).toBeGreaterThanOrEqual(searchTarget - 2)
    expect(result.search.height).toBeLessThanOrEqual(searchTarget + 2)
  }
  return result
}

type MatrixVariant = {
  slug: string
  width: number
  height: number
  theme: "light" | "dark"
  sidebar: "expanded" | "collapsed" | "responsive"
}

const allMatrix: MatrixVariant[] = [
  ...(["light", "dark"] as const).flatMap((theme) =>
    (["expanded", "collapsed"] as const).flatMap((sidebar) => [
      { slug: `desktop-1440x900-${theme}-${sidebar}`, width: 1440, height: 900, theme, sidebar },
      { slug: `desktop-1348x888-${theme}-${sidebar}`, width: 1348, height: 888, theme, sidebar },
    ]),
  ),
  ...(["light", "dark"] as const).map((theme) => ({
    slug: `tablet-768x900-${theme}`,
    width: 768,
    height: 900,
    theme,
    sidebar: "responsive" as const,
  })),
  ...(["light", "dark"] as const).map((theme) => ({
    slug: `tablet-1024x900-${theme}`,
    width: 1024,
    height: 900,
    theme,
    sidebar: "responsive" as const,
  })),
  ...(["light", "dark"] as const).map((theme) => ({
    slug: `tablet-1024x768-${theme}`,
    width: 1024,
    height: 768,
    theme,
    sidebar: "responsive" as const,
  })),
  ...(["light", "dark"] as const).map((theme) => ({
    slug: `mobile-390x900-${theme}`,
    width: 390,
    height: 900,
    theme,
    sidebar: "responsive" as const,
  })),
  ...(["light", "dark"] as const).map((theme) => ({
    slug: `mobile-390x844-${theme}`,
    width: 390,
    height: 844,
    theme,
    sidebar: "responsive" as const,
  })),
]

const requestedMatrixVariant = process.env.DOFLOW_VISUAL_MATRIX_VARIANT?.trim()
const matrix = requestedMatrixVariant
  ? allMatrix.filter((variant) => variant.slug === requestedMatrixVariant)
  : allMatrix
if (requestedMatrixVariant && matrix.length !== 1) {
  throw new Error(`Unknown DOFLOW_VISUAL_MATRIX_VARIANT: ${requestedMatrixVariant}`)
}

const referenceSamples = [
  {
    slug: "reference-client-overview-1672x941-light",
    width: 1672,
    height: 941,
    route: `/dashboard/clienti/${COMPANY_ID}?tab=overview`,
    heading: company.name,
    tabs: ["Panoramica", "Attività", "Progetti", "Comunicazioni", "Documenti", "Pagamenti", "Timeline"],
  },
  {
    slug: "reference-project-overview-1675x939-light",
    width: 1675,
    height: 939,
    route: `/dashboard/progetti/${PROJECT_ID}?tab=overview`,
    heading: project.name,
    tabs: ["Panoramica", "Attività", "Fasi", "Produzione e QA", "Documenti", "Pagamenti", "Timeline"],
  },
] as const

async function newFixturePage(browser: Browser, variant: MatrixVariant, options: FixtureOptions = {}) {
  const context = await browser.newContext({
    baseURL: frontendUrl,
    viewport: { width: variant.width, height: variant.height },
    colorScheme: variant.theme,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  })
  await context.addInitScript((theme) => {
    ;(window as Window & { __DOFLOW_VISUAL_READ_ONLY__?: boolean }).__DOFLOW_VISUAL_READ_ONLY__ = true
    if (!localStorage.getItem("doflow_theme")) localStorage.setItem("doflow_theme", theme)
  }, variant.theme)
  const page = await context.newPage()
  const observation = await installLocalReadOnlyFixture(page, options)
  return { context, page, observation }
}

async function closeFixtureContext(context: BrowserContext, observation: FixtureObservation) {
  expect(observation.blocked, "La fixture ha bloccato una mutation o una API cross-origin").toEqual([])
  expect(observation.externalWebSockets, "WebSocket esterni al loopback osservati dalla fixture").toEqual([])
  expect(observation.runtimeErrors, "Errori runtime/React/hydration osservati dalla pagina").toEqual([])
  await context.close()
}

test.beforeAll(async () => {
  await mkdir(actualDir, { recursive: true })
})

test("login Doflow preserva l'autorità visuale d3cc801", async ({ browser }) => {
  test.setTimeout(300_000)
  const variants = requestedMatrixVariant
    ? matrix
    : Array.from(new Map(allMatrix.map((variant) => [`${variant.width}x${variant.height}-${variant.theme}`, variant])).values())
  for (const variant of variants) {
    const { context, page, observation } = await newFixturePage(browser, variant)
    try {
      await page.goto("/login", { waitUntil: "domcontentloaded" })
      await expect(page.getByRole("heading", { name: "Accedi a Doflow", exact: true })).toBeVisible()
      await expect(page.getByText("Workspace operativo per commerciale, produzione e amministrazione.", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Accedi", exact: true })).toBeVisible()
      await assertNoDocumentOverflow(page)
      if (variant.width >= 1024) {
        await expect(page.getByText("Dal primo contatto alla consegna, tutto nello stesso flusso.", { exact: true })).toBeVisible()
      } else {
        await expect(page.getByText("Dal primo contatto alla consegna, tutto nello stesso flusso.", { exact: true })).toBeHidden()
      }
      await privacySafeScreenshot(page, `${variant.slug}-auth-d3cc801-login.png`)
    } finally {
      await closeFixtureContext(context, observation)
    }
  }
})

test("matrice visuale Doflow finale con API localhost deterministiche", async ({ browser }) => {
  test.setTimeout(1_800_000)
  const geometry: Awaited<ReturnType<typeof shellGeometry>>[] = []
  for (const variant of matrix) {
    const { context, page, observation } = await newFixturePage(browser, variant)
    try {
      for (const surface of surfaces) {
        await gotoSurface(page, surface)
        await assertTheme(page, variant.theme)
        if (variant.sidebar === "collapsed") await collapseSidebar(page)
        else if (variant.width >= 768) await assertSidebarWidth(page, 256)
        await assertNoDocumentOverflow(page)
        geometry.push(await shellGeometry(page, variant, surface))
        await privacySafeScreenshot(page, `${variant.slug}-${surface.slug}.png`)
        if (surface.teamAccount) {
          const modulePermissions = page.getByText("Permessi modulo", { exact: true })
          await modulePermissions.scrollIntoViewIfNeeded()
          await expect(modulePermissions).toBeInViewport()
          await privacySafeScreenshot(page, `${variant.slug}-${surface.slug}-capabilities-modules.png`)
          const capturesInvite =
            (variant.width === 1440 && variant.sidebar === "expanded") ||
            (variant.width === 390 && variant.height === 844)
          if (capturesInvite) await captureInviteDialog(page, variant.slug)
        }
      }

      if (variant.width < 768) {
        await gotoSurface(page, surfaces[0])
        await page.locator('[data-slot="sidebar-trigger"]').click()
        await expect(visibleSidebar(page)).toBeVisible()
        await assertSidebarWidth(page, 288)
        await assertNoDocumentOverflow(page)
        await privacySafeScreenshot(page, `${variant.slug}-sidebar-open.png`)
      }
    } finally {
      await closeFixtureContext(context, observation)
    }
  }

  for (const sample of requestedMatrixVariant ? [] : referenceSamples) {
    const { context, page, observation } = await newFixturePage(browser, {
      slug: sample.slug,
      width: sample.width,
      height: sample.height,
      theme: "light",
      sidebar: "expanded",
    })
    try {
      await page.goto(sample.route, { waitUntil: "domcontentloaded" })
      await waitForDoflowShell(page)
      await expect(page.getByRole("heading", { name: sample.heading, exact: true })).toBeVisible()
      for (const tab of sample.tabs) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible()
      }
      await assertSidebarWidth(page, 256)
      await assertNoDocumentOverflow(page)
      await privacySafeScreenshot(page, `${sample.slug}.png`)
    } finally {
      await closeFixtureContext(context, observation)
    }
  }

  await writeFile(
    path.join(actualDir, "geometry.json"),
    JSON.stringify({ reference: "4864782abc0a6a548b616262be1fe7b6366f622e", tolerancePx: 2, records: geometry }, null, 2),
    "utf8",
  )
})

test("tema persistente, sidebar canonica e Team Space senza chiamate", async ({ browser }) => {
  test.setTimeout(300_000)
  const variant: MatrixVariant = { slug: "behavior", width: 1440, height: 900, theme: "light", sidebar: "expanded" }
  const { context, page, observation } = await newFixturePage(browser, variant)
  try {
    await gotoSurface(page, surfaces[0])
    await assertTheme(page, "light")
    await expect(page.getByRole("button", { name: "Bonus e punti" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Apri Team Space/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Apri la tua agenda" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Apri notifiche" })).toBeVisible()
    await page.getByRole("button", { name: "Cambia tema" }).click()
    await assertTheme(page, "dark")
    await page.reload({ waitUntil: "domcontentloaded" })
    await waitForDoflowShell(page)
    await assertTheme(page, "dark")

    await collapseSidebar(page)
    await assertNoDocumentOverflow(page)

    await page.getByRole("button", { name: "Cambia tema" }).click()
    await assertTheme(page, "light")
    await page.reload({ waitUntil: "domcontentloaded" })
    await waitForDoflowShell(page)
    await assertTheme(page, "light")

    await gotoSurface(page, surfaces.find((surface) => surface.slug === "team-space")!)
    await expect(visibleSidebar(page).getByText("Conversazioni", { exact: true })).toBeVisible()
    await expect(visibleSidebar(page).getByRole("link", { name: "Generale", exact: true })).toBeVisible()
    await expect(page.getByText("Allineamento operativo completato.", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /chiamata|video|microfono/i })).toHaveCount(0)
  } finally {
    await closeFixtureContext(context, observation)
  }
})

test("Builder estratto: assente dalla navigazione, route 404 e zero API", async ({ browser }) => {
  test.setTimeout(180_000)
  const variant: MatrixVariant = { slug: "builder-removed", width: 1440, height: 900, theme: "light", sidebar: "expanded" }
  const { context, page, observation } = await newFixturePage(browser, variant)
  try {
    await gotoSurface(page, surfaces[0])
    await expect(visibleSidebar(page).getByRole("link", { name: "Builder", exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Apri Builder" })).toHaveCount(0)

    const response = await page.request.get(`${frontendOrigin}/commercial/site-proposals`)
    expect(response.status()).toBe(404)
    expect(observation.apiPaths.some((pathName) => pathName.startsWith("/api/tenant/commercial/site-proposals"))).toBe(false)
  } finally {
    await closeFixtureContext(context, observation)
  }
})
