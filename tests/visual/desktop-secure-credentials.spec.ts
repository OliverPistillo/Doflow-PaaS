import { expect, test, type Browser, type BrowserContext, type Route } from '@playwright/test';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';

declare global {
  interface Window {
    __DOFLOW_CREDENTIAL_TEST__?: { staged: boolean; invalidated: boolean; taken: number };
  }
}

async function desktopContext(browser: Browser, savedCredential = false, bridgeVersion = 3) {
  const context = await browser.newContext();
  await context.addInitScript(({ withSavedCredential, bridgeVersion }) => {
    const state = {
      staged: sessionStorage.getItem('__DOFLOW_TEST_STAGED__') === '1',
      invalidated: false,
      taken: 0,
    };
    window.__DOFLOW_CREDENTIAL_TEST__ = state;
    Object.defineProperty(window, '__DOFLOW_DESKTOP__', {
      configurable: false,
      writable: false,
      value: Object.freeze({
        isDesktop: true,
        platform: 'windows',
        appVersion: '1.1.3',
        bridgeVersion,
        profileId: '10000000-4000-4000-8000-000000000001',
        profileEmail: 'synthetic@example.test',
        desktopReady: async () => undefined,
        registerProfileMetadata: async () => ({ credentialStatus: 'none' }),
        stageDesktopPassword: async (password: string) => {
          state.staged = password.length > 0;
          sessionStorage.setItem('__DOFLOW_TEST_STAGED__', state.staged ? '1' : '0');
        },
        discardStagedDesktopPassword: async () => undefined,
        takeSavedDesktopPassword: async () => {
          state.taken += 1;
          return withSavedCredential
            ? { email: 'synthetic@example.test', password: 'synthetic-browser-value' }
            : null;
        },
        invalidateSavedDesktopPassword: async () => {
          state.invalidated = true;
          return true;
        },
        requestProfileSwitch: async () => undefined,
        getUpdateState: async () => ({ kind: 'none', currentVersion: '1.1.3', policySource: 'none', updateAvailable: false }),
        installCurrentVerifiedUpdate: async () => undefined,
        startDesktopGoogleOAuth: async () => undefined,
      }),
    });
  }, { withSavedCredential: savedCredential, bridgeVersion });
  return context;
}

async function routeLogin(context: BrowserContext, status: number, body: Record<string, unknown>) {
  await context.route('**/api/auth/login', async (route: Route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

const success = {
  user: { tenantSlug: 'doflow', schema: 'doflow', role: 'owner', authStage: 'FULL' },
  mfa: { required: false, stage: 'FULL' },
};

test('secure password opt-in is Desktop-only and stages only after a successful password login', async ({ browser }) => {
  const browserOnly = await browser.newContext();
  const browserPage = await browserOnly.newPage();
  await browserPage.goto(`${frontendOrigin}/login`);
  await expect(browserPage.getByText('Salva la password in modo sicuro su questo dispositivo')).toHaveCount(0);
  await browserOnly.close();

  const failedContext = await desktopContext(browser);
  await routeLogin(failedContext, 401, { message: 'invalid' });
  const failedPage = await failedContext.newPage();
  await failedPage.goto(`${frontendOrigin}/login`);
  await expect(failedPage.getByLabel('Email')).toHaveValue('synthetic@example.test');
  await failedPage.getByLabel('Password', { exact: true }).fill('synthetic-browser-value');
  await failedPage.getByLabel('Salva la password in modo sicuro su questo dispositivo').check();
  await failedPage.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(failedPage.locator('.auth-error')).toContainText('Credenziali non valide');
  expect(await failedPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.staged)).toBe(false);
  await failedContext.close();

  const successContext = await desktopContext(browser);
  await routeLogin(successContext, 200, success);
  const successPage = await successContext.newPage();
  await successPage.goto(`${frontendOrigin}/login`);
  await expect(successPage.getByLabel('Email')).toHaveValue('synthetic@example.test');
  await successPage.getByLabel('Password', { exact: true }).fill('synthetic-browser-value');
  await successPage.getByLabel('Salva la password in modo sicuro su questo dispositivo').check();
  await successPage.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect.poll(() => successPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.staged)).toBe(true);
  await successContext.close();

  const noOptInContext = await desktopContext(browser);
  await noOptInContext.route('**/dashboard', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>Dashboard fixture</body></html>' });
  });
  await routeLogin(noOptInContext, 200, success);
  const noOptInPage = await noOptInContext.newPage();
  await noOptInPage.goto(`${frontendOrigin}/login`);
  await expect(noOptInPage.getByLabel('Email')).toHaveValue('synthetic@example.test');
  await noOptInPage.getByLabel('Password', { exact: true }).fill('synthetic-browser-value');
  await noOptInPage.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(noOptInPage).toHaveURL(/\/dashboard$/);
  expect(await noOptInPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.staged)).toBe(false);
  await noOptInContext.close();
});

test('Desktop 1.1.3 bridge v2 keeps login usable and hides the unsupported secure credential option', async ({ browser }) => {
  const context = await desktopContext(browser, false, 2);
  const runtimeErrors: string[] = [];
  const page = await context.newPage();
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto(`${frontendOrigin}/login`);
  await expect(page.getByLabel('Email')).toHaveValue('synthetic@example.test');
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Salva la password in modo sicuro su questo dispositivo')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
  await context.close();
});

test('saved password is attempted once, invalidated only by typed login rejection and preserved otherwise', async ({ browser }) => {
  const invalidContext = await desktopContext(browser, true);
  await routeLogin(invalidContext, 401, { message: 'invalid', code: 'AUTH_INVALID_CREDENTIALS' });
  const invalidPage = await invalidContext.newPage();
  await invalidPage.goto(`${frontendOrigin}/login`);
  await expect(invalidPage.locator('.auth-error')).toContainText('password salvata non è più valida');
  expect(await invalidPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: true });
  await invalidContext.close();

  const transientContext = await desktopContext(browser, true);
  await routeLogin(transientContext, 503, { message: 'unavailable' });
  const transientPage = await transientContext.newPage();
  await transientPage.goto(`${frontendOrigin}/login`);
  await expect(transientPage.locator('.auth-error')).toContainText('Accesso automatico non riuscito');
  expect(await transientPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: false });
  await transientContext.close();

  const rateLimitedContext = await desktopContext(browser, true);
  await routeLogin(rateLimitedContext, 429, { message: 'Riprova più tardi.' });
  const rateLimitedPage = await rateLimitedContext.newPage();
  await rateLimitedPage.goto(`${frontendOrigin}/login`);
  await expect(rateLimitedPage.locator('.auth-error')).toContainText('Traffic Control');
  expect(await rateLimitedPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: false });
  await rateLimitedContext.close();

  const untyped401Context = await desktopContext(browser, true);
  await routeLogin(untyped401Context, 401, { message: 'generic unauthorized' });
  const untyped401Page = await untyped401Context.newPage();
  await untyped401Page.goto(`${frontendOrigin}/login`);
  await expect(untyped401Page.locator('.auth-error')).toContainText('Accesso automatico non riuscito');
  expect(await untyped401Page.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: false });
  await untyped401Context.close();

  const timeoutContext = await desktopContext(browser, true);
  await routeLogin(timeoutContext, 408, { message: 'timeout' });
  const timeoutPage = await timeoutContext.newPage();
  await timeoutPage.goto(`${frontendOrigin}/login`);
  await expect(timeoutPage.locator('.auth-error')).toContainText('Accesso automatico non riuscito');
  expect(await timeoutPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: false });
  await timeoutContext.close();

  const networkContext = await desktopContext(browser, true);
  await networkContext.route('**/api/auth/login', async (route) => route.abort('failed'));
  const networkPage = await networkContext.newPage();
  await networkPage.goto(`${frontendOrigin}/login`);
  await expect(networkPage.locator('.auth-error')).toContainText('Accesso automatico non riuscito');
  expect(await networkPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__)).toMatchObject({ taken: 1, invalidated: false });
  await networkContext.close();

  const mfaContext = await desktopContext(browser, true);
  await routeLogin(mfaContext, 200, {
    user: { tenantSlug: 'doflow', schema: 'doflow', role: 'owner', authStage: 'MFA_PENDING' },
    mfa: { required: true, stage: 'MFA_PENDING' },
  });
  const mfaPage = await mfaContext.newPage();
  await mfaPage.goto(`${frontendOrigin}/login`);
  await expect.poll(() => mfaPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.taken)).toBe(1);
  expect(await mfaPage.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.invalidated)).toBe(false);
  await mfaContext.close();
});

test('MFA remains the normal next step and secure enrollment does not store another factor', async ({ browser }) => {
  const context = await desktopContext(browser);
  await routeLogin(context, 200, {
    user: { tenantSlug: 'doflow', schema: 'doflow', role: 'owner', authStage: 'MFA_PENDING' },
    mfa: { required: true, stage: 'MFA_PENDING' },
  });
  const page = await context.newPage();
  await page.goto(`${frontendOrigin}/login`);
  await expect(page.getByLabel('Email')).toHaveValue('synthetic@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-browser-value');
  await page.getByLabel('Salva la password in modo sicuro su questo dispositivo').check();
  const mfaRequest = page.waitForRequest((request) => {
    return new URL(request.url()).pathname === '/doflow/mfa';
  });
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  expect((await mfaRequest).method()).toBe('GET');
  await expect.poll(() => page.evaluate(() => window.__DOFLOW_CREDENTIAL_TEST__?.staged)).toBe(true);
  expect(await page.evaluate((secret) => {
    return Object.values(localStorage).concat(Object.values(sessionStorage)).includes(secret);
  }, 'synthetic-browser-value')).toBe(false);
  await context.close();
});
