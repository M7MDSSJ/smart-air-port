import { Injectable, Logger, ConflictException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { EventBus } from 'src/common/event-bus.service';

type PaymentIntentParams = {
  amount: number;
  currency: string;
  paymentMethod: string;
  metadata: Record<string, any>;
};

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private configService: ConfigService,
    private eventBus: EventBus,
  ) {
    const stripeKey =
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' });
  }

  async createPaymentIntent(
    params: PaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        payment_method_types: ['card'],
        metadata: params.metadata,
      });
      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Payment intent creation failed: ${error.message}`);
      throw new PaymentProcessingError('Payment processing failed');
    }
  }

  async confirmPayment(
    paymentIntentId: string,
    expectedAmount: number,
  ): Promise<void> {
    this.logger.log(`Confirming payment intent: ${paymentIntentId}`);
    let paymentIntent =
      await this.stripe.paymentIntents.retrieve(paymentIntentId);
    this.logger.debug(`Initial Payment intent status: ${paymentIntent.status}`);

    if (paymentIntent.status === 'succeeded') {
      this.logger.log(`Payment ${paymentIntentId} already succeeded`);
      return;
    }
    if (paymentIntent.status === 'canceled') {
      this.logger.warn(
        `Payment intent ${paymentIntentId} is canceled. Overriding confirmation manually.`,
      );
      return;
    }
    if (
      paymentIntent.status !== 'requires_confirmation' &&
      paymentIntent.status !== 'requires_payment_method'
    ) {
      this.logger.warn(
        `Payment cannot be confirmed. Current status: ${paymentIntent.status}`,
      );
      throw new ConflictException(
        `Payment cannot be confirmed. Current status: ${paymentIntent.status}`,
      );
    }
    if (paymentIntent.amount !== expectedAmount) {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      this.logger.error(
        `Payment amount mismatch. Expected: ${expectedAmount}, Received: ${paymentIntent.amount}`,
      );
      throw new PaymentProcessingError(
        `Payment amount mismatch. Expected: ${expectedAmount}, Received: ${paymentIntent.amount}`,
      );
    }
    try {
      const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: 'pm_card_visa',
        },
      );
      this.logger.log(
        `Payment ${paymentIntentId} confirmed, new status: ${confirmedPaymentIntent.status}`,
      );
      paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      this.logger.debug(`Final Payment intent status: ${paymentIntent.status}`);
      if (paymentIntent.status !== 'succeeded') {
        this.logger.warn(
          `Payment confirmation not successful. Status: ${paymentIntent.status}`,
        );
        throw new ConflictException(
          `Payment confirmation not successful. Status: ${paymentIntent.status}`,
        );
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Payment confirmation failed: ${error.message}`);
      throw new PaymentProcessingError('Payment confirmation failed');
    }
  }

  handleWebhookEvent(payload: Buffer, signature: string): void {
    const webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      switch (event.type) {
        case 'payment_intent.succeeded':
          this.logger.log('Payment succeeded');
          this.eventBus.publish('payment.succeeded', {
            paymentIntentId: event.data.object.id,
          });
          break;
        case 'payment_intent.payment_failed':
          this.logger.error('Payment failed');
          this.eventBus.publish('payment.failed', {
            paymentIntentId: event.data.object.id,
            reason: 'Payment failed',
          });
          break;
        default:
          this.logger.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Webhook handling failed: ${error.message}`);
      throw new PaymentProcessingError('Webhook handling failed');
    }
  }

  async processRefund(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.refunds.create({ payment_intent: paymentIntentId });
      this.logger.log(`Refund processed for ${paymentIntentId}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Refund failed: ${error.message}`);
      throw new PaymentProcessingError('Refund processing failed');
    }
  }
}

export class PaymentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProcessingError';
  }
}
