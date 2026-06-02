import { Test, TestingModule } from '@nestjs/testing';
import { AuthMfaController } from '../src/auth-mfa.controller';
import { AuthMfaService } from '../src/auth-mfa.service';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

describe('AuthMfaController', () => {
  let controller: AuthMfaController;
  let mfaService: AuthMfaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthMfaController],
      providers: [
        {
          provide: AuthMfaService,
          useValue: {
            start: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthMfaController>(AuthMfaController);
    mfaService = module.get<AuthMfaService>(AuthMfaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('start', () => {
    it('should successfully call mfa.start when user.id is available', async () => {
      const mockRequest = {
        authUser: { id: 'test-user-id' },
      } as unknown as Request;

      const mockResponse = { qr: 'mock-qr', secret: 'mock-secret' };
      (mfaService.start as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.start(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mfaService.start).toHaveBeenCalledWith(mockRequest, 'test-user-id');
    });

    it('should successfully call mfa.start when user.sub is available', async () => {
      const mockRequest = {
        user: { sub: 'test-user-sub' },
      } as unknown as Request;

      const mockResponse = { challenge: true };
      (mfaService.start as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.start(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mfaService.start).toHaveBeenCalledWith(mockRequest, 'test-user-sub');
    });

    it('should throw UnauthorizedException when no valid user identifier is present', async () => {
      const mockRequest = {
        user: { email: 'test@example.com' }, // Missing id or sub
      } as unknown as Request;

      await expect(controller.start(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.start(mockRequest)).rejects.toThrow('Not authenticated');
    });

    it('should throw UnauthorizedException when user object is completely missing', async () => {
      const mockRequest = {} as unknown as Request;

      await expect(controller.start(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
