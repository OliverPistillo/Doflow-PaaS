import { expect, test, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const credentialsPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const outputDirectory = path.join(
  root,
  'docs/design-references/doflow-crm-projects/actual',
);

type Credentials = { email: string; password: string; mfaSecret: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
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
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function login(page: Page, credentials: Credentials) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForURL(/\/doflow\/mfa$/, { timeout: 15_000 });
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  await page.getByLabel('Codice di verifica a 6 cifre').fill(totp(credentials.mfaSecret));
  await page.getByRole('button', { name: 'Verifica Codice' }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
}

const routes = [
  { path: '/dashboard/preventivi', heading: 'Preventivi', slug: 'preventivi' },
  { path: '/dashboard/contratti', heading: 'Contratti', slug: 'contratti' },
  { path: '/dashboard/fatture', heading: 'Fatture e note di credito', slug: 'fatture' },
  { path: '/dashboard/rinnovi', heading: 'Rinnovi', slug: 'rinnovi' },
] as const;

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;

test('Document & Revenue visual QA autenticata', async ({ browser }) => {
  const credentials = JSON.parse(
    await readFile(credentialsPath, 'utf8'),
  ) as Credentials;
  await mkdir(outputDirectory, { recursive: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await login(page, credentials);

    for (const theme of ['default'] as const) {
      for (const route of routes) {
        const summaryResponse = route.slug === 'fatture'
          ? page.waitForResponse(
              (response) => response.url().includes('/document-revenue/summary'),
              { timeout: 20_000 },
            )
          : null;
        await page.goto(route.path);
        await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
        if (summaryResponse) expect((await summaryResponse).ok()).toBe(true);
        await page.waitForTimeout(750);
        await page.evaluate(() => {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
          localStorage.removeItem('doflow_theme');
          localStorage.removeItem('theme');
        });
        await expect(page.locator('[data-doflow-shell="daniele-design"][data-doflow-theme="default"]')).toHaveCount(1);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: path.join(outputDirectory, `document-revenue-${route.slug}-${theme}-${viewport.name}.png`),
          animations: 'disabled',
        });
      }
    }

    expect(pageErrors).toEqual([]);
    await context.close();
  }
});
