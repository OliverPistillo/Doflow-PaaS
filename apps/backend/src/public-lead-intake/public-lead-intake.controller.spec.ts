import { PublicLeadIntakeController } from './public-lead-intake.controller';
import { PublicLeadRateLimitException } from './public-lead-intake.service';

describe('PublicLeadIntakeController', () => {
  it('inoltra tenant, origin e IP Cloudflare validato al service', async () => {
    const service = {
      submit: jest.fn().mockResolvedValue({
        success: true,
        reference: '11111111-1111-4111-8111-111111111111',
        duplicate: false,
        message: 'Richiesta ricevuta correttamente.',
      }),
    };
    const controller = new PublicLeadIntakeController(service as any);
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      app: { get: jest.fn(() => jest.fn(() => true)) },
    };

    await controller.submit('doflow', {} as any, 'https://doflow.it', req as any, { setHeader: jest.fn() } as any);

    expect(service.submit).toHaveBeenCalledWith('doflow', {}, {
      origin: 'https://doflow.it',
      ip: '203.0.113.10',
    });
  });

  it('espone Retry-After quando il rate limit blocca', async () => {
    const service = {
      submit: jest.fn().mockRejectedValue(new PublicLeadRateLimitException(42)),
    };
    const controller = new PublicLeadIntakeController(service as any);
    const res = { setHeader: jest.fn() };

    await expect(controller.submit('doflow', {} as any, 'https://doflow.it', { headers: {}, ip: '127.0.0.1', socket: {}, app: { get: jest.fn() } } as any, res as any))
      .rejects.toBeInstanceOf(PublicLeadRateLimitException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});
