import { AuthController } from '../auth.controller';
import { AuthMiddleware } from '../auth.middleware';

function controllerFixture(loginResult: Record<string, unknown>) {
  const authService = {
    loginAuto: jest.fn().mockResolvedValue(loginResult),
    verifyMfaLogin: jest.fn().mockResolvedValue({ token: 'legacy-mfa-jwt' }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const loginGuard = {
    checkBeforeLogin: jest.fn().mockResolvedValue(undefined),
    resetFailures: jest.fn().mockResolvedValue(undefined),
    registerFailure: jest.fn().mockResolvedValue(undefined),
  };
  const handoff = { createLogin: jest.fn(), exchange: jest.fn() };
  const webSessions = {
    isBrowserRequest: jest.fn((request: { headers?: Record<string, string> }) =>
      request.headers?.['x-doflow-web'] === '1' || Boolean(request.headers?.origin),
    ),
    create: jest.fn().mockResolvedValue(undefined),
    rotate: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  };
  return {
    authService,
    webSessions,
    controller: new AuthController(
      authService as any,
      audit as any,
      loginGuard as any,
      handoff as any,
      webSessions as any,
    ),
  };
}

describe('cookie-only browser auth contract', () => {
  const publicLogin = {
    token: 'legacy-browser-visible-jwt',
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.invalid',
      role: 'superadmin',
      tenantId: 'public',
      tenantSlug: 'public',
      authStage: 'FULL',
    },
    mfa: { required: false, stage: 'FULL' },
  };

  it('crea una sessione HttpOnly anche per public/Superadmin e non restituisce JWT al browser', async () => {
    const fixture = controllerFixture(publicLogin);
    const result = await fixture.controller.login(
      { email: 'admin@example.invalid', password: 'synthetic-password', rememberMe: true },
      { headers: { 'x-doflow-web': '1' } } as any,
      {} as any,
    );

    expect(fixture.webSessions.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ tenantSlug: 'public', role: 'superadmin', authStage: 'FULL' }),
      true,
    );
    expect(result).not.toHaveProperty('token');
    expect(result).toHaveProperty('user.tenantSlug', 'public');
  });

  it('mantiene il bearer soltanto per un consumer non-browser separato', async () => {
    const fixture = controllerFixture(publicLogin);
    const result = await fixture.controller.login(
      { email: 'admin@example.invalid', password: 'synthetic-password' },
      { headers: {} } as any,
      {} as any,
    );
    expect(result).toHaveProperty('token', 'legacy-browser-visible-jwt');
    expect(fixture.webSessions.create).not.toHaveBeenCalled();
  });

  it('non restituisce JWT a un browser che omette X-Doflow-Web', async () => {
    const fixture = controllerFixture(publicLogin);
    const result = await fixture.controller.login(
      { email: 'admin@example.invalid', password: 'synthetic-password' },
      { headers: { origin: 'https://app.doflow.it' } } as any,
      {} as any,
    );
    expect(result).not.toHaveProperty('token');
    expect(fixture.webSessions.create).toHaveBeenCalledTimes(1);
  });

  it('ruota la sessione MFA e restituisce soltanto stato non sensibile', async () => {
    const fixture = controllerFixture(publicLogin);
    const result = await fixture.controller.mfaVerify(
      { code: '123456' },
      {
        headers: { 'x-doflow-web': '1' },
        user: { ...publicLogin.user, sub: publicLogin.user.id, authStage: 'MFA_PENDING' },
      } as any,
      {} as any,
    );
    expect(fixture.webSessions.rotate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ authStage: 'FULL', tenantSlug: 'public' }),
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('rifiuta un Authorization header su una richiesta dichiarata browser', async () => {
    const middleware = new AuthMiddleware({
      isBrowserRequest: jest.fn().mockReturnValue(true),
      resolve: jest.fn(),
    } as any);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await middleware.use(
      { headers: { 'x-doflow-web': '1', authorization: 'Bearer forbidden' } } as any,
      response as any,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'BROWSER_BEARER_FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
  });
});
