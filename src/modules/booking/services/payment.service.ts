import { Injectable, Logger, ConflictException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { EventBus } from 'src/common/event-bus.service';

// TODO: Support multiple payment providers (Stripe, PayPal, etc.)
// TODO: Support dynamic multi-currency everywhere (not just intent creation)
// TODO: Use idempotency keys for all payment actions for safety
// NOTE: Always include bookingRef and userId in payment intent metadata for traceability
// NOTE: Improve user-facing error messages for payment failures (currently technical)
type PaymentIntentParams = {
  amount: number;
  currency: string;
  paymentMethod: string;
  metadata: Record<string, any>; // Should always include bookingRef and userId
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
    this.stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
  }

  /**
 * Creates a Stripe payment intent. Metadata MUST include bookingRef and userId for traceability.
 * TODO: Add audit logging for payment intent creation (who/when/what)
 */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripeAmount = Math.round(amount * 100);
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: metadata,
      });
      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Payment intent creation failed: ${error.message}`);
      throw new PaymentProcessingError('Payment processing failed');
    }
  }

  /**
 * Confirms a Stripe payment. TODO: Add audit logging for payment confirmation (who/when/what)
 */
  async confirmPayment(
    bookingId: string,
    paymentMethodId: string,
    idempotencyKey?: string
  ): Promise<{ booking: any; receiptUrl: string }> {
    this.logger.log(`Confirming payment intent: ${bookingId}`);
    let paymentIntent =
      await this.stripe.paymentIntents.retrieve(bookingId);
    this.logger.debug(`Initial Payment intent status: ${paymentIntent.status}`);

    if (paymentIntent.status === 'succeeded') {
      this.logger.log(`Payment ${bookingId} already succeeded`);
      return;
    }
    if (paymentIntent.status === 'canceled') {
      this.logger.warn(
        `Payment intent ${bookingId} is canceled. Overriding confirmation manually.`,
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
    try {
      const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(
        bookingId,
        {
          payment_method: paymentMethodId,
        },
      );
      this.logger.log(
        `Payment ${bookingId} confirmed, new status: ${confirmedPaymentIntent.status}`,
      );
      paymentIntent =
        await this.stripe.paymentIntents.retrieve(bookingId);
      this.logger.debug(`Final Payment intent status: ${paymentIntent.status}`);
      if (paymentIntent.status !== 'succeeded') {
        this.logger.warn(
          `Payment confirmation not successful. Status: ${paymentIntent.status}`,
        );
        throw new ConflictException(
          `Payment confirmation not successful. Status: ${paymentIntent.status}`,
        );
      }
      return { booking: {}, receiptUrl: '' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Payment confirmation failed: ${error.message}`);
      throw new PaymentProcessingError('Payment confirmation failed');
    }
  }

  /**
 * Handles Stripe webhook events. TODO: Log all payloads for compliance/audit.
 */
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

  /**
 * Processes a refund for a payment intent. TODO: Add audit logging for refunds (who/when/what)
 */
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
