import { Controller, Post, Body, Headers, Req, Res, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('create-checkout')
  async createCheckout(
    @Req() req: Request,
    @Body('planTier') planTier: string,
  ) {
    const tenantId = (req as any).tenantId; // from TenancyMiddleware
    if (!tenantId) {
      throw new Error('Tenant context missing');
    }
    return this.billingService.createCheckoutSession(tenantId, planTier);
  }

  // Webhook needs raw body for signature verification
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    if (!signature) {
      return res.status(400).send('Missing stripe-signature header');
    }

    // Ensure rawBody is available. (Requires configuration in main.ts)
    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).send('Raw body is required for webhook signature verification');
    }

    try {
      await this.billingService.handleWebhook(rawBody, signature);
      return res.status(200).send({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).send(`Webhook Error: ${msg}`);
    }
  }
}
