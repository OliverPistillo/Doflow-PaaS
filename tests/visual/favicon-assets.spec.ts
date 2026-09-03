import { expect, test, type Page } from '@playwright/test';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const blackMark = '/brand/marchio_logo_nero.svg';
const whiteMark = '/brand/marchio_logo_bianco.svg';
const imageAssets = [
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  blackMark,
  whiteMark,
] as const;

async function setTheme(page: Page, theme: 'light' | 'dark' | 'system', colorScheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => localStorage.setItem('doflow_theme', value), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
}

async function faviconPath(page: Page) {
  return page.locator('head link[rel="icon"]').evaluate((link) => new URL((link as HTMLLinkElement).href).pathname);
}

test('favicon Doflow: asset HTTP, manifest e dimensioni canoniche', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  for (const asset of imageAssets) {
    const response = await page.request.get(`${frontendOrigin}${asset}`);
    expect(response.status(), asset).toBe(200);
    expect(response.headers()['content-type'], asset).toContain('image/');
    expect((await response.body()).byteLength, asset).toBeGreaterThan(0);
  }

  const manifestResponse = await page.request.get(`${frontendOrigin}/site.webmanifest`);
  expect(manifestResponse.status()).toBe(200);
  expect(await manifestResponse.json()).toEqual({
    name: 'Doflow',
    short_name: 'Doflow',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
  });

  const dimensions = await page.evaluate(async (assets) => {
    const entries = await Promise.all(assets.map((asset) => new Promise<[string, { width: number; height: number }]>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve([asset, { width: image.naturalWidth, height: image.naturalHeight }]));
      image.addEventListener('error', () => reject(new Error(`Impossibile caricare ${asset}`)));
      image.src = asset;
    })));
    return Object.fromEntries(entries);
  }, ['/icon.png', '/apple-icon.png', '/icon-192.png', '/icon-512.png']);
  expect(dimensions).toEqual({
    '/icon.png': { width: 512, height: 512 },
    '/apple-icon.png': { width: 180, height: 180 },
    '/icon-192.png': { width: 192, height: 192 },
    '/icon-512.png': { width: 512, height: 512 },
  });

  await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute('href', /\/apple-icon\.png/);
  await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
});

test('favicon segue light, dark e system risolto al reload', async ({ page }) => {
  await setTheme(page, 'light', 'dark');
  expect(await faviconPath(page)).toBe(blackMark);

  await setTheme(page, 'dark', 'light');
  expect(await faviconPath(page)).toBe(whiteMark);

  await setTheme(page, 'system', 'light');
  expect(await faviconPath(page)).toBe(blackMark);

  await setTheme(page, 'system', 'dark');
  expect(await faviconPath(page)).toBe(whiteMark);
});

test('favicon cambia live con il tema applicativo e con il tema OS in system', async ({ page }) => {
  await setTheme(page, 'light', 'light');
  expect(await faviconPath(page)).toBe(blackMark);
  await page.getByRole('button', { name: 'Cambia tema' }).click();
  await expect.poll(() => faviconPath(page)).toBe(whiteMark);
  await page.getByRole('button', { name: 'Cambia tema' }).click();
  await expect.poll(() => faviconPath(page)).toBe(blackMark);

  await setTheme(page, 'system', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => faviconPath(page)).toBe(whiteMark);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => faviconPath(page)).toBe(blackMark);
});

test('favicon resta unica tra storage event, nuova tab e navigazione App Router', async ({ page, context }) => {
  await setTheme(page, 'light', 'light');
  await page.evaluate(() => {
    localStorage.setItem('doflow_theme', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'doflow_theme', newValue: 'dark' }));
  });
  await expect.poll(() => faviconPath(page)).toBe(whiteMark);
  await page.getByRole('link', { name: 'Password dimenticata?' }).click();
  await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
  expect(await faviconPath(page)).toBe(whiteMark);

  const second = await context.newPage();
  await second.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(second.locator('head link[rel="icon"]')).toHaveCount(1);
  expect(await faviconPath(second)).toBe(whiteMark);
  await second.close();
});

test('favicon SSR/no-JavaScript usa un solo fallback nero', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  try {
    await page.goto(`${frontendOrigin}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
    expect(await faviconPath(page)).toBe(blackMark);
  } finally {
    await context.close();
  }
});
