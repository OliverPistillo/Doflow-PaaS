import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const credentialPath = path.join(
  root,
  ".visual-auth",
  "acceptance-credentials.json",
);
const secondaryStateUrl = "**/api/tenant/doflow/document-revenue/state";
const coreOpportunitiesUrl =
  /\/api\/tenant\/crm\/opportunities(?:\?|$)/;

type Credentials = { email: string; password: string; mfaSecret: string };

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const character of normalized) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
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
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(buffer)
    .digest();
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

async function loadCredentials(): Promise<Credentials> {
  return JSON.parse(await readFile(credentialPath, "utf8")) as Credentials;
}

async function loginWithMfa(page: Page) {
  const credentials = await loadCredentials();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(/\/doflow\/mfa$/);
  await page
    .getByLabel("Codice di verifica a 6 cifre")
    .fill(await stableTotp(page, credentials.mfaSecret));
  await page.getByRole("button", { name: "Verifica Codice" }).click();
  await page.waitForURL(/\/dashboard$/);
}

function shell(page: Page) {
  return page.locator('main[data-app-shell-ready="true"]').first();
}

test("a delayed secondary request leaves the shell and essential workspace ready", async ({
  page,
}) => {
  let releaseSecondary!: () => void;
  const secondaryReleased = new Promise<void>((resolve) => {
    releaseSecondary = resolve;
  });
  let secondaryRequests = 0;
  await page.route(secondaryStateUrl, async (route) => {
    secondaryRequests += 1;
    await secondaryReleased;
    await route.continue();
  });

  await loginWithMfa(page);
  await expect(shell(page)).toBeVisible();
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "true");
  await expect(shell(page)).toHaveAttribute("data-secondary-status", "loading");
  await expect(
    shell(page)
      .getByRole("status")
      .filter({ hasText: "Caricamento dei dati secondari" }),
  ).toBeVisible();
  expect(secondaryRequests).toBe(1);

  releaseSecondary();
  await expect(shell(page)).toHaveAttribute("data-secondary-status", "ready");
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "true");
});

test("an optional 500 is controlled and one explicit retry starts one new request", async ({
  page,
}) => {
  let secondaryRequests = 0;
  await page.route(secondaryStateUrl, async (route) => {
    secondaryRequests += 1;
    if (secondaryRequests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Errore secondario sintetico" }),
      });
      return;
    }
    await route.continue();
  });

  await loginWithMfa(page);
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "true");
  await expect(shell(page)).toHaveAttribute("data-secondary-status", "error");
  await expect(
    shell(page)
      .getByRole("alert")
      .filter({ hasText: "Workspace temporaneamente non disponibile" }),
  ).toBeVisible();
  expect(secondaryRequests).toBe(1);

  await page.getByRole("button", { name: "Riprova dati secondari" }).click();
  await expect(shell(page)).toHaveAttribute("data-secondary-status", "ready");
  expect(secondaryRequests).toBe(2);
});

test("a core 401 redirects to login instead of leaving an infinite loader", async ({
  page,
}) => {
  await loginWithMfa(page);
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "true");
  await page.route(coreOpportunitiesUrl, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Sessione sintetica non valida" }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login\?next=/);
  await expect(page.getByRole("button", { name: "Accedi", exact: true })).toBeVisible();
});

test("a core 403 keeps main mounted with a controlled access error", async ({
  page,
}) => {
  await loginWithMfa(page);
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "true");
  await page.route(coreOpportunitiesUrl, async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "Accesso sintetico negato" }),
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(shell(page)).toBeVisible();
  await expect(shell(page)).toHaveAttribute("data-workspace-status", "error");
  await expect(shell(page)).toHaveAttribute("data-workspace-ready", "false");
  await expect(
    shell(page)
      .getByRole("alert")
      .filter({ hasText: "Accesso al workspace non consentito" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
