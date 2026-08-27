import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const runtimeConfigPath = path.join(
  root,
  ".visual-runtime",
  "commercial-core-stack.json",
);
const credentialPath = path.join(
  root,
  ".visual-auth",
  "acceptance-credentials.json",
);
const resultPath = path.join(
  root,
  ".visual-runtime",
  "universal-features-acceptance-result.json",
);
const actualDir = path.join(
  root,
  "docs",
  "design-references",
  "doflow-crm-projects",
  "actual",
);
const backendRequire = createRequire(path.join(root, "apps/backend/package.json"));
const { Client: PgClient } = backendRequire("pg");

const OWNER_ID = "a0000000-0000-4000-8000-000000000001";
const MANAGER_ID = "a0000000-0000-4000-8000-000000000002";

type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid synthetic MFA fixture.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function stableTotp(page: Page, secret: string) {
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  return totp(secret);
}

async function appFetch(
  page: Page,
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<AppResult> {
  return page.evaluate(
    async ({ pathValue, request }) => {
      const method = request.method || "GET";
      const csrf = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("doflow_csrf="))
        ?.slice("doflow_csrf=".length);
      const headers: Record<string, string> = {
        ...(request.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(request.headers || {}),
      };
      if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) && csrf) {
        headers["X-CSRF-Token"] = decodeURIComponent(csrf);
      }
      const response = await fetch(`/api${pathValue}`, {
        method,
        headers,
        credentials: "include",
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // Raw response is retained for an assertion message only.
      }
      return { status: response.status, ok: response.ok, json, text };
    },
    { pathValue: pathname, request: options },
  );
}

function mutation(
  page: Page,
  pathname: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  idempotencyKey = randomUUID(),
) {
  return appFetch(page, pathname, {
    method,
    body,
    headers: {
      "Idempotency-Key": idempotencyKey,
      "X-Correlation-Id": randomUUID(),
    },
  });
}

async function login(
  context: BrowserContext,
  email: string,
  credentials: Credentials,
  options: { mfa?: boolean; target?: string; diagnosticEvents?: string[] } = {},
) {
  const page = await context.newPage();
  if (options.diagnosticEvents) {
    const events = options.diagnosticEvents;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) events.push(`navigation ${new URL(frame.url()).pathname}`);
    });
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (
        pathname.startsWith("/api/auth/") ||
        pathname === "/api/tenant/doflow/identity" ||
        pathname === "/api/tenant/team/members"
      ) {
        events.push(`response ${response.status()} ${pathname}`);
      }
    });
    page.on("requestfailed", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) {
        events.push(`requestfailed ${pathname} ${request.failure()?.errorText || "unknown"}`);
      }
    });
    page.on("pageerror", (pageError) => {
      const message = pageError.message;
      events.push(
        /secret|token|password|authorization|cookie/i.test(message)
          ? "pageerror <redacted>"
          : `pageerror ${message.slice(0, 240)}`,
      );
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  if (options.mfa) {
    await page.waitForURL(/\/(?:doflow|acceptance-secondary|public)\/mfa$/);
    await page
      .getByLabel("Codice di verifica a 6 cifre")
      .fill(await stableTotp(page, credentials.mfaSecret));
    await page.getByRole("button", { name: "Verifica Codice" }).click();
  }
  await expect(page).toHaveURL(
    options.target?.startsWith("/superadmin") ? /\/superadmin$/ : /\/dashboard$/,
    { timeout: 60_000 },
  );
  await expect
    .poll(async () => {
      try {
        const result = await appFetch(page, "/auth/me");
        return result.ok ? result.json?.user?.authStage : result.status;
      } catch {
        return "navigation";
      }
    })
    .toBe("FULL");
  if (options.target && new URL(page.url()).pathname !== options.target) {
    await page.goto(options.target);
  }
  const session = (await context.cookies()).find((cookie) => cookie.name === "doflow_session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  return page;
}

async function directLogin(context: BrowserContext, email: string, password: string) {
  return context.request.post("http://localhost:3401/api/auth/login", {
    headers: { Origin: "http://localhost:3100", "X-Doflow-Web": "1" },
    data: { email, password, rememberMe: false },
  });
}

async function waitForUniversalShell(
  page: Page,
  doflow = false,
  diagnosticEvents: string[] = [],
) {
  try {
    await expect(
      page.locator('html[data-tenant-ui="universal"] [data-app-ui-generation="universal-v1"]'),
    ).toHaveCount(1);
  } catch (error) {
    const [auth, identity, members] = await Promise.all([
      appFetch(page, "/auth/me"),
      doflow ? appFetch(page, "/tenant/doflow/identity") : Promise.resolve(null),
      doflow ? appFetch(page, "/tenant/team/members?limit=200") : Promise.resolve(null),
    ]);
    const state = await page.evaluate(() => ({
      pathname: window.location.pathname,
      title: document.title,
      tenantUi: document.documentElement.getAttribute("data-tenant-ui"),
      prepaint: document.querySelectorAll('[data-app-prepaint="universal-v1"]').length,
      generation: document.querySelectorAll('[data-app-ui-generation="universal-v1"]').length,
      shell: document.querySelectorAll('main[data-app-shell-ready="true"]').length,
      loadingSession: document.body.innerText.includes("Caricamento sessione"),
      verifyingSession: document.body.innerText.includes("Verifica sessione"),
      openingWorkspace: document.body.innerText.includes("Apertura spazio di lavoro"),
      loginVisible: Boolean(document.querySelector('input[type="password"]')),
    }));
    const populatedSensitiveInputs = await page
      .locator('input[type="password"], input[name*="token" i], input[name*="secret" i]')
      .evaluateAll((elements) =>
        elements
          .map((element) => (element as HTMLInputElement).value)
          .filter((value) => Boolean(value)),
      );
    expect(populatedSensitiveInputs).toEqual([]);
    await mkdir(path.dirname(resultPath), { recursive: true });
    await page.screenshot({
      path: path.join(path.dirname(resultPath), "universal-shell-diagnostic.png"),
      animations: "disabled",
    });
    throw new Error(
      `Universal shell bootstrap failed: ${JSON.stringify({
        ...state,
        auth: {
          status: auth.status,
          role: auth.json?.user?.role,
          tenantSlug: auth.json?.user?.tenantSlug,
          authStage: auth.json?.user?.authStage,
        },
        identityStatus: identity?.status ?? null,
        membersStatus: members?.status ?? null,
        events: diagnosticEvents.slice(-80),
      })}`,
      { cause: error },
    );
  }
  await expect(page.locator('main[data-app-shell-ready="true"]')).toBeVisible();
  if (doflow) {
    await expect(page.locator('main[data-app-shell-ready="true"]')).toHaveAttribute(
      "data-workspace-ready",
      "true",
    );
  }
}

function observe(page: Page, pageErrors: string[], serverErrors: string[]) {
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
}

async function enforceLocalBrowserNetwork(
  context: BrowserContext,
  violations: string[],
) {
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname)) {
      await route.continue();
      return;
    }
    violations.push(url.origin);
    await route.abort("blockedbyclient");
  });
}

async function screenshot(page: Page, filename: string, paths: string[]) {
  const populatedSensitiveInputs = await page
    .locator(
      'input[type="password"], input[name*="token" i], input[name*="secret" i], textarea[name*="secret" i]',
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => (element as HTMLInputElement | HTMLTextAreaElement).value)
        .filter((value) => Boolean(value)),
    );
  expect(populatedSensitiveInputs, `${filename} contains a populated sensitive input`).toEqual([]);
  await mkdir(actualDir, { recursive: true });
  const target = path.join(actualDir, filename);
  await page.screenshot({ path: target, animations: "disabled" });
  paths.push(path.relative(root, target).replaceAll("\\", "/"));
}

type OverflowCheck = {
  surface: string;
  viewport: string;
  clientWidth: number;
  scrollWidth: number;
};

const NEW_SURFACE_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1348, height: 888 },
  { width: 768, height: 900 },
  { width: 390, height: 900 },
] as const;

async function assertNoHorizontalOverflow(
  page: Page,
  surface: string,
  overflowChecks: OverflowCheck[],
) {
  const measurement = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    ),
  }));
  const viewport = page.viewportSize();
  const label = `${surface} ${viewport?.width || 0}x${viewport?.height || 0}`;
  expect(
    measurement.scrollWidth,
    `${label} has page-level horizontal overflow`,
  ).toBeLessThanOrEqual(measurement.clientWidth + 1);
  overflowChecks.push({
    surface,
    viewport: `${viewport?.width || 0}x${viewport?.height || 0}`,
    ...measurement,
  });
}

async function screenshotNewSurfaceMatrix(
  page: Page,
  slug: string,
  paths: string[],
  overflowChecks: OverflowCheck[],
) {
  for (const viewport of NEW_SURFACE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    await assertNoHorizontalOverflow(page, slug, overflowChecks);
    await screenshot(
      page,
      `${slug}-${viewport.width}x${viewport.height}.png`,
      paths,
    );
  }
}

test("universal UI and final feature port is server-backed, scoped and non-destructive", async ({
  browser,
}) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, "utf8")) as {
    databaseUrl: string;
  };
  const database = new URL(config.databaseUrl);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  const credentials = JSON.parse(await readFile(credentialPath, "utf8")) as Credentials;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const contexts: BrowserContext[] = [];
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  const screenshotPaths: string[] = [];
  const overflowChecks: OverflowCheck[] = [];
  const externalNetworkViolations: string[] = [];
  const bootstrapDiagnosticEvents: string[] = [];
  const marker = `UNIVERSAL-${Date.now()}`;
  const notificationId = randomUUID();
  let conversationId = "";
  let messageId = "";
  let flowboardId = "";

  try {
    await db.connect();
    // The stack is disposable and local-only. Keep the feature/plan matrix in
    // this gate so shared acceptance fixtures remain unchanged: Doflow gets
    // the Enterprise Sales Intelligence entitlement, while the synthetic
    // future tenant exercises the STARTER fail-closed path.
    await db.query(
      `INSERT INTO public.platform_modules
         (key,name,description,category,"minTier","priceMonthly","isBeta","createdAt","updatedAt")
       VALUES ('crm.sales-intel','Sales Intelligence AI','Synthetic acceptance entitlement',
         'COMMERCIAL','ENTERPRISE',49,true,now(),now())
       ON CONFLICT (key) DO UPDATE SET
         name=excluded.name,description=excluded.description,category=excluded.category,
         "minTier"=excluded."minTier","priceMonthly"=excluded."priceMonthly",
         "isBeta"=excluded."isBeta","updatedAt"=now()`
    );
    await db.query(
      `INSERT INTO public.tenant_subscriptions
         ("tenantId","moduleKey",status,"trialEndsAt","expiresAt","assignedAt")
       SELECT id,'crm.sales-intel','ACTIVE',NULL,NULL,now()
       FROM public.tenants WHERE slug='doflow'
       ON CONFLICT ("tenantId","moduleKey") DO UPDATE SET
         status='ACTIVE',"trialEndsAt"=NULL,"expiresAt"=NULL`,
    );
    await db.query(
      `UPDATE public.tenants SET plan_tier='STARTER',updated_at=now()
       WHERE slug='acceptance-secondary' AND schema_name='acceptance_secondary'`,
    );

    const authContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
    contexts.push(authContext);
    await enforceLocalBrowserNetwork(authContext, externalNetworkViolations);
    const auth = await authContext.newPage();
    observe(auth, pageErrors, serverErrors);
    await auth.emulateMedia({ reducedMotion: "reduce" });
    await auth.goto("/login");
    await expect(auth.getByLabel("Email")).toBeVisible();
    await expect(auth.getByLabel("Password", { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(auth, "universal-auth-login", overflowChecks);
    await screenshot(auth, "universal-auth-login-390x900.png", screenshotPaths);

    const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(ownerContext);
    await enforceLocalBrowserNetwork(ownerContext, externalNetworkViolations);
    const owner = await login(ownerContext, credentials.email, credentials, {
      mfa: true,
      target: "/dashboard",
      diagnosticEvents: bootstrapDiagnosticEvents,
    });
    observe(owner, pageErrors, serverErrors);
    await waitForUniversalShell(owner, true, bootstrapDiagnosticEvents);
    await expect(owner.locator('[data-sidebar-kind="tenant"]')).toBeVisible();
    await expect(owner.locator('a[href*="flow-arcade"]')).toHaveCount(0);

    const ownerMe = await appFetch(owner, "/auth/me");
    expect(ownerMe.json.user).toMatchObject({
      role: "owner",
      tenantSlug: "doflow",
      authStage: "FULL",
    });
    expect((await appFetch(owner, "/superadmin/tenants")).status).toBe(403);

    const createdConversation = await mutation(
      owner,
      "/tenant/collaboration/conversations",
      "POST",
      {
        title: `Team ${marker}`,
        kind: "group",
        participantIds: [MANAGER_ID],
      },
    );
    expect(createdConversation.ok, createdConversation.text).toBe(true);
    conversationId = String(createdConversation.json.id);
    const createdMessage = await mutation(
      owner,
      `/tenant/collaboration/conversations/${conversationId}/messages`,
      "POST",
      { body: `Messaggio ${marker}`, mentionUserIds: [MANAGER_ID] },
    );
    expect(createdMessage.ok, createdMessage.text).toBe(true);
    messageId = String(createdMessage.json.id);
    const persistedMessages = await appFetch(
      owner,
      `/tenant/collaboration/conversations/${conversationId}/messages`,
    );
    expect(persistedMessages.ok, persistedMessages.text).toBe(true);
    expect(persistedMessages.json.items.map((item: any) => item.id)).toContain(messageId);
    expect(
      (
        await mutation(owner, "/tenant/collaboration/conversations", "POST", {
          title: "actor spoof",
          participantIds: [MANAGER_ID],
          userId: MANAGER_ID,
        })
      ).status,
    ).toBe(400);

    const callStatus = await appFetch(owner, "/tenant/collaboration/calls/status");
    expect(callStatus.ok, callStatus.text).toBe(true);
    expect(callStatus.json).toMatchObject({ enabled: false, status: "disabled" });
    expect(JSON.stringify(callStatus.json)).not.toMatch(/api.?key|secret|token/i);
    expect(
      (
        await mutation(owner, "/tenant/collaboration/calls/token", "POST", {
          conversationId,
        })
      ).status,
    ).toBe(403);

    await owner.goto("/dashboard/team-space");
    await waitForUniversalShell(owner, true);
    await expect(owner.locator('main[data-team-space-source="server"]')).toBeVisible();
    await expect(owner.getByRole("heading", { name: "Team Space", exact: true })).toBeVisible();
    await expect(
      owner.getByText(`Team ${marker}`, { exact: true }).first(),
    ).toBeVisible();
    await expect(owner.getByText("2 partecipanti", { exact: true })).toBeVisible();
    await owner.getByRole("button", { name: "Menziona membri" }).click();
    const mentionPicker = owner.locator('[data-mention-picker="conversation-participants"]');
    await expect(mentionPicker.getByText("Visual Manager", { exact: true })).toBeVisible();
    await expect(mentionPicker.getByText("Visual Editor", { exact: true })).toHaveCount(0);
    await owner.getByRole("button", { name: "Menziona membri" }).click();
    await expect(owner.getByRole("button", { name: "Chiama" })).toHaveCount(0);
    await screenshotNewSurfaceMatrix(
      owner,
      "universal-team-space-livekit-off",
      screenshotPaths,
      overflowChecks,
    );

    await appFetch(owner, "/tenant/notifications");
    await db.query(
      `INSERT INTO doflow.notifications
       (id,recipient_user_id,title,body,type,priority,status,fingerprint,created_by)
       VALUES ($1,$2,$3,$4,'system','medium','unread',$5,$2)`,
      [
        notificationId,
        OWNER_ID,
        `Inbox ${marker}`,
        `Contenuto sintetico ${marker}`,
        `universal-inbox:${marker}`,
      ],
    );
    const inboxApi = await appFetch(owner, "/tenant/notifications?limit=20");
    expect(inboxApi.ok, inboxApi.text).toBe(true);
    expect(inboxApi.json.items.map((item: any) => item.id)).toContain(notificationId);

    await owner.goto("/dashboard/inbox");
    await waitForUniversalShell(owner, true);
    await expect(owner.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
    await expect(owner.getByText(`Inbox ${marker}`, { exact: true })).toBeVisible();
    await owner.getByText(`Inbox ${marker}`, { exact: true }).click();
    await expect(owner.getByRole("heading", { name: `Inbox ${marker}`, exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await db.query(
          "SELECT read_at IS NOT NULL AS read FROM doflow.notifications WHERE id=$1",
          [notificationId],
        );
        return rows.rows[0]?.read;
      })
      .toBe(true);
    await owner.setViewportSize({ width: 768, height: 900 });
    const inboxDetail = owner.locator('[data-inbox-pane="detail"]');
    await expect(inboxDetail).toBeVisible();
    expect((await inboxDetail.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(300);
    await screenshotNewSurfaceMatrix(
      owner,
      "universal-inbox-server-backed",
      screenshotPaths,
      overflowChecks,
    );

    const createdFlowboard = await mutation(owner, "/tenant/flowboards", "POST", {
      name: `Flowboard ${marker}`,
      description: "Fixture locale non distruttiva",
      collaborators: [{ userId: MANAGER_ID, permission: "view" }],
    });
    expect(createdFlowboard.ok, createdFlowboard.text).toBe(true);
    flowboardId = String(createdFlowboard.json.id);
    const flowboard = await appFetch(owner, `/tenant/flowboards/${flowboardId}`);
    expect(flowboard.ok, flowboard.text).toBe(true);
    expect(flowboard.json.name).toBe(`Flowboard ${marker}`);
    expect(
      (await appFetch(owner, "/tenant/flowboards?tenant=doflow")).status,
    ).toBe(400);

    await owner.goto("/dashboard/flowboard");
    await waitForUniversalShell(owner, true);
    await expect(owner.getByRole("heading", { name: "Flowboard", exact: true })).toBeVisible();
    await expect(owner.getByText(`Flowboard ${marker}`, { exact: true })).toBeVisible();
    await screenshotNewSurfaceMatrix(
      owner,
      "universal-flowboard",
      screenshotPaths,
      overflowChecks,
    );

    const provider = await appFetch(owner, "/tenant/company-intelligence/provider");
    expect(provider.ok, provider.text).toBe(true);
    expect(provider.json).toMatchObject({
      provider: "apollo",
      configured: false,
      status: "provider_unconfigured",
    });
    expect(JSON.stringify(provider.json)).not.toMatch(/api.?key|secret|token/i);
    const noProviderReport = await mutation(
      owner,
      "/tenant/company-intelligence",
      "POST",
      { domain: "acceptance.invalid" },
    );
    expect(noProviderReport.ok, noProviderReport.text).toBe(true);
    expect(noProviderReport.json).toMatchObject({
      configured: false,
      status: "provider_unconfigured",
      report: null,
    });
    await owner.goto("/dashboard/company-intelligence");
    await waitForUniversalShell(owner, true);
    await expect(
      owner.getByRole("heading", { name: "Company Intelligence", exact: true }),
    ).toBeVisible();
    await screenshotNewSurfaceMatrix(
      owner,
      "universal-company-intelligence",
      screenshotPaths,
      overflowChecks,
    );

    const adjustmentKey = randomUUID();
    const adjustment = await mutation(
      owner,
      "/tenant/bonus/adjustments",
      "POST",
      { userId: OWNER_ID, points: 25, reason: `Acceptance ${marker}` },
      adjustmentKey,
    );
    expect(adjustment.ok, adjustment.text).toBe(true);
    const repeatedAdjustment = await mutation(
      owner,
      "/tenant/bonus/adjustments",
      "POST",
      { userId: OWNER_ID, points: 25, reason: `Acceptance ${marker}` },
      adjustmentKey,
    );
    expect(repeatedAdjustment.ok, repeatedAdjustment.text).toBe(true);
    expect(repeatedAdjustment.json.id).toBe(adjustment.json.id);
    const bonus = await appFetch(owner, "/tenant/bonus");
    expect(bonus.ok, bonus.text).toBe(true);
    expect(Number(bonus.json.wallet.balance)).toBe(25);
    expect(bonus.json.ledger.filter((item: any) => item.id === adjustment.json.id)).toHaveLength(1);
    await owner.goto("/dashboard/bonus");
    await waitForUniversalShell(owner, true);
    await expect(owner.getByRole("heading", { name: "Bonus", exact: true })).toBeVisible();
    await screenshotNewSurfaceMatrix(
      owner,
      "universal-bonus",
      screenshotPaths,
      overflowChecks,
    );

    const arcade = await ownerContext.request.get(
      "http://localhost:3100/dashboard/flow-arcade",
      { maxRedirects: 0 },
    );
    expect(arcade.status()).toBe(404);
    await expect(owner.locator('a[href*="flow-arcade"]')).toHaveCount(0);

    expect(
      (await appFetch(owner, "/tenant/commercial/site-proposals?limit=1")).status,
    ).toBe(404);
    const builderRoute = await ownerContext.request.get(
      "http://localhost:3100/commercial/site-proposals",
      { maxRedirects: 0 },
    );
    expect(builderRoute.status()).toBe(404);
    await expect(owner.locator('a[href="/commercial/site-proposals"]')).toHaveCount(0);

    const secondaryContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(secondaryContext);
    await enforceLocalBrowserNetwork(secondaryContext, externalNetworkViolations);
    const secondary = await login(
      secondaryContext,
      "secondary.owner@acceptance.invalid",
      credentials,
      { target: "/dashboard" },
    );
    observe(secondary, pageErrors, serverErrors);
    await waitForUniversalShell(secondary);
    await expect(secondary.locator('[data-sidebar-kind="tenant"]')).toBeVisible();
    await expect(secondary.getByText("Acceptance Secondary", { exact: true }).first()).toBeVisible();
    await expect(secondary.locator('a[href="/commercial/site-proposals"]')).toHaveCount(0);
    await expect(secondary.locator('a[href*="flow-arcade"]')).toHaveCount(0);
    expect(
      (
        await appFetch(
          secondary,
          `/tenant/collaboration/conversations/${conversationId}`,
        )
      ).status,
    ).toBe(403);
    expect([403, 404]).toContain(
      (await appFetch(secondary, `/tenant/flowboards/${flowboardId}`)).status,
    );
    // The synthetic secondary tenant is STARTER: the global PRO entitlement
    // guard rejects these requests before controller-level spoof validation.
    expect((await appFetch(secondary, "/tenant/flowboards?tenant=doflow")).status).toBe(403);
    expect((await appFetch(secondary, `/tenant/bonus?userId=${OWNER_ID}`)).status).toBe(403);
    await screenshot(
      secondary,
      "universal-future-tenant-shell-1440x900.png",
      screenshotPaths,
    );

    const tenantScopedSuperadmin = await browser.newContext();
    contexts.push(tenantScopedSuperadmin);
    await enforceLocalBrowserNetwork(tenantScopedSuperadmin, externalNetworkViolations);
    const tenantScopedLogin = await directLogin(
      tenantScopedSuperadmin,
      "final.tenant-superadmin@acceptance.invalid",
      credentials.password,
    );
    expect(tenantScopedLogin.status()).toBe(201);
    expect(
      (
        await tenantScopedSuperadmin.request.get(
          "http://localhost:3401/api/superadmin/tenants",
          { headers: { Origin: "http://localhost:3100", "X-Doflow-Web": "1" } },
        )
      ).status(),
    ).toBe(403);

    const platformContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(platformContext);
    await enforceLocalBrowserNetwork(platformContext, externalNetworkViolations);
    const platform = await login(
      platformContext,
      "platform.superadmin@acceptance.invalid",
      credentials,
      { mfa: true, target: "/superadmin" },
    );
    observe(platform, pageErrors, serverErrors);
    await waitForUniversalShell(platform);
    await expect(platform.getByRole("heading", { name: "Control Room", exact: true })).toBeVisible();
    expect((await appFetch(platform, "/superadmin/tenants")).status).toBe(200);
    expect((await appFetch(platform, "/tenant/flowboards")).status).toBe(403);
    await expect(platform.locator('a[href*="flow-arcade"]')).toHaveCount(0);
    await screenshot(platform, "universal-platform-shell-1440x900.png", screenshotPaths);

    const persistence = (
      await db.query(
        `SELECT
          (SELECT COUNT(*)::int FROM doflow.conversation_messages WHERE id=$1) AS messages,
          (SELECT COUNT(*)::int FROM doflow.flowboards WHERE id=$2) AS flowboards,
          (SELECT COUNT(*)::int FROM doflow.point_ledger
             WHERE event_type='manual_adjustment' AND metadata->>'idempotency_key'=$3) AS bonus_entries,
          (SELECT COUNT(*)::int FROM doflow.notifications WHERE id=$4 AND read_at IS NOT NULL) AS read_notifications,
          (SELECT COUNT(*)::int FROM acceptance_secondary.conversations WHERE id=$5) AS leaked_conversations,
          (SELECT COUNT(*)::int FROM acceptance_secondary.flowboards WHERE id=$2) AS leaked_flowboards`,
        [
          messageId,
          flowboardId,
          adjustmentKey,
          notificationId,
          conversationId,
        ],
      )
    ).rows[0];
    expect(persistence).toEqual({
      messages: 1,
      flowboards: 1,
      bonus_entries: 1,
      read_notifications: 1,
      leaked_conversations: 0,
      leaked_flowboards: 0,
    });
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
    expect(externalNetworkViolations).toEqual([]);

    await writeFile(
      resultPath,
      JSON.stringify(
        {
          verdict: "UNIVERSAL FEATURES ISOLATED GO",
          marker,
          stack: {
            database: "localhost PostgreSQL",
            redis: "localhost Redis",
            frontend: "http://localhost:3100",
            backend: "http://localhost:3401",
            dbSync: false,
          },
          shell: { doflow: true, futureTenant: true, platform: true },
          builder: { extracted: true, frontendReachability: 0, backendReachability: 0 },
          teamSpace: {
            serverBacked: true,
            conversationId,
            messageId,
            liveKit: "READY HIDDEN — CLOUD ACTIVATION PENDING",
          },
          inbox: { serverBacked: true, notificationId, readPersisted: true },
          flowboard: { serverBacked: true, flowboardId, isolated: true },
          companyIntelligence: { providerConfigured: false, graceful: true },
          bonus: { serverBacked: true, idempotent: true, isolated: true },
          access: {
            ownerDeniedPlatform: true,
            tenantScopedSuperadminDeniedPlatform: true,
            platformSuperadminAllowedPlatform: true,
            platformSuperadminDeniedTenant: true,
          },
          flowArcade: { status: 404, navigationEntries: 0 },
          persistence,
          pageErrors,
          serverErrors,
          externalNetworkViolations,
          screenshotSafety: {
            productionData: false,
            populatedSensitiveInputs: 0,
            identities: "synthetic acceptance users only",
          },
          horizontalOverflow: {
            checks: overflowChecks.length,
            result: "pass",
            measurements: overflowChecks,
          },
          screenshots: screenshotPaths,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await db.end().catch(() => undefined);
  }
});
