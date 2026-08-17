import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';

const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.visual-signature`;
}

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
  });
}

test('auth desktop: login Doflow coerente e accessibile', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bentornato', exact: true })).toBeVisible();
  await expect(page.getByText('Accedi al tuo spazio di lavoro', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Inserisci la tua email')).toBeVisible();
  await expect(page.getByPlaceholder('Inserisci la tua password')).toBeVisible();
  await expect(page.getByLabel('Ricordami')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Password dimenticata?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continua con Google' })).toBeVisible();
  await expect(page.locator('.df-auth-logo-img')).toBeVisible();
  await expect(page.getByTestId('login-official-mascot')).toBeVisible();
  await expect(page.getByTestId('login-official-mascot')).toHaveAttribute('src', /mascotte_login/);
  for (const label of ['Lead', 'Contatto', 'Proposta', 'Cliente']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  for (const title of ['Gestisci i clienti', 'Segui il pipeline', 'Organizza le attività', 'Automatizza i processi']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1672);
  const cardBox = await page.locator('.df-login-card').boundingBox();
  const leadBox = await page.locator('.df-login-step-lead').boundingBox();
  expect(cardBox?.x).toBeGreaterThanOrEqual(155);
  expect(cardBox?.x).toBeLessThanOrEqual(185);
  expect((leadBox?.x ?? 0) - ((cardBox?.x ?? 0) + (cardBox?.width ?? 0))).toBeLessThan(80);
  const mascotBox = await page.getByTestId('login-official-mascot').boundingBox();
  expect(mascotBox?.width).toBeGreaterThanOrEqual(340);
  expect(mascotBox?.width).toBeLessThanOrEqual(375);
  const flowStageBox = await page.getByTestId('login-flow-stage').boundingBox();
  expect(flowStageBox?.y).toBeGreaterThanOrEqual(60);
  expect(flowStageBox?.y).toBeLessThanOrEqual(75);
  const geometry = await page.evaluate(() => {
    const stepCards = [...document.querySelectorAll<HTMLElement>('.df-login-step-card')];
    const stepRects = stepCards.map((element) => element.getBoundingClientRect());
    const centers = stepRects.map((rect) => rect.left + rect.width / 2);
    const distances = centers.slice(1).map((center, index) => center - centers[index]);
    const path = document.querySelector<SVGPathElement>('.df-login-pipeline-accent');
    const mascot = document.querySelector<HTMLElement>('.df-login-mascot-image');
    if (!path || !mascot) throw new Error('Login hero geometry unavailable');
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error('Login flow transform unavailable');
    const totalLength = path.getTotalLength();
    const screenPointAtX = (targetX: number) => {
      let closest = { x: 0, y: 0, distance: Number.POSITIVE_INFINITY };
      for (let index = 0; index <= 400; index += 1) {
        const point = path.getPointAtLength((totalLength * index) / 400);
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        const distance = Math.abs(screenPoint.x - targetX);
        if (distance < closest.distance) closest = { x: screenPoint.x, y: screenPoint.y, distance };
      }
      return closest;
    };
    const flowGaps = stepRects.map((rect) => screenPointAtX(rect.left + rect.width / 2).y - rect.bottom);
    const mascotRect = mascot.getBoundingClientRect();
    const mascotVisibleBottom = mascotRect.top + mascotRect.height * 0.82;
    const mascotFlowGap = screenPointAtX(mascotRect.left + mascotRect.width / 2).y - mascotVisibleBottom;
    const benefits = document.querySelector<HTMLElement>('.df-login-benefits')?.getBoundingClientRect();
    const benefitRects = [...document.querySelectorAll<HTMLElement>('.df-login-benefit')]
      .map((element) => element.getBoundingClientRect());
    const benefitIcon = document.querySelector<HTMLElement>('.df-login-benefit-icon');
    const benefitTitle = document.querySelector<HTMLElement>('.df-login-benefit strong');
    const benefitBody = document.querySelector<HTMLElement>('.df-login-benefit p');
    if (!benefitIcon || !benefitTitle || !benefitBody) throw new Error('Login benefit styles unavailable');
    const benefitGaps = benefitRects.slice(1).map((rect, index) => rect.left - benefitRects[index].right);
    return {
      distances,
      flowGaps,
      mascotFlowGap,
      benefits: benefits ? { center: benefits.left + benefits.width / 2, width: benefits.width } : null,
      benefitWidths: benefitRects.map((rect) => rect.width),
      benefitGaps,
      benefitReadability: {
        iconSize: Number.parseFloat(getComputedStyle(benefitIcon).width),
        titleSize: Number.parseFloat(getComputedStyle(benefitTitle).fontSize),
        bodySize: Number.parseFloat(getComputedStyle(benefitBody).fontSize),
      },
    };
  });
  for (const distance of geometry.distances) expect(distance).toBeGreaterThanOrEqual(255);
  for (const distance of geometry.distances) expect(distance).toBeLessThanOrEqual(315);
  expect(Math.max(...geometry.distances) - Math.min(...geometry.distances)).toBeLessThanOrEqual(30);
  for (const gap of geometry.flowGaps) expect(gap).toBeGreaterThanOrEqual(18);
  expect(geometry.mascotFlowGap).toBeGreaterThanOrEqual(15);
  expect(geometry.mascotFlowGap).toBeLessThanOrEqual(30);
  expect(Math.abs((geometry.benefits?.center ?? 0) - 836)).toBeLessThanOrEqual(25);
  expect(geometry.benefits?.width).toBeGreaterThanOrEqual(820);
  expect(geometry.benefits?.width).toBeLessThanOrEqual(890);
  expect(geometry.benefitReadability?.iconSize).toBeGreaterThanOrEqual(48);
  expect(geometry.benefitReadability?.titleSize).toBeGreaterThanOrEqual(15.5);
  expect(geometry.benefitReadability?.bodySize).toBeGreaterThanOrEqual(13.5);
  expect(Math.max(...geometry.benefitWidths) - Math.min(...geometry.benefitWidths)).toBeLessThanOrEqual(1);
  for (const gap of geometry.benefitGaps) expect(gap).toBeGreaterThanOrEqual(20);
  for (const gap of geometry.benefitGaps) expect(gap).toBeLessThanOrEqual(28);
  await expect(page.locator('.df-login-pipeline circle')).toHaveCount(0);
  await expect(page.locator('.df-login-pipeline-energy')).toHaveCSS('animation-name', 'df-login-pipeline-flow');
  await expect(page.locator('.df-login-pipeline-light')).toHaveCSS('animation-name', 'df-login-pipeline-flow');
  await expect(page.locator('.df-login-pipeline-energy')).toHaveCSS('stroke-dasharray', /0\.2/);
  await expect(page.locator('.df-login-pipeline-light')).toHaveCSS('stroke-dasharray', /0\.18/);
  await expect(page.locator('.df-login-pipeline-energy')).not.toHaveCSS('stroke', /(?:white|#fff|rgb\(255,\s*255,\s*255\))/i);
  await expect(page.locator('.df-login-pipeline-light')).not.toHaveCSS('stroke', /(?:white|#fff|rgb\(255,\s*255,\s*255\))/i);
  await expect(page.locator('.df-login-step-lead')).toHaveCSS('animation-name', /df-login-step-float/);
  expect(await page.locator('.df-login-step-lead').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return style.backdropFilter || style.webkitBackdropFilter;
  })).toContain('blur');
  await authScreenshot(page, 'auth-login-final-scale-desktop.png');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.df-login-pipeline-light')).toHaveCSS('animation-name', 'none');
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
  const token = fakeJwt({ sub: 'visual-user', tenantId: 'doflow', tenantSlug: 'doflow', role: 'owner', authStage: 'MFA_SETUP_NEEDED' });
  await installAuthSandbox(page, async (route, pathname) => {
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
  await page.addInitScript((value) => {
    if (!window.sessionStorage.getItem('doflow_token')) {
      window.sessionStorage.setItem('doflow_token', value);
    }
  }, token);
  await page.goto('/doflow/mfa');
  await expect(page.getByRole('heading', { name: 'Configura MFA' })).toBeVisible();
  await expect(page.getByLabel('Codice di verifica a 6 cifre')).toBeVisible();
  await expect(page.getByRole('button', { name: /Attiva e Accedi/ })).toBeDisabled();
  await authScreenshot(page, 'auth-mfa-setup.png', [page.getByAltText('QR Code'), page.locator('code')]);

  const pendingToken = fakeJwt({ sub: 'visual-user', tenantId: 'doflow', tenantSlug: 'doflow', role: 'owner', authStage: 'MFA_PENDING' });
  await page.evaluate((value) => window.sessionStorage.setItem('doflow_token', value), pendingToken);
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
  await expect(page.locator('.df-auth-logo-img')).toBeVisible();

  await page.goto('/reset-password?token=reset-secret-value');
  await expect(page.getByRole('heading', { name: 'Reimposta password' })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);

  await page.goto('/accept-invite?token=invite-secret-value&tenant=doflow');
  await expect(page.getByRole('heading', { name: 'Attiva account' })).toBeVisible();
  await expect(page).toHaveURL(/\/accept-invite$/);
  await authScreenshot(page, 'auth-invite-consistency.png');
});

test('auth tablet: login resta utilizzabile a 1024x768', async ({ page }) => {
  const token = fakeJwt({ sub: 'visual-user', tenantId: 'doflow', tenantSlug: 'doflow', role: 'owner', authStage: 'FULL' });
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/login' && route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token, user: { tenantSlug: 'doflow', role: 'owner' }, mfa: { required: false, stage: 'FULL' } }),
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
  const tabletMascotBox = await page.getByTestId('login-official-mascot').boundingBox();
  expect(tabletMascotBox?.width).toBeGreaterThanOrEqual(235);
  expect(tabletMascotBox?.width).toBeLessThanOrEqual(270);
  await authScreenshot(page, 'auth-login-final-scale-tablet.png');
  await page.getByLabel('Email').fill('visual@example.test');
  await page.getByLabel('Password', { exact: true }).fill('password-safe');
  await page.getByLabel('Ricordami').check();
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => window.localStorage.getItem('doflow_token'))).toBe(token);
  expect(await page.evaluate(() => window.sessionStorage.getItem('doflow_token'))).toBeNull();
});

test('auth mobile: login completo e utilizzabile a 390x844', async ({ page }) => {
  await installAuthSandbox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.locator('.df-auth-logo-img')).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Bentornato', exact: true })).toBeInViewport();
  await expect(page.getByLabel('Email')).toBeInViewport();
  await expect(page.getByLabel('Password', { exact: true })).toBeInViewport();
  await expect(page.getByLabel('Ricordami')).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Password dimenticata?' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Continua con Google' })).toBeInViewport();
  await expect(page.locator('.df-login-showcase')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await authScreenshot(page, 'auth-login-final-scale-mobile.png');
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

test('auth handoff: nessun JWT in URL, exchange singolo e sessionStorage senza Ricordami', async ({ page }) => {
  const token = fakeJwt({ sub: 'visual-user', tenantId: 'doflow', tenantSlug: 'doflow', role: 'owner', authStage: 'FULL' });
  let exchanges = 0;
  await installAuthSandbox(page, async (route, pathname) => {
    if (pathname === '/api/auth/handoff/exchange') {
      exchanges += 1;
      const body = route.request().postDataJSON();
      expect(body).toEqual({ handoff: 'opaque-handoff-code-12345678901234567890', tenantTarget: 'doflow' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'login', token, tenantTarget: 'doflow', authStage: 'FULL', next: 'dashboard', rememberMe: false }),
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
  expect(storage.session).toBe(token);
  expect(storage.href).not.toContain('accessToken');
  expect(storage.href).not.toContain(token);
});
