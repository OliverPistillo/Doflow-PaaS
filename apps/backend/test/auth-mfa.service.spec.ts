import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AuthMfaService } from '../src/auth-mfa.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

// Mock the dependencies
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('AuthMfaService', () => {
  let service: AuthMfaService;
  let mockQuery: jest.Mock;
  let mockReq: Partial<Request>;

  beforeEach(async () => {
    mockQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthMfaService],
    }).compile();

    service = module.get<AuthMfaService>(AuthMfaService);

    // Provide a mocked request object
    mockReq = {
      tenantConnection: { query: mockQuery },
      tenantId: 'test_tenant',
    } as any;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('start', () => {
    const userId = 'user-123';

    it('should throw UnauthorizedException if user is not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(service.start(mockReq as Request, userId)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw ForbiddenException if user is locked out', async () => {
      // Create a date in the future
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 15);

      mockQuery.mockResolvedValueOnce([
        {
          id: userId,
          email: 'test@example.com',
          mfa_locked_until: futureDate.toISOString(),
        },
      ]);

      await expect(service.start(mockReq as Request, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return challenge mode if MFA is already verified', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 15);

      mockQuery.mockResolvedValueOnce([
        {
          id: userId,
          email: 'test@example.com',
          mfa_enabled: true,
          mfa_secret: 'some-secret',
          mfa_verified_at: pastDate.toISOString(),
          mfa_failed_attempts: 2,
          mfa_locked_until: null,
        },
      ]);

      const result = await service.start(mockReq as Request, userId);

      expect(result).toEqual({
        mode: 'challenge',
        method: 'totp',
        email: 'test@example.com',
        remainingAttempts: 4, // 6 - 2
        lockedUntil: null,
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return setup mode, generate secret and update db if MFA is not verified', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: userId,
          email: 'test@example.com',
          mfa_enabled: false,
          mfa_secret: null,
          mfa_verified_at: null,
        },
      ]);

      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'mock-base32-secret',
        otpauth_url: 'mock-otpauth-url',
      });

      (QRCode.toDataURL as jest.Mock).mockResolvedValue('mock-qr-data-url');

      const result = await service.start(mockReq as Request, userId);

      // Verify DB update
      expect(mockQuery).toHaveBeenCalledTimes(2); // One for select, one for update
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('update "test_tenant"."users"'),
        ['mock-base32-secret', userId],
      );

      // Verify Speakeasy call
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'Doflow:test@example.com',
        issuer: 'Doflow',
        length: 20,
      });

      // Verify QR code generation
      expect(QRCode.toDataURL).toHaveBeenCalledWith('mock-otpauth-url');

      // Verify result
      expect(result).toEqual({
        mode: 'setup',
        method: 'totp',
        email: 'test@example.com',
        otpauthUrl: 'mock-otpauth-url',
        qrDataUrl: 'mock-qr-data-url',
        issuer: 'Doflow',
      });
    });
  });
});
