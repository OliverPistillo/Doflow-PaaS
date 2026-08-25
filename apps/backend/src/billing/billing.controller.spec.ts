import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import * as express from 'express';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('Billing webhook Nest 11 / Express 5 contract', () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeKey;
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it('verifies a synthetic Stripe signature without contacting the provider', async () => {
    const webhookSecret = 'whsec_nest11_acceptance_synthetic_only';
    process.env.STRIPE_SECRET_KEY = 'sk_test_nest11_acceptance_synthetic_only';
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const timestamp = Math.floor(Date.now() / 1000);
    const body = Buffer.from(JSON.stringify({
      id: 'evt_nest11_synthetic',
      object: 'event',
      type: 'nest11.compatibility.checked',
      created: timestamp,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      data: { object: {} },
    }));
    const digest = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body.toString('utf8')}`)
      .digest('hex');
    const service = new BillingService({} as never);

    await expect(service.handleWebhook(body, `t=${timestamp},v1=${digest}`)).resolves.toBeUndefined();
  });

  it('preserves the exact raw request body through the Express 5 adapter', async () => {
    const handleWebhook = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: { handleWebhook } }],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication({ bodyParser: false });
    app.use(express.json({ verify: (request, _response, buffer) => {
      (request as express.Request & { rawBody?: Buffer }).rawBody = buffer;
    } }));
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');

    try {
      const body = JSON.stringify({ id: 'evt_raw_body_synthetic', nested: { value: 1 } });
      const response = await fetch(`${await app.getUrl()}/api/billing/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 'synthetic-signature',
        },
        body,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
      expect(handleWebhook).toHaveBeenCalledWith(Buffer.from(body), 'synthetic-signature');
    } finally {
      await app.close();
    }
  });
});
