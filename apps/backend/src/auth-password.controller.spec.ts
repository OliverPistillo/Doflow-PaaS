import { Test, TestingModule } from '@nestjs/testing';
import { AuthPasswordController } from './auth-password.controller';
import { MailService } from './mail/mail.service';
import { Request, Response } from 'express';

describe('AuthPasswordController', () => {
  let controller: AuthPasswordController;

  const mockMailService = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthPasswordController],
      providers: [
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    controller = module.get<AuthPasswordController>(AuthPasswordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTenantConn behavior', () => {
    it('should throw an error when no tenant connection is on request during forgotPassword', async () => {
      const req = {
        tenantId: 'public',
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.forgotPassword(req, res, { email: 'test@example.com' })
      ).rejects.toThrow('No tenant connection on request');
    });

    it('should throw an error when no tenant connection is on request during resetPassword', async () => {
      const req = {
        tenantId: 'public',
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.resetPassword(req, res, { token: 'some-token', password: 'new-password123' })
      ).rejects.toThrow('No tenant connection on request');
    });
  });
});
