import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PlatformSuperadminGuard } from './platform-superadmin.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

const JWT_SECRET = 'tenant-controller-test-secret-with-sufficient-length';

describe('TenantsController platform authorization', () => {
  let app: INestApplication;
  let baseUrl: string;

  const tenantsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    resetAdminPassword: jest.fn(),
  };

  function token(payload: Record<string, unknown>) {
    return jwt.sign(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'platform-test@example.invalid',
        tenantSlug: String(payload.tenantId || 'public'),
        ...payload,
      },
      JWT_SECRET,
      { expiresIn: '5m' },
    );
  }

  async function request(
    path: string,
    options: RequestInit = {},
    bearer?: string,
  ) {
    const headers = new Headers(options.headers);
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(`${baseUrl}${path}`, { ...options, headers });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [TenantsController],
      providers: [
        JwtStrategy,
        PlatformSuperadminGuard,
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        { provide: TenantsService, useValue: tenantsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tenantsService.findAll.mockResolvedValue([]);
    tenantsService.create.mockResolvedValue({ id: 'tenant-1' });
    tenantsService.updateStatus.mockResolvedValue({ id: 'tenant-1', isActive: false });
    tenantsService.delete.mockResolvedValue({ message: 'Tenant eliminato con successo' });
    tenantsService.resetAdminPassword.mockResolvedValue({ tempPassword: 'temporary' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without a JWT', async () => {
    const response = await request('/api/superadmin/tenants');
    expect(response.status).toBe(401);
    expect(tenantsService.findAll).not.toHaveBeenCalled();
  });

  it('returns 403 to a tenant owner', async () => {
    const response = await request(
      '/api/superadmin/tenants',
      {},
      token({ role: 'owner', tenantId: 'doflow', authStage: 'FULL' }),
    );
    expect(response.status).toBe(403);
    expect(tenantsService.findAll).not.toHaveBeenCalled();
  });

  it('allows a public FULL platform superadmin to list tenants', async () => {
    const response = await request(
      '/api/superadmin/tenants',
      {},
      token({ role: 'superadmin', tenantId: 'public', authStage: 'FULL' }),
    );
    expect(response.status).toBe(200);
    expect(tenantsService.findAll).toHaveBeenCalledTimes(1);
  });

  it('does not delegate DELETE when the platform guard denies access', async () => {
    const response = await request(
      '/api/superadmin/tenants/tenant-1',
      { method: 'DELETE' },
      token({ role: 'owner', tenantId: 'public', authStage: 'FULL' }),
    );
    expect(response.status).toBe(403);
    expect(tenantsService.delete).not.toHaveBeenCalled();
  });

  it('delegates DELETE exactly once for an authorized platform superadmin', async () => {
    const response = await request(
      '/api/superadmin/tenants/tenant-1',
      { method: 'DELETE' },
      token({ role: 'super_admin', tenantId: 'public', authStage: 'FULL' }),
    );
    expect(response.status).toBe(200);
    expect(tenantsService.delete).toHaveBeenCalledTimes(1);
    expect(tenantsService.delete).toHaveBeenCalledWith('tenant-1');
  });

  it('preserves create, status, reset-password and impersonation routes', async () => {
    const platformToken = token({ role: 'superadmin', tenantId: 'public', authStage: 'FULL' });
    const jsonHeaders = { 'Content-Type': 'application/json' };

    const createResponse = await request(
      '/api/superadmin/tenants',
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: 'Test', slug: 'test', email: 'admin@example.invalid' }),
      },
      platformToken,
    );
    expect(createResponse.status).toBe(201);
    expect(tenantsService.create).toHaveBeenCalledTimes(1);

    const statusResponse = await request(
      '/api/superadmin/tenants/tenant-1/status',
      { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ isActive: false }) },
      platformToken,
    );
    expect(statusResponse.status).toBe(200);
    expect(tenantsService.updateStatus).toHaveBeenCalledWith('tenant-1', false);

    const resetResponse = await request(
      '/api/superadmin/tenants/tenant-1/reset-admin-password',
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ email: 'admin@example.invalid' }),
      },
      platformToken,
    );
    expect(resetResponse.status).toBe(201);
    expect(tenantsService.resetAdminPassword).toHaveBeenCalledTimes(1);

    const impersonateResponse = await request(
      '/api/superadmin/tenants/tenant-1/impersonate',
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) },
      platformToken,
    );
    expect(impersonateResponse.status).toBe(501);
    expect(await impersonateResponse.json()).toEqual(
      expect.objectContaining({ statusCode: 501 }),
    );
  });
});
