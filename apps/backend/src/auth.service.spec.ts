import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DataSource } from 'typeorm';

describe('AuthService', () => {
  let service: AuthService;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertTenantActive', () => {
    it('should return immediately without queries when tenantId is "public"', async () => {
      await (service as any).assertTenantActive(mockDataSource, 'public');
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should pass without error when the tenant is active', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([{ is_active: true }]);

      await expect((service as any).assertTenantActive(mockDataSource, 'tenant_active')).resolves.not.toThrow();
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant_active']
      );
    });

    it('should throw an error when the tenant is inactive', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([{ is_active: false }]);

      await expect((service as any).assertTenantActive(mockDataSource, 'tenant_inactive'))
        .rejects
        .toThrow('Tenant disabled');
    });

    it('should throw an error when the tenant is not found', async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      await expect((service as any).assertTenantActive(mockDataSource, 'tenant_not_found'))
        .rejects
        .toThrow('Tenant disabled');
    });
  });
});
