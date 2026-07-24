import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { TenantCredentialsController } from './tenant-credentials.controller';

describe('TenantCredentialsController', () => {
  function makeController() {
    const service = {
      options: jest.fn(),
      dashboard: jest.fn(),
      list: jest.fn(),
      expiring: jest.fn(),
      renewalsDue: jest.fn(),
      rotationDue: jest.fn(),
      create: jest.fn(),
      activity: jest.fn(),
      exportAll: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      replaceSecret: jest.fn(),
      reveal: jest.fn(),
      rotate: jest.fn(),
      listPermissions: jest.fn(),
      grantPermission: jest.fn(),
      updatePermission: jest.fn(),
      deletePermission: jest.fn(),
      listLinks: jest.fn(),
      createLink: jest.fn(),
      deleteLink: jest.fn(),
      auditLog: jest.fn(),
      rotations: jest.fn(),
      export: jest.fn(),
    };
    return { controller: new TenantCredentialsController(service as any), service };
  }

  it('espone route mapping principali incluso export globale e restore POST', () => {
    const mappings = routeMappings(TenantCredentialsController);

    expect(mappings).toEqual(expect.arrayContaining([
      { method: 'GET', path: 'options', handler: 'options' },
      { method: 'GET', path: 'dashboard', handler: 'dashboard' },
      { method: 'GET', path: '/', handler: 'list' },
      { method: 'GET', path: 'expiring', handler: 'expiring' },
      { method: 'GET', path: 'renewals-due', handler: 'renewalsDue' },
      { method: 'GET', path: 'rotation-due', handler: 'rotationDue' },
      { method: 'GET', path: 'activity', handler: 'activity' },
      { method: 'GET', path: 'export', handler: 'exportAll' },
      { method: 'POST', path: '/', handler: 'create' },
      { method: 'GET', path: ':credentialId', handler: 'get' },
      { method: 'PATCH', path: ':credentialId', handler: 'update' },
      { method: 'DELETE', path: ':credentialId', handler: 'archive' },
      { method: 'POST', path: ':credentialId/restore', handler: 'restore' },
      { method: 'POST', path: ':credentialId/reveal', handler: 'reveal' },
      { method: 'GET', path: ':credentialId/export', handler: 'export' },
    ]));
    const exportIndex = mappings.findIndex((entry) => entry.path === 'export');
    const dynamicIndex = mappings.findIndex((entry) => entry.path === ':credentialId');
    expect(exportIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicIndex).toBeGreaterThan(exportIndex);
  });

  it('imposta header no-store sul reveal', async () => {
    const { controller, service } = makeController();
    service.reveal.mockResolvedValue({ secret: { username: 'u' } });
    const res = { setHeader: jest.fn() };

    await controller.reveal('11111111-1111-4111-8111-111111111111', { reason: 'Accesso operativo' }, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, private');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
  });

  it('propaga errori controllati 400/403/404/429 senza convertirli in 500', async () => {
    const { controller, service } = makeController();
    service.get.mockRejectedValueOnce(new BadRequestException('credential_id non valido'));
    await expect(controller.get('not-uuid')).rejects.toBeInstanceOf(BadRequestException);
    service.get.mockRejectedValueOnce(new ForbiddenException('Non hai permessi per questa operazione.'));
    await expect(controller.get('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(ForbiddenException);
    service.get.mockRejectedValueOnce(new NotFoundException('Credenziale non trovata'));
    await expect(controller.get('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(NotFoundException);
    service.reveal.mockRejectedValueOnce(new HttpException('Troppe richieste', HttpStatus.TOO_MANY_REQUESTS));
    await expect(controller.reveal('11111111-1111-4111-8111-111111111111', { reason: 'Uso operativo' }, { setHeader: jest.fn() } as any))
      .rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  function routeMappings(controller: any) {
    return Object.getOwnPropertyNames(controller.prototype)
      .filter((name) => name !== 'constructor')
      .map((handler) => {
        const fn = controller.prototype[handler];
        const method = Reflect.getMetadata(METHOD_METADATA, fn);
        const path = Reflect.getMetadata(PATH_METADATA, fn);
        if (method === undefined || path === undefined) return null;
        return { method: RequestMethod[method], path, handler };
      })
      .filter((entry): entry is { method: string; path: string; handler: string } => Boolean(entry));
  }
});
