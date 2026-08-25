import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';

const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');

async function installAuthSandbox(page: Page, handler?: (route: Route, pathname: string) => Promise<boolean>) {
  await page.addInitScript(() => {
    if (window.name === '__doflow_auth_visual_initialized__') return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.name = '__doflow_auth_visual_initialized__';
  });
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (handler && await handler(route, pathname)) return;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function authScreenshot(page: Page, filename: string, extraMasks: Locator[] = []) {
  await page.screenshot({
    path: path.join(actualDir, filename),
    animations: 'disabled',
    fullPage: true,
    mask: [page.locator('input'), ...extraMasks],
    maskColor: '#E2E8F0',
    style: 'nextjs-portal { display: none !important; }',
  });
}

test('auth desktop: login Doflow coerente e accessibile', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Accedi a Doflow', exact: true })).toBeVisible();
  await expect(page.getByText('Workspace operativo per commerciale, produzione e amministrazione.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Inserisci la tua email')).toBeVisible();
  await expect(page.getByPlaceholder('Inserisci la tua password')).toBeVisible();
  await expect(page.getByLabel('Ricordami')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Password dimenticata?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continua con Google' })).toBeVisible();
  await expect(page.locator('img[alt="Doflow"]:visible')).toBeVisible();
  await expect(page.getByText('Dal primo contatto alla consegna, tutto nello stesso flusso.', { exact: true })).toBeVisible();
  for (const label of ['Lead e clienti', 'Progetti e attività', 'Controllo e consegna']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1672);
  const sections = page.locator('main > section');
  await expect(sections).toHaveCount(2);
  const formBox = await sections.first().locator(':scope > div').boundingBox();
  expect(formBox?.width).toBeGreaterThanOrEqual(420);
  expect(formBox?.width).toBeLessThanOrEqual(450);
  expect(formBox?.x).toBeGreaterThanOrEqual(145);
  expect(formBox?.x).toBeLessThanOrEqual(180);
  await authScreenshot(page, 'auth-login-reference-desktop.png');
  await page.getByRole('button', { name: 'Cambia tema' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('img[src*="logo_doflow_bianco"]:visible')).toBeVisible();
  await authScreenshot(page, 'auth-login-reference-desktop-dark.png');
});

test('auth responsive: viewport richieste 1440x900 e 768x900', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await expect(page.getByText('Dal primo contatto alla consegna, tutto nello stesso flusso.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await authScreenshot(page, 'auth-login-reference-1440x900.png');

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByText('Dal primo contatto alla consegna, tutto nello stesso flusso.', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await authScreenshot(page, 'auth-login-reference-768x900.png');
});

test('auth desktop: registrazione canonica senza piano o settore', async ({ page }) => {
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/check-slug') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
      return true;
    }
    return false;
  });
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crea il tuo account.' })).toBeVisible();
  await expect(page.getByLabel('Azienda', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Indirizzo aziendale')).toBeVisible();
  await page.getByLabel('Indirizzo aziendale').fill('studio-visual');
  await expect(page.getByText('Indirizzo disponibile')).toBeVisible();
  await expect(page.getByText(/piano/i)).toHaveCount(0);
  await expect(page.getByText(/settore/i)).toHaveCount(0);
  await authScreenshot(page, 'auth-register-desktop.png');
});

test('auth errore: credenziali invalide mostrano un messaggio generico', async ({ page }) => {
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/login' && route.request().method() === 'POST') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'dettaglio interno da non mostrare' }) });
      return true;
    }
    return false;
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('visual@example.test');
  await page.getByLabel('Password', { exact: true }).fill('password-errata');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.locator('.df-auth-error')).toContainText('Credenziali non valide');
  await expect(page.locator('.df-auth-error')).not.toContainText('dettaglio interno');
  await authScreenshot(page, 'auth-login-invalid.png');
});

test('auth MFA: setup esplicito con QR e OTP nel medesimo shell', async ({ page }) => {
  let authStage = 'MFA_SETUP_NEEDED';
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/session-stage') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authStage, tenantSlug: 'doflow' }) });
      return true;
    }
    if (pathname === '/api/auth/mfa/setup') {
      const qr = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="white"/><rect x="30" y="30" width="120" height="120" fill="black"/></svg>').toString('base64')}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ secret: 'VISUAL-SECRET-NOT-REAL', qrCodeUrl: qr, otpauthUrl: 'otpauth://visual' }),
      });
      return true;
    }
    return false;
  });
  await page.goto('/doflow/mfa');
  await expect(page.getByRole('heading', { name: 'Configura MFA' })).toBeVisible();
  await expect(page.getByLabel('Codice di verifica a 6 cifre')).toBeVisible();
  await expect(page.getByRole('button', { name: /Attiva e Accedi/ })).toBeDisabled();
  await authScreenshot(page, 'auth-mfa-setup.png', [page.getByAltText('QR Code'), page.locator('code')]);

  authStage = 'MFA_PENDING';
  await page.goto('/doflow/mfa');
  await expect(page.getByRole('heading', { name: 'Verifica accesso' })).toBeVisible();
  await expect(page.getByAltText('QR Code')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verifica Codice' })).toBeDisabled();
  await authScreenshot(page, 'auth-mfa-verify.png');
});

test('auth recovery: forgot, reset e invito condividono identità e rimuovono token dalla URL', async ({ page }) => {
  await installAuthSandbox(page);
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Password dimenticata' })).toBeVisible();
  await expect(page.locator('img[alt="Doflow"]:visible')).toBeVisible();

  await page.goto('/reset-password?token=reset-secret-value');
  await expect(page.getByRole('heading', { name: 'Reimposta password' })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);

  await page.goto('/accept-invite?token=invite-secret-value&tenant=doflow');
  await expect(page.getByRole('heading', { name: 'Attiva account' })).toBeVisible();
  await expect(page).toHaveURL(/\/accept-invite$/);
  await authScreenshot(page, 'auth-invite-consistency.png');
});

test('auth tablet: login opaco resta utilizzabile a 1024x768', async ({ page }) => {
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/login' && route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { tenantSlug: 'doflow', role: 'owner' }, mfa: { required: false, stage: 'FULL' } }),
      });
      return true;
    }
    return false;
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Continua con Google' })).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Password dimenticata?' })).toBeInViewport();
  await expect(page.getByLabel('Email')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await expect(page.getByText('Dal primo contatto alla consegna, tutto nello stesso flusso.', { exact: true })).toBeVisible();
  await authScreenshot(page, 'auth-login-reference-tablet.png');
  await page.getByLabel('Email').fill('visual@example.test');
  await page.getByLabel('Password', { exact: true }).fill('password-safe');
  await page.getByLabel('Ricordami').check();
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => window.localStorage.getItem('doflow_token'))).toBeNull();
  expect(await page.evaluate(() => window.sessionStorage.getItem('doflow_token'))).toBeNull();
});

test('auth mobile: login completo e utilizzabile a 390x844', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.locator('img[alt="Doflow"]:visible')).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Accedi a Doflow', exact: true })).toBeInViewport();
  await expect(page.getByLabel('Email')).toBeInViewport();
  await expect(page.getByLabel('Password', { exact: true })).toBeInViewport();
  await expect(page.getByLabel('Ricordami')).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Password dimenticata?' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Continua con Google' })).toBeInViewport();
  await expect(page.getByText('Dal primo contatto alla consegna, tutto nello stesso flusso.', { exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel('Email').focus();
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await authScreenshot(page, 'auth-login-reference-mobile.png');
});

test('auth mobile: registrazione resta completa a 390x844', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crea il tuo account.' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crea account' })).toBeVisible();
  await authScreenshot(page, 'auth-register-mobile.png');
});

test('auth handoff Doflow: nessun JWT in URL o Web Storage', async ({ page }) => {
  let exchanges = 0;
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/handoff/exchange') {
      exchanges += 1;
      const body = route.request().postDataJSON();
      expect(body).toEqual({ handoff: 'opaque-handoff-code-12345678901234567890', tenantTarget: 'doflow' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'login', tenantTarget: 'doflow', authStage: 'FULL', next: 'dashboard', rememberMe: false }),
      });
      return true;
    }
    return false;
  });
  await page.goto('/login?handoff=opaque-handoff-code-12345678901234567890&tenant=doflow');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(exchanges).toBe(1);
  const storage = await page.evaluate(() => ({
    local: window.localStorage.getItem('doflow_token'),
    session: window.sessionStorage.getItem('doflow_token'),
    href: window.location.href,
  }));
  expect(storage.local).toBeNull();
  expect(storage.session).toBeNull();
  expect(storage.href).not.toContain('accessToken');
  expect(storage.href).not.toContain('opaque-handoff-code');
});
