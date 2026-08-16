import { expect, test } from '@playwright/test';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const imageAssets = [
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/icon-192.png',
  '/icon-512.png',
] as const;

test('favicon Doflow: asset HTTP, manifest, dimensioni e metadata DOM', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.doflow-topbar')).toBeVisible();

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

  const iconPaths = await page.locator('head link[rel="icon"]').evaluateAll((links) => (
    links.map((link) => new URL((link as HTMLLinkElement).href).pathname)
  ));
  expect(iconPaths).toContain('/favicon.ico');
  expect(iconPaths).toContain('/icon.png');
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute('href', /\/apple-icon\.png/);
  await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
});
