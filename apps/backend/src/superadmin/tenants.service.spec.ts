import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

type TenantFixture = Partial<Tenant> & Pick<Tenant, 'id' | 'slug' | 'schemaName'>;

function setup(tenant: TenantFixture | null) {
  const events: string[] = [];
  const tenantsRepo = {
    findOne: jest.fn().mockResolvedValue(tenant),
  };
  const managerDelete = jest.fn(async () => {
    events.push('manager.delete');
  });
  const queryRunner: any = {
    isTransactionActive: false,
    manager: { delete: managerDelete },
    connect: jest.fn(async () => {
      events.push('connect');
    }),
    startTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = true;
      events.push('start');
    }),
    query: jest.fn(async () => {
      events.push('drop');
    }),
    commitTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
      events.push('commit');
    }),
    rollbackTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
      events.push('rollback');
    }),
    release: jest.fn(async () => {
      events.push('release');
    }),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };
  const redisClient = {
    srem: jest.fn(async () => {
      events.push('redis.srem');
    }),
  };
  const redisService = {
    getClient: jest.fn(() => redisClient),
    del: jest.fn(async () => {
      events.push('redis.del');
    }),
  };
  const service = new TenantsService(
    tenantsRepo as any,
    dataSource as any,
    {} as any,
    redisService as any,
    {} as any,
  );
  jest.spyOn((service as any).logger, 'error').mockImplementation();
  jest.spyOn((service as any).logger, 'warn').mockImplementation();

  return {
    service,
    tenantsRepo,
    dataSource,
    queryRunner,
    managerDelete,
    redisClient,
    redisService,
    events,
  };
}

describe('TenantsService.delete', () => {
  const ordinaryTenant: TenantFixture = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'customer',
    schemaName: ' Customer_01 ',
  };

  it('preserves the idempotent not-found contract without mutations', async () => {
    const x = setup(null);
    await expect(x.service.delete('missing')).resolves.toEqual({
      message: 'Tenant già eliminato o non trovato',
    });
    expect(x.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(x.redisService.getClient).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...ordinaryTenant, slug: ' DOFLOW ' }, 'slug'],
    [{ ...ordinaryTenant, schemaName: ' DOFLOW ' }, 'schema'],
    [{ ...ordinaryTenant, schemaName: ' PUBLIC ' }, 'public schema'],
  ])('blocks the protected tenant by %s before any mutation', async (fixture) => {
    const x = setup(fixture as TenantFixture);
    await expect(x.service.delete(fixture.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(x.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(x.managerDelete).not.toHaveBeenCalled();
    expect(x.queryRunner.query).not.toHaveBeenCalled();
    expect(x.redisService.getClient).not.toHaveBeenCalled();
  });

  it('fails closed for an invalid stored schema before any mutation', async () => {
    const fixture = { ...ordinaryTenant, schemaName: 'customer"; DROP SCHEMA public; --' };
    const x = setup(fixture);
    await expect(x.service.delete(fixture.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(x.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(x.managerDelete).not.toHaveBeenCalled();
    expect(x.queryRunner.query).not.toHaveBeenCalled();
    expect(x.redisService.getClient).not.toHaveBeenCalled();
  });

  it('deletes an ordinary tenant once and drops only the validated schema', async () => {
    const x = setup(ordinaryTenant);
    await expect(x.service.delete(ordinaryTenant.id)).resolves.toEqual({
      message: 'Tenant eliminato con successo',
    });

    expect(x.managerDelete).toHaveBeenCalledTimes(1);
    expect(x.managerDelete).toHaveBeenCalledWith(Tenant, ordinaryTenant.id);
    expect(x.queryRunner.query).toHaveBeenCalledWith(
      'DROP SCHEMA IF EXISTS "customer_01" CASCADE',
    );
    expect(x.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(x.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(x.events).toEqual([
      'connect',
      'start',
      'manager.delete',
      'drop',
      'commit',
      'release',
      'redis.srem',
      'redis.del',
    ]);
  });

  it('rolls back a failed database transaction and skips Redis', async () => {
    const x = setup(ordinaryTenant);
    x.queryRunner.query.mockRejectedValueOnce(new Error('database failure'));

    await expect(x.service.delete(ordinaryTenant.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(x.managerDelete).toHaveBeenCalledTimes(1);
    expect(x.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(x.queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(x.redisService.getClient).not.toHaveBeenCalled();
    expect(x.queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('reports pending cache cleanup without pretending to roll back committed DB work', async () => {
    const x = setup(ordinaryTenant);
    x.redisClient.srem.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(x.service.delete(ordinaryTenant.id)).resolves.toEqual({
      message: 'Tenant eliminato con successo',
      warning: 'CACHE_CLEANUP_PENDING',
    });
    expect(x.queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(x.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(x.redisService.del).not.toHaveBeenCalled();
  });
});
