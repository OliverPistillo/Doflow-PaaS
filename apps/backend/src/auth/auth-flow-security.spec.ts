import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import { AuthController } from '../auth.controller';
import { AuthPasswordController } from '../auth-password.controller';
import { AuthService } from '../auth.service';
import { AuthMiddleware } from '../auth.middleware';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { GoogleAuthController } from './google.controller';
import { SignupService } from './signup.service';
import { SignupController } from './signup.controller';

const req = (user?: Record<string, unknown>, tenantId = 'public') => ({
  headers: {},
  tenantId,
  user,
  authUser: user,
}) as any;

describe('Auth flow security contract', () => {
  function controller(overrides: Record<string, unknown> = {}) {
    const authService = {
      loginAuto: jest.fn(),
      acceptInvite: jest.fn(),
      generateMfaSetup: jest.fn(),
      confirmMfaAndEnable: jest.fn(),
      verifyMfaLogin: jest.fn(),
      ...overrides,
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const guard = {
      checkBeforeLogin: jest.fn().mockResolvedValue(undefined),
      registerFailure: jest.fn().mockResolvedValue(undefined),
      resetFailures: jest.fn().mockResolvedValue(undefined),
    };
    const webSessions = {
      create: jest.fn().mockResolvedValue(undefined),
      rotate: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    return {
      authService,
      audit,
      guard,
      webSessions,
      value: new AuthController(
        authService as any,
        audit as any,
        guard as any,
        {} as any,
        webSessions as any,
      ),
    };
  }

  it('protegge /auth/me con JwtAuthGuard e richiede stage FULL', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.getMe) || [];
    expect(guards).toContain(JwtAuthGuard);
    const { value } = controller();
    expect(() => value.getMe(req())).toThrow(UnauthorizedException);
    expect(() => value.getMe(req({ sub: 'u1', authStage: 'MFA_PENDING' })))
      .toThrow(ForbiddenException);
    expect(value.getMe(req({ sub: 'u1', id: 'u1', email: 'safe@example.test', role: 'user', tenantId: 'doflow', authStage: 'FULL' })))
      .toMatchObject({ user: { id: 'u1', tenantId: 'doflow', authStage: 'FULL' } });
  });

  it('rifiuta payload JWT invalidi prima di creare una sessione', async () => {
    const strategy = new JwtStrategy(
      { get: () => 'strategy-test-secret-with-enough-entropy' } as any,
      { query: jest.fn() } as any,
    );
    await expect(strategy.validate({ tenantId: 'doflow', authStage: 'FULL' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy.validate({ sub: 'u1', tenantId: 'doflow', authStage: 'UNKNOWN' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rende autorevole lo stato tenant corrente per bearer JWT già emessi', async () => {
    const suspended = new JwtStrategy(
      { get: () => 'strategy-test-secret-with-enough-entropy' } as any,
      { query: jest.fn().mockResolvedValue([{ id: 'u1', email: 'member@example.test', role: 'user', is_active: false }]) } as any,
    );
    await expect(suspended.validate({ sub: 'u1', tenantId: 'doflow', role: 'owner', authStage: 'FULL' }))
      .rejects.toBeInstanceOf(UnauthorizedException);

    const demoted = new JwtStrategy(
      { get: () => 'strategy-test-secret-with-enough-entropy' } as any,
      { query: jest.fn().mockResolvedValue([{ id: 'u1', email: 'member@example.test', role: 'viewer', is_active: true }]) } as any,
    );
    await expect(demoted.validate({ sub: 'u1', tenantId: 'doflow', role: 'owner', authStage: 'FULL' }))
      .resolves.toMatchObject({ sub: 'u1', tenantId: 'doflow', role: 'viewer' });
  });

  it('mantiene un solo controller MFA canonico nel modulo', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule) as Function[];
    expect(controllers.filter((item) => item === AuthController)).toHaveLength(1);
    expect(controllers.map((item) => item.name)).not.toContain('AuthMfaController');
  });

  it('restituisce sempre 401 generico per login non valido', async () => {
    const { value, guard } = controller({ loginAuto: jest.fn().mockRejectedValue(new Error('tenant detail')) });
    await expect(value.login({ email: 'person@example.test', password: 'wrong' }, req(), {} as any))
      .rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED, message: 'Credenziali non valide' });
    expect(guard.registerFailure).toHaveBeenCalledTimes(1);
  });

  it('marca soltanto il rifiuto credenziali tipizzato come invalidabile dal Desktop', async () => {
    const invalid = controller({
      loginAuto: jest.fn().mockRejectedValue(new UnauthorizedException('Credenziali non valide')),
    });
    let invalidError: UnauthorizedException | undefined;
    try {
      await invalid.value.login(
        { email: 'person@example.test', password: 'wrong' },
        req(),
        {} as any,
      );
    } catch (error) {
      invalidError = error as UnauthorizedException;
    }
    expect(invalidError?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(invalidError?.getResponse()).toMatchObject({
      message: 'Credenziali non valide',
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    const infrastructure = controller({
      loginAuto: jest.fn().mockRejectedValue(new Error('synthetic infrastructure failure')),
    });
    let infrastructureError: UnauthorizedException | undefined;
    try {
      await infrastructure.value.login(
        { email: 'person@example.test', password: 'wrong' },
        req(),
        {} as any,
      );
    } catch (error) {
      infrastructureError = error as UnauthorizedException;
    }
    expect(infrastructureError?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(infrastructureError?.getResponse()).not.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('preserva HTTP 429 senza registrare un nuovo fallimento', async () => {
    const { value, guard } = controller();
    guard.checkBeforeLogin.mockRejectedValue(new HttpException('Troppi tentativi', HttpStatus.TOO_MANY_REQUESTS));
    await expect(value.login({ email: 'person@example.test', password: 'wrong' }, req(), {} as any))
      .rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(guard.registerFailure).not.toHaveBeenCalled();
  });

  it('rifiuta endpoint MFA usati con lo stage sbagliato', async () => {
    const { value } = controller();
    await expect(value.mfaVerify({ code: '123456' }, req({ sub: 'u1', authStage: 'FULL' }), {} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(value.mfaConfirm({ code: '123456', secret: 'secret' }, req({ sub: 'u1', authStage: 'MFA_PENDING' }), {} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AuthService tenant and MFA boundaries', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'auth-service-test-secret-with-enough-entropy'; });
  afterAll(() => { process.env.JWT_SECRET = originalSecret; });

  it('non cerca utenti scandendo gli schemi tenant', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new AuthService(dataSource as any);
    await expect(service.loginAuto(req(undefined, 'public'), 'missing@example.test', 'wrong'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
    expect(dataSource.query.mock.calls[0][0]).toContain('public.users');
  });

  it('non promuove a public un ruolo superadmin associato a un tenant', async () => {
    const passwordHash = await bcrypt.hash('password-safe', 4);
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ tenant_id: 'tenant-id', role: 'superadmin' }])
        .mockResolvedValueOnce([{ schema_name: 'doflow' }])
        .mockResolvedValueOnce([{ slug: 'doflow' }])
        .mockResolvedValueOnce([{ is_active: true }])
        .mockResolvedValueOnce([{
          id: 'u1', email: 'scoped@example.test', password_hash: passwordHash,
          created_at: new Date().toISOString(), role: 'superadmin',
          mfa_enabled: false, mfa_secret: null,
        }]),
    };
    const service = new AuthService(dataSource as any);
    const result = await service.loginAuto(
      req(undefined, 'public'),
      'scoped@example.test',
      'password-safe',
    );

    expect(result.user).toMatchObject({ tenantId: 'doflow', tenantSlug: 'doflow' });
    expect(dataSource.query.mock.calls.some(([sql]) => sql.includes('from "public"."users"')))
      .toBe(false);
    expect(dataSource.query.mock.calls.some(([sql]) => sql.includes('from "doflow"."users"')))
      .toBe(true);
  });

  it('non espone più il percorso legacy /auth/register', () => {
    expect(Object.getOwnPropertyNames(AuthController.prototype)).not.toContain('register');
  });

  it.each([
    [false, null, 'FULL'],
    [true, 'MFA-SECRET', 'MFA_PENDING'],
    [true, null, 'MFA_SETUP_NEEDED'],
  ] as const)('emette lo stage corretto per mfa_enabled=%s secret=%s', async (mfaEnabled, mfaSecret, expectedStage) => {
    const passwordHash = await bcrypt.hash('password-safe', 4);
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ slug: 'acme' }])
        .mockResolvedValueOnce([{ is_active: true }])
        .mockResolvedValueOnce([{
          id: 'u1', email: 'valid@example.test', password_hash: passwordHash,
          created_at: new Date().toISOString(), role: 'owner',
          mfa_enabled: mfaEnabled, mfa_secret: mfaSecret,
        }]),
    };
    const service = new AuthService(dataSource as any);
    const result = await service.loginAuto(req(undefined, 'tenant_acme'), 'valid@example.test', 'password-safe');
    expect(result.mfa.stage).toBe(expectedStage);
    expect((jwt.verify(result.token, process.env.JWT_SECRET!) as any).authStage).toBe(expectedStage);
  });

  it('nega il login quando il tenant è disabilitato', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ slug: 'acme' }])
        .mockResolvedValueOnce([{ is_active: false }]),
    };
    const service = new AuthService(dataSource as any);
    await expect(service.loginAuto(req(undefined, 'tenant_acme'), 'valid@example.test', 'password-safe'))
      .rejects.toThrow('Tenant disabled');
  });

  it('nega il login password quando il tenant user è sospeso', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ slug: 'acme' }])
        .mockResolvedValueOnce([{ is_active: true }])
        .mockResolvedValueOnce([{
          id: '11111111-1111-4111-8111-111111111111',
          email: 'suspended@example.test',
          password_hash: 'unused',
          role: 'user',
          mfa_enabled: false,
          mfa_secret: null,
          is_active: false,
        }]),
    };
    const service = new AuthService(dataSource as any);
    await expect(service.loginAuto(req(undefined, 'tenant_acme'), 'suspended@example.test', 'password-safe'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('non persiste un secret MFA prima della conferma OTP valida', async () => {
    const dataSource = { query: jest.fn() };
    const service = new AuthService(dataSource as any);
    await expect(service.confirmMfaAndEnable(
      req({ sub: 'u1', email: 'safe@example.test', tenantId: 'doflow', tenantSlug: 'doflow', role: 'owner', authStage: 'MFA_SETUP_NEEDED' }),
      '000000',
      'NOT-A-VALID-SECRET',
    )).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rifiuta la verifica MFA fuori da MFA_PENDING prima di interrogare dati', async () => {
    const dataSource = { query: jest.fn() };
    const service = new AuthService(dataSource as any);
    await expect(service.verifyMfaLogin(
      { sub: 'u1', tenantId: 'doflow', authStage: 'FULL' },
      '123456',
      req(),
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('un OTP valido trasforma MFA_PENDING in un token FULL sul tenant del JWT', async () => {
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ mfa_secret: secret, email: 'valid@example.test', role: 'owner', mfa_enabled: true }])
        .mockResolvedValueOnce([{ slug: 'acme' }]),
    };
    const service = new AuthService(dataSource as any);
    const result = await service.verifyMfaLogin(
      { sub: 'u1', tenantId: 'tenant_acme', tenantSlug: 'acme', authStage: 'MFA_PENDING' },
      code,
      req(undefined, 'wrong_tenant'),
    );
    const payload = jwt.verify(result.token, process.env.JWT_SECRET!) as any;
    expect(payload).toMatchObject({ tenantId: 'tenant_acme', tenantSlug: 'acme', authStage: 'FULL' });
    expect(dataSource.query.mock.calls[0][0]).toContain('"tenant_acme"."users"');
  });

  it('nega il completamento MFA quando nel frattempo l’account è stato sospeso', async () => {
    const secret = authenticator.generateSecret();
    const code = authenticator.generate(secret);
    const dataSource = {
      query: jest.fn().mockResolvedValueOnce([{
        mfa_secret: secret,
        email: 'suspended@example.test',
        role: 'user',
        mfa_enabled: true,
        is_active: false,
      }]),
    };
    const service = new AuthService(dataSource as any);
    await expect(service.verifyMfaLogin(
      { sub: 'u1', tenantId: 'tenant_acme', tenantSlug: 'acme', authStage: 'MFA_PENDING' },
      code,
      req(),
    )).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    [null, BadRequestException],
    [{ id: 'i1', email: 'invite@example.test', role: 'user', accepted_at: new Date().toISOString(), expires_at: null }, ConflictException],
    [{ id: 'i1', email: 'invite@example.test', role: 'user', accepted_at: null, expires_at: new Date(Date.now() - 60_000).toISOString() }, BadRequestException],
  ] as const)('rifiuta inviti mancanti, già usati o scaduti', async (invite, expectedError) => {
    const dataSource = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('select id::text as id')) {
          return [{ id: 'tenant-public-id', slug: 'acme', schema_name: 'tenant_acme' }];
        }
        if (sql.includes('select is_active')) return [{ is_active: true }];
        if (sql.includes('from "tenant_acme"."invites"')) return invite ? [invite] : [];
        return [];
      }),
    };
    const service = new AuthService(dataSource as any);
    await expect(service.acceptInvite(req(undefined, 'public'), 'invite-token', 'password-safe', 'acme'))
      .rejects.toBeInstanceOf(expectedError);
  });
});

describe('AuthMiddleware partial-session gate', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'auth-middleware-test-secret-with-enough-entropy'; });
  afterAll(() => { process.env.JWT_SECRET = originalSecret; });

  it('blocca risorse applicative con token partial e lascia passare il flusso MFA', async () => {
    const middleware = new AuthMiddleware({
      isBrowserRequest: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue(null),
    } as any);
    const token = jwt.sign({ sub: 'u1', tenantId: 'doflow', authStage: 'MFA_PENDING' }, process.env.JWT_SECRET!);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn();
    await middleware.use({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/projects' } as any, { status, json } as any, next);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(next).not.toHaveBeenCalled();

    await middleware.use({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/auth/mfa/verify' } as any, { status, json } as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('applica il gate MFA prima della revalidation DB e non può fallire aperto', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('synthetic transient database failure')),
    };
    const middleware = new AuthMiddleware({
      isBrowserRequest: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue(null),
    } as any, dataSource as any);
    const token = jwt.sign(
      { sub: 'u1', tenantId: 'doflow', authStage: 'MFA_SETUP_NEEDED' },
      process.env.JWT_SECRET!,
    );
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn();

    await middleware.use(
      { headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/tenant/team' } as any,
      { status, json } as any,
      next,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MFA_REQUIRED', stage: 'MFA_SETUP_NEEDED' }));
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('richiede CSRF anche per logout e MFA quando la sessione è cookie-based', async () => {
    const session = {
      user: {
        sub: 'u1', id: 'u1', email: 'safe@example.test', role: 'owner',
        tenantId: 'doflow', tenantSlug: 'doflow', authStage: 'FULL',
      },
      csrfToken: 'csrf',
    };
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue(session),
      assertCsrf: jest.fn(),
    };
    const middleware = new AuthMiddleware(webSessions as any);
    const next = jest.fn();
    await middleware.use(
      { headers: {}, method: 'POST', originalUrl: '/api/auth/logout' } as any,
      {} as any,
      next,
    );
    await middleware.use(
      { headers: {}, method: 'POST', originalUrl: '/api/auth/mfa/verify' } as any,
      {} as any,
      next,
    );
    expect(webSessions.assertCsrf).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it.each([
    '/api/auth/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/accept-invite',
    '/api/auth/handoff/exchange',
    '/api/auth/signup-tenant',
  ])('ignora una sessione stale nel bootstrap POST %s mantenendo il controllo Origin', async (originalUrl) => {
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(true),
      assertBrowserOrigin: jest.fn(),
      resolve: jest.fn().mockRejectedValue(new Error('la sessione stale non deve essere risolta')),
      assertCsrf: jest.fn(),
    };
    const middleware = new AuthMiddleware(webSessions as any);
    const next = jest.fn();

    await middleware.use(
      {
        headers: {
          origin: 'https://app.doflow.it',
          cookie: '__Host-doflow_session=synthetic-existing-session; doflow_csrf=stale',
          'x-csrf-token': 'stale',
        },
        method: 'POST',
        originalUrl: `${originalUrl}?source=browser`,
      } as any,
      {} as any,
      next,
    );

    expect(webSessions.assertBrowserOrigin).toHaveBeenCalledTimes(1);
    expect(webSessions.resolve).not.toHaveBeenCalled();
    expect(webSessions.assertCsrf).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rifiuta Origin estranea e browser bearer anche sui bootstrap anonimi', async () => {
    const forbiddenOrigin = new ForbiddenException('Origin browser non consentita');
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(true),
      assertBrowserOrigin: jest.fn(() => { throw forbiddenOrigin; }),
      resolve: jest.fn(),
    };
    const middleware = new AuthMiddleware(webSessions as any);

    await expect(middleware.use(
      { headers: { origin: 'https://evil.invalid' }, method: 'POST', originalUrl: '/api/auth/login' } as any,
      {} as any,
      jest.fn(),
    )).rejects.toBe(forbiddenOrigin);

    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await middleware.use(
      {
        headers: { origin: 'https://app.doflow.it', authorization: 'Bearer forbidden-browser-token' },
        method: 'POST',
        originalUrl: '/api/auth/login',
      } as any,
      response as any,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'BROWSER_BEARER_FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
    expect(webSessions.resolve).not.toHaveBeenCalled();
  });

  it.each([
    '/api/auth/logout',
    '/api/auth/mfa/confirm',
    '/api/auth/mfa/verify',
    '/api/auth/handoff',
    '/api/tenant/doflow/identity/preferences',
  ])('mantiene CSRF obbligatorio sulla mutation session-authenticated %s', async (originalUrl) => {
    const missingCsrf = new UnauthorizedException('Token CSRF non valido');
    const session = {
      user: {
        sub: 'u1', id: 'u1', email: 'safe@example.test', role: 'owner',
        tenantId: 'doflow', tenantSlug: 'doflow', authStage: 'FULL',
      },
      csrfToken: 'expected',
    };
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(true),
      assertBrowserOrigin: jest.fn(),
      resolve: jest.fn().mockResolvedValue(session),
      assertCsrf: jest.fn(() => { throw missingCsrf; }),
    };
    const middleware = new AuthMiddleware(webSessions as any);

    await expect(middleware.use(
      { headers: { origin: 'https://app.doflow.it' }, method: 'POST', originalUrl } as any,
      {} as any,
      jest.fn(),
    )).rejects.toBe(missingCsrf);
    expect(webSessions.resolve).toHaveBeenCalledTimes(1);
    expect(webSessions.assertCsrf).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('lascia passare una mutation protetta con Origin e CSRF validi', async () => {
    const session = {
      user: {
        sub: 'u1', id: 'u1', email: 'safe@example.test', role: 'owner',
        tenantId: 'doflow', tenantSlug: 'doflow', authStage: 'FULL',
      },
      csrfToken: 'expected',
    };
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(true),
      assertBrowserOrigin: jest.fn(),
      resolve: jest.fn().mockResolvedValue(session),
      assertCsrf: jest.fn(),
    };
    const next = jest.fn();
    await new AuthMiddleware(webSessions as any).use(
      {
        headers: { origin: 'https://app.doflow.it', 'x-csrf-token': 'expected' },
        method: 'POST',
        originalUrl: '/api/auth/logout',
      } as any,
      {} as any,
      next,
    );
    expect(webSessions.assertBrowserOrigin).toHaveBeenCalledTimes(1);
    expect(webSessions.assertCsrf).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('revoca e non autentica una sessione il cui tenant user è stato sospeso', async () => {
    const session = {
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        id: '11111111-1111-4111-8111-111111111111',
        email: 'suspended@example.test',
        role: 'user',
        tenantId: 'doflow',
        tenantSlug: 'doflow',
        authStage: 'FULL',
      },
      csrfToken: 'expected',
    };
    const webSessions = {
      isBrowserRequest: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue(session),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([{
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        is_active: false,
      }]),
    };
    const request = { headers: {}, method: 'GET', originalUrl: '/api/tenant/team' } as any;
    const next = jest.fn();
    await new AuthMiddleware(webSessions as any, dataSource as any).use(request, {} as any, next);
    expect(webSessions.revoke).toHaveBeenCalledWith(request);
    expect(request.authUser).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('Public signup contract', () => {
  function service(tenantRepo: Record<string, unknown> = { findOne: jest.fn().mockResolvedValue(null) }) {
    return new SignupService(
      tenantRepo as any,
      {} as any,
      {} as any,
      { query: jest.fn() } as any,
      {} as any,
      { consumeGoogleSignupGrant: jest.fn().mockResolvedValue(null) } as any,
    );
  }

  it('richiede accettazione esplicita dei termini', async () => {
    await expect(service().signup({
      email: 'new@example.test',
      password: 'password-safe',
      companyName: 'Example',
      slug: 'example-space',
      acceptTerms: false,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa HTTP 409 per slug già occupato', async () => {
    await expect(service({ findOne: jest.fn().mockResolvedValue({ id: 'existing' }) }).signup({
      email: 'new@example.test',
      password: 'password-safe',
      companyName: 'Example',
      slug: 'example-space',
      acceptTerms: true,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rifiuta slug non validi prima di aprire una transazione', async () => {
    await expect(service().signup({
      email: 'new@example.test', password: 'password-safe', companyName: 'Example',
      slug: 'doflow', acceptTerms: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea un tenant valido attraverso il solo flusso signup-tenant', async () => {
    const tenantRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
    };
    const manager = {
      connection: {},
      save: jest.fn().mockImplementation(async (value) => ({ id: 'tenant-id', ...value })),
      find: jest.fn().mockResolvedValue([]),
    };
    const queryRunner = {
      manager,
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(),
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 'owner-id', email: 'new@example.test', role: 'owner', created_at: new Date().toISOString() }])
        .mockResolvedValueOnce([]),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const bootstrap = { ensureTenantTables: jest.fn(), addTenantToCache: jest.fn() };
    const authHandoff = { consumeGoogleSignupGrant: jest.fn().mockResolvedValue(null) };
    const signup = new SignupService(tenantRepo as any, {} as any, {} as any, dataSource as any, bootstrap as any, authHandoff as any);
    await expect(signup.signup({
      email: 'new@example.test', password: 'password-safe', companyName: 'Example',
      slug: 'example-space', acceptTerms: true,
    })).resolves.toMatchObject({
      tenant: { slug: 'example-space', schemaName: 'example_space' },
      user: { role: 'owner', tenantId: 'example_space' },
      nextStep: 'onboarding',
    });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(bootstrap.addTenantToCache).toHaveBeenCalledWith('example-space');
  });

  it('preserva ThrottlerGuard e limite 5/ora sul signup pubblico', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SignupController) || [];
    expect(guards).toContain(ThrottlerGuard);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', SignupController.prototype.signupTenant)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', SignupController.prototype.signupTenant)).toBe(3_600_000);
  });
});

describe('Password recovery tenant binding', () => {
  it('risolve il tenant dalla directory pubblica senza scandire gli schemi', async () => {
    const conn = {
      query: jest.fn()
        .mockResolvedValueOnce([{ tenant_id: 'tenant-public-id', role: 'owner' }])
        .mockResolvedValueOnce([{ slug: 'doflow', schema_name: 'doflow', is_active: true }])
        .mockResolvedValueOnce([]),
    };
    const controller = new AuthPasswordController({ sendPasswordResetEmail: jest.fn() } as any);
    const response = { json: jest.fn((value) => value) };
    await controller.forgotPassword(
      { tenantId: 'public', tenantConnection: conn, headers: {} } as any,
      response as any,
      { email: 'known@example.test' },
    );
    expect(conn.query).toHaveBeenCalledTimes(3);
    expect(conn.query.mock.calls[2][0]).toContain('"doflow".users');
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it('consuma il reset token una sola volta nel tenant dichiarato', async () => {
    const validRow = {
      id: 7,
      email: 'known@example.test',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
      invalidated_at: null,
    };
    const runner = {
      query: jest.fn()
        .mockResolvedValueOnce([validRow])
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([{ id: '11111111-1111-4111-8111-111111111111' }])
        .mockResolvedValueOnce([]),
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), isTransactionActive: true,
    };
    const conn = {
      query: jest.fn()
        .mockResolvedValueOnce([{ slug: 'doflow', schema_name: 'doflow', is_active: true }]),
      createQueryRunner: jest.fn().mockReturnValue(runner),
    };
    const controller = new AuthPasswordController({} as any);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn((value) => value) };
    await controller.resetPassword(
      { tenantId: 'public', tenantConnection: conn, headers: {} } as any,
      response as any,
      { token: 'reset-token', password: 'password-safe', tenant: 'doflow' },
    );
    expect(runner.query.mock.calls[0][0]).toContain('"doflow".password_reset_tokens');
    expect(runner.query.mock.calls[1][0]).toContain('set used_at');
    expect(runner.query.mock.calls[2][0]).toContain('set password_hash');
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });

  it('rifiuta un reset token già usato senza riscrivere la password', async () => {
    const runner = {
      query: jest.fn().mockResolvedValueOnce([{
        id: 7, email: 'known@example.test', expires_at: new Date(Date.now() + 60_000).toISOString(),
        used_at: new Date().toISOString(), invalidated_at: null,
      }]),
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), isTransactionActive: true,
    };
    const conn = {
      query: jest.fn()
        .mockResolvedValueOnce([{ slug: 'doflow', schema_name: 'doflow', is_active: true }]),
      createQueryRunner: jest.fn().mockReturnValue(runner),
    };
    const controller = new AuthPasswordController({} as any);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn((value) => value) };
    await controller.resetPassword(
      { tenantId: 'public', tenantConnection: conn, headers: {} } as any,
      response as any,
      { token: 'reset-token', password: 'password-safe', tenant: 'doflow' },
    );
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});

describe('Google OAuth redirect security', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'google-test-secret-with-enough-entropy'; });
  afterAll(() => { process.env.JWT_SECRET = originalSecret; });

  const response = () => ({ redirect: jest.fn((url: string) => url) });

  it('usa handoff opaco per un utente Google esistente', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: 'u1', email: 'existing@example.test', role: 'owner', tenant_id: null,
          mfa_enabled: false, mfa_secret: null, is_active: true,
          schema_name: null, slug: null, tenant_active: null,
        }])
        .mockResolvedValueOnce([]),
    };
    const handoff = { createLogin: jest.fn().mockResolvedValue({ handoff: 'opaque-login-code' }) };
    const controller = new GoogleAuthController(dataSource as any, handoff as any);
    const res = response();
    await controller.googleCallback(req({ googleId: 'g1', email: 'existing@example.test', emailVerified: true }), res as any);
    const url = String(res.redirect.mock.calls[0][0]);
    expect(url).toContain('handoff=opaque-login-code');
    expect(url).toContain('tenant=public');
    expect(url).not.toContain('accessToken');
    expect(url).not.toContain('header.payload.signature');
  });

  it('usa handoff opaco anche per la nuova registrazione Google', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const handoff = { createGoogleSignup: jest.fn().mockResolvedValue({ handoff: 'opaque-signup-code' }) };
    const controller = new GoogleAuthController(dataSource as any, handoff as any);
    const res = response();
    await controller.googleCallback(req({ googleId: 'g2', email: 'new@example.test', emailVerified: true }), res as any);
    const url = String(res.redirect.mock.calls[0][0]);
    expect(url).toContain('/register?handoff=opaque-signup-code');
    expect(url).not.toContain('google_token');
    expect(url).not.toContain('new%40example.test');
  });
});
