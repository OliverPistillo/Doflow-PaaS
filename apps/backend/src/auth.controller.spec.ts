import { AuthController } from './auth.controller';
import { BadRequestException } from '@nestjs/common';

describe('AuthController audit redaction', () => {
  it('non registra il token invito grezzo in audit quando accept-invite fallisce', async () => {
    const authService = {
      acceptInvite: jest.fn().mockRejectedValue(new Error('invite invalid')),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthController(authService as any, auditService as any, {} as any, {} as any, {} as any);
    const rawToken = 'invite-token-sensitive-value';

    await expect(controller.acceptInvite(
      { token: rawToken, password: 'new-password', tenant: 'tenant_a' },
      { headers: {} } as any,
      {} as any,
    )).rejects.toBeInstanceOf(BadRequestException);
    const serializedAuditCalls = JSON.stringify(auditService.log.mock.calls);
    expect(serializedAuditCalls).not.toContain(rawToken);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'auth_accept_invite_failed',
        metadata: { token_present: true, tenant: 'tenant_a' },
      }),
    );
  });
});
