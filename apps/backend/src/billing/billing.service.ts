import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Tenant } from '../superadmin/entities/tenant.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: any;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY || '';
    if (!apiKey && process.env.NODE_ENV !== 'test') {
      this.logger.warn('STRIPE_SECRET_KEY is not defined!');
    }
    this.stripe = new Stripe(apiKey) as any;
  }

  async createCheckoutSession(tenantId: string, planTier: string): Promise<{ url: string }> {
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    let priceId = '';

    if (planTier === 'PRO') {
      priceId = process.env.STRIPE_PRO_PRICE_ID || '';
    } else if (planTier === 'ENTERPRISE') {
      priceId = process.env.STRIPE_ENTERPRISE_PRICE_ID || '';
    } else {
      throw new BadRequestException('Invalid plan tier specified for checkout.');
    }

    if (!priceId) {
      throw new BadRequestException(`Stripe Price ID not configured for plan ${planTier}.`);
    }

    // Identify the tenant
    let schemaName = tenantId;
    if (tenantId === 'public' || tenantId === 'public.tenants') {
      // In tenancy module, tenantId is usually schema name. For safe querying:
       throw new BadRequestException('Invalid tenant context for checkout.');
    }

    const tenant = await this.tenantRepo.findOne({ where: { schemaName: tenantId } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with schema ${tenantId} not found.`);
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${appBaseUrl}/settings?checkout=success`,
        cancel_url: `${appBaseUrl}/settings?checkout=cancel`,
        client_reference_id: tenant.id, // Store our DB tenant.id
        customer_email: tenant.adminEmail || tenant.contactEmail || undefined,
        metadata: {
          tenant_id: tenant.id,
          plan_tier: planTier,
        },
      });

      if (!session.url) {
        throw new Error('Stripe returned a session without a URL');
      }

      return { url: session.url };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create checkout session', msg);
      throw new BadRequestException(`Failed to create checkout session: ${msg}`);
    }
  }

  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured.');
      throw new BadRequestException('Webhook secret not configured.');
    }

    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook signature verification failed.`, msg);
      throw new BadRequestException(`Webhook Error: ${msg}`);
    }

    this.logger.log(`Received Stripe Webhook Event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      await this.processCheckoutCompleted(session);
    } else if (event.type === 'customer.subscription.deleted') {
      // Handle subscription cancellation
      const subscription = event.data.object as any;
      await this.processSubscriptionDeleted(subscription);
    }

    // Add more webhook types as needed
  }

  private async processCheckoutCompleted(session: any): Promise<void> {
    const tenantId = session.metadata?.tenant_id || session.client_reference_id;
    const planTier = session.metadata?.plan_tier;

    if (!tenantId || !planTier) {
      this.logger.warn(`Checkout session completed, but missing metadata: tenantId=${tenantId}, planTier=${planTier}`);
      return;
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      this.logger.error(`Tenant with id ${tenantId} not found to upgrade plan.`);
      return;
    }

    this.logger.log(`Upgrading tenant ${tenant.slug} (${tenant.id}) to plan ${planTier}`);

    // Update tenant plan
    tenant.planTier = planTier;
    await this.tenantRepo.save(tenant);
  }

  private async processSubscriptionDeleted(subscription: any): Promise<void> {
    // In a robust implementation, we'd look up the tenant by subscription ID
    // or customer ID. For now, since we only set plan on checkout, we might
    // need to fetch the customer / metadata from stripe to link it back,
    // or store `stripe_subscription_id` on the tenant.

    this.logger.log(`Subscription ${subscription.id} deleted. Tenant should be reverted to STARTER.`);
    // Future: implement downgrade logic
  }
}
