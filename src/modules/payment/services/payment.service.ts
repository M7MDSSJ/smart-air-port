import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Booking, BookingDocument } from '../../booking/schemas/booking.schema';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { EmailService } from '../../email/email.service';
import { BookingEmailData } from '../../email/services/email-template.service';
import { PaymobService } from './paymob.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private emailService: EmailService,
    private paymobService: PaymobService,
    private paymentTransactionService: PaymentTransactionService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-05-28.basil',
    });
  }

  /**
   * Get a booking by ID
   * @param bookingId The ID of the booking to retrieve
   * @returns The booking document
   */
  async getBookingById(bookingId: string) {
    return this.bookingModel.findById(bookingId).exec();
  }

  /**
   * Get PaymentIntent details from Stripe for debugging
   * @param paymentIntentId The PaymentIntent ID
   * @returns PaymentIntent object from Stripe
   */
  async getPaymentIntentDetails(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      this.logger.log(`Retrieved PaymentIntent ${paymentIntentId} with status: ${paymentIntent.status}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to retrieve PaymentIntent ${paymentIntentId}: ${error.message}`);
      throw error;
    }
  }

  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    const { bookingId, amount, currency, paymentMethodId, customerId } =
      createPaymentIntentDto;

    try {
      // Find the booking
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Verify the amount matches the booking total price
      const expectedAmount = Math.round(booking.totalPrice * 100); // Convert to cents

      // Verify the amount matches the booking total price
      const providedAmount = Math.round(amount * 100);

      if (expectedAmount !== providedAmount) {
        throw new BadRequestException(
          `Amount mismatch. Expected: ${expectedAmount / 100}, Provided: ${amount}`,
        );
      }

      // Create payment intent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: expectedAmount,
        currency: currency.toLowerCase(),
        metadata: {
          bookingId: bookingId,
          bookingRef: booking.bookingRef,
        },
        description: `Payment for flight booking ${booking.bookingRef}`,
      };

      // Add customer if provided
      if (customerId) {
        paymentIntentParams.customer = customerId;
      }

      // Add payment method if provided
      if (paymentMethodId) {
        paymentIntentParams.payment_method = paymentMethodId;
        paymentIntentParams.confirmation_method = 'manual';
        paymentIntentParams.confirm = true;
      }

      const paymentIntent =
        await this.stripe.paymentIntents.create(paymentIntentParams);

      // Update booking with payment intent ID and set payment status to processing
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'processing',
        stripeCustomerId: customerId,
      });

      this.logger.log(
        `Payment intent created: ${paymentIntent.id} for booking: ${bookingId}`,
      );

      // Enhanced logging for debugging
      this.logger.debug(`PaymentIntent details:`, {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret ?
          `${paymentIntent.client_secret.substring(0, 20)}...` : 'null',
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        account: paymentIntent.client_secret ?
          paymentIntent.client_secret.split('_')[2] : 'unknown'
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${error.message}`,
        error.stack,
      );

      // Handle specific Stripe errors
      if (error.type) {
        switch (error.type) {
          case 'StripeCardError':
            throw new BadRequestException(`Card error: ${error.message}`);
          case 'StripeRateLimitError':
            throw new BadRequestException('Too many requests. Please try again later.');
          case 'StripeInvalidRequestError':
            throw new BadRequestException(`Invalid request: ${error.message}`);
          case 'StripeAPIError':
            throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
          case 'StripeConnectionError':
            throw new BadRequestException('Network error. Please check your connection and try again.');
          case 'StripeAuthenticationError':
            throw new BadRequestException('Payment configuration error. Please contact support.');
          default:
            throw new BadRequestException(`Payment error: ${error.message}`);
        }
      }

      throw error;
    }
  }

  async confirmPayment(confirmPaymentDto: ConfirmPaymentDto) {
    const { paymentIntentId, bookingId, userEmail } = confirmPaymentDto;

    try {
      // Retrieve payment intent from Stripe
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      // In production, payment confirmation happens after frontend uses Stripe.js
      // to collect payment method and confirm the payment
      if (paymentIntent.status === 'requires_payment_method') {
        this.logger.warn(
          `Payment intent ${paymentIntentId} still requires payment method. Frontend should handle payment confirmation with Stripe.js`,
        );

        return {
          success: false,
          paymentStatus: 'requires_payment_method',
          stripeStatus: paymentIntent.status,
          message:
            'Payment requires payment method. Use Stripe.js on frontend to complete payment.',
          clientSecret: paymentIntent.client_secret,
        };
      }

      if (paymentIntent.status === 'succeeded') {
        // Check if booking is already confirmed
        const existingBooking = await this.bookingModel.findById(bookingId);

        if (existingBooking && existingBooking.paymentStatus === 'completed') {
          this.logger.log(
            `Payment already completed for booking: ${bookingId}`,
          );

          return {
            success: true,
            paymentStatus: 'completed',
            bookingStatus: 'confirmed',
            stripeStatus: paymentIntent.status,
            booking: existingBooking,
            message: 'Payment was already completed. No action needed.',
            alreadyCompleted: true,
          };
        }

        // Update booking status
        const updatedBooking = await this.bookingModel.findByIdAndUpdate(
          bookingId,
          {
            paymentStatus: 'completed',
            status: 'confirmed',
            paymentCompletedAt: new Date(),
          },
          { new: true },
        );

        if (!updatedBooking) {
          throw new NotFoundException('Booking not found');
        }

        this.logger.log(`Payment confirmed for booking: ${bookingId}`);

        // Send booking confirmation email to both contact and JWT user
        await this.sendBookingConfirmationEmail(updatedBooking, userEmail);

        return {
          success: true,
          paymentStatus: 'completed',
          bookingStatus: 'confirmed',
          stripeStatus: paymentIntent.status,
          booking: updatedBooking,
          message: 'Payment confirmed successfully.',
          alreadyCompleted: false,
        };
      } else {
        // Update payment status to failed
        await this.bookingModel.findByIdAndUpdate(bookingId, {
          paymentStatus: 'failed',
        });

        return {
          success: false,
          paymentStatus: paymentIntent.status,
          stripeStatus: paymentIntent.status,
          message: `Payment not completed. Status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment: ${error.message}`,
        error.stack,
      );

      // Update payment status to failed
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      throw error;
    }
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      this.logger.log(`Received webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (bookingId) {
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'completed',
          status: 'confirmed',
          paymentCompletedAt: new Date(),
        },
        { new: true },
      );

      if (updatedBooking) {
        // Send booking confirmation email
        await this.sendBookingConfirmationEmail(updatedBooking);
      }

      this.logger.log(`Payment succeeded for booking: ${bookingId}`);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (bookingId) {
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      this.logger.log(`Payment failed for booking: ${bookingId}`);
    }
  }

  /**
   * Convert booking document to email data format
   */
  private convertBookingToEmailData(
    booking: BookingDocument,
  ): BookingEmailData {
    const baseData = {
      bookingRef: booking.bookingRef,
      bookingType: booking.bookingType,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      travellersInfo: booking.travellersInfo.map((traveler) => ({
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        travelerType: traveler.travelerType,
      })),
      contactDetails: booking.contactDetails,
    };

    // Handle round-trip vs one-way booking data
    if (booking.bookingType === 'ROUND_TRIP' && booking.flightData) {
      return {
        ...baseData,
        flightData: booking.flightData.map(flight => ({
          flightID: flight.flightID,
          typeOfFlight: flight.typeOfFlight,
          numberOfStops: flight.numberOfStops,
          originAirportCode: flight.originAirportCode,
          destinationAirportCode: flight.destinationAirportCode,
          originCIty: flight.originCIty,
          destinationCIty: flight.destinationCIty,
          departureDate: flight.departureDate,
          arrivalDate: flight.arrivalDate,
          selectedBaggageOption: flight.selectedBaggageOption,
        })),
      };
    } else {
      // One-way booking (legacy format)
      return {
        ...baseData,
        flightId: booking.flightId,
        originAirportCode: booking.originAirportCode,
        destinationAirportCode: booking.destinationAirportCode,
        originCity: booking.originCity,
        destinationCity: booking.destinationCity,
        departureDate: booking.departureDate,
        arrivalDate: booking.arrivalDate,
        selectedBaggageOption: booking.selectedBaggageOption,
      };
    }
  }

  /**
   * Send booking confirmation email after successful payment
   */
  private async sendBookingConfirmationEmail(
    booking: BookingDocument,
    jwtUserEmail?: string,
  ): Promise<void> {
    try {
      const emailData = this.convertBookingToEmailData(booking);
      // Send to contact email
      await this.emailService.sendBookingConfirmationEmail(emailData);
      this.logger.log(
        `Booking confirmation email sent for booking: ${booking.bookingRef}`,
      );
      // Send to JWT user if different
      if (jwtUserEmail && jwtUserEmail !== emailData.contactDetails.email) {
        await this.emailService.sendBookingConfirmationEmail({
          ...emailData,
          contactDetails: { ...emailData.contactDetails, email: jwtUserEmail },
        });
        this.logger.log(
          `Booking confirmation email also sent to JWT user: ${jwtUserEmail}`,
        );
      }
      // Also display QR code in terminal for debugging/verification
      try {
        await this.emailService.displayQRCodeInTerminal(booking.bookingRef);
      } catch (qrError) {
        this.logger.warn(
          `Failed to display QR code in terminal: ${qrError instanceof Error ? qrError.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send booking confirmation email for booking ${booking.bookingRef}:`,
        error instanceof Error ? error.stack : error,
      );
      // Don't throw error here - email failure shouldn't fail the payment
    }
  }

  async getPaymentStatus(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentStatus === 'pending') {
      const payment = await this.paymentTransactionService.findByBookingId(
        bookingId,
      );

      if (
        payment &&
        payment.provider === 'paymob' &&
        payment.metadata?.paymobOrderId
      ) {
        this.logger.log(
          `Pending payment for booking ${bookingId}, checking status with Paymob...`,
        );
        try {
          const authToken = await this.paymobService.authenticate();
          const order = await this.paymobService.getOrder(
            payment.metadata.paymobOrderId,
            authToken,
          );

          if (order && order.payment_status === 'PAID') {
            this.logger.log(
              `Paymob transaction for booking ${bookingId} is successful, updating status.`,
            );
            const updatedBooking = await this.bookingModel.findByIdAndUpdate(
              bookingId,
              {
                paymentStatus: 'completed',
                status: 'confirmed',
                paymentCompletedAt: new Date(),
              },
              { new: true },
            );

            // Update payment record
            if (payment) {
              await this.paymentTransactionService.updatePaymentStatus(
                payment._id.toString(),
                {
                  status: 'completed' as any,
                  transactionId: order.id,
                  providerResponse: order,
                },
              );
            }

            return {
              bookingId,
              paymentStatus: updatedBooking.paymentStatus,
              bookingStatus: updatedBooking.status,
              stripeStatus: null, // Not a Stripe payment
            };
          }
        } catch (error) {
          this.logger.error(
            `Failed to get Paymob transaction status for booking ${bookingId}`,
            error,
          );
          // Do not throw error, just return current status
        }
      }
    }

    return {
      bookingId,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      stripeStatus: booking.paymentIntentId
        ? (await this.stripe.paymentIntents.retrieve(booking.paymentIntentId))
            .status
        : null,
    };
  }

  /**
   * Get test payment methods for different scenarios
   */
  getTestPaymentMethods() {
    return {
      // Successful cards
      visa: 'pm_card_visa',
      visa_debit: 'pm_card_visa_debit',
      mastercard: 'pm_card_mastercard',
      amex: 'pm_card_amex',

      // Declined cards
      declined_generic: 'pm_card_chargeDeclined',
      declined_insufficient_funds: 'pm_card_chargeDeclinedInsufficientFunds',
      declined_lost_card: 'pm_card_chargeDeclinedLostCard',
      declined_stolen_card: 'pm_card_chargeDeclinedStolenCard',
      declined_expired_card: 'pm_card_chargeDeclinedExpiredCard',
      declined_incorrect_cvc: 'pm_card_chargeDeclinedIncorrectCvc',
      declined_processing_error: 'pm_card_chargeDeclinedProcessingError',

      // 3D Secure cards
      threeds_required: 'pm_card_threeDSecure2Required',
      threeds_optional: 'pm_card_threeDSecureOptional',

      // Special cases
      risk_level_elevated: 'pm_card_riskLevelElevated',
      always_authenticate: 'pm_card_authenticationRequired',
    };
  }

  async testCardPaymentFromBackend(
    bookingId: string,
    amount: number,
    currency: string,
    testPaymentMethod: string = 'pm_card_visa',
  ) {
    try {
      // Find the booking
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Check if booking is already confirmed/paid
      if (booking.paymentStatus === 'completed' ||
        booking.status === 'confirmed') {
        this.logger.log(`Payment already completed for booking: ${bookingId}`);

        return {
          success: false,
          paymentStatus: 'already_completed',
          bookingStatus: booking.status,
          message:
            'This booking has already been confirmed and payment has been successful. No additional payment needed.',
          booking: booking,
          alreadyPaid: true,
        };
      }

      // Verify the amount matches the booking total price
      const expectedAmount = Math.round(booking.totalPrice * 100); // Convert to cents
      const providedAmount = Math.round(amount * 100);

      if (expectedAmount !== providedAmount) {
        throw new BadRequestException(
          `Amount mismatch. Expected: ${expectedAmount / 100}, Provided: ${amount}`,
        );
      }

      // Create and confirm payment intent in one step
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: expectedAmount,
        currency: currency.toLowerCase(),
        payment_method: testPaymentMethod,
        confirm: true,
        return_url: 'https://your-website.com/return', // Required for some payment methods
        metadata: {
          bookingId: bookingId,
          bookingRef: booking.bookingRef,
          testPayment: 'true',
        },
        description: `Test payment for flight booking ${booking.bookingRef}`,
      });

      this.logger.log(
        `Payment intent created and confirmed: ${paymentIntent.id} for booking: ${bookingId}`,
      );

      if (paymentIntent.status === 'succeeded') {
        // Update booking status
        const updatedBooking = await this.bookingModel.findByIdAndUpdate(
          bookingId,
          {
            paymentStatus: 'completed',
            status: 'confirmed',
            paymentIntentId: paymentIntent.id,
            paymentCompletedAt: new Date(),
          },
          { new: true },
        );

        this.logger.log(
          `Card payment test successful for booking: ${bookingId}`,
        );

        // Create a payment record for the successful payment
        const paymentData: CreatePaymentDto = {
          userId: updatedBooking.userId.toString(),
          bookingId: updatedBooking._id.toString(),
          amount: updatedBooking.totalPrice,
          currency: updatedBooking.currency,
          provider: PaymentProvider.STRIPE,
          method: PaymentMethod.CREDIT_CARD,
          transactionId: paymentIntent.id,
          metadata: paymentIntent,
          isTest: process.env.NODE_ENV !== 'production',
          status: PaymentStatus.COMPLETED,
        };
        await this.paymentTransactionService.createPayment(paymentData);
        this.logger.log(
          `Created payment record for successful payment of booking: ${bookingId}`,
        );

        // Send booking confirmation email
        await this.sendBookingConfirmationEmail(updatedBooking);

        return {
          success: true,
          paymentStatus: 'completed',
          bookingStatus: 'confirmed',
          stripeStatus: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          testPaymentMethod: testPaymentMethod,
          booking: updatedBooking,
          message: 'Card payment processed successfully from backend',
        };
      } else {
        // Update payment status to failed
        await this.bookingModel.findByIdAndUpdate(bookingId, {
          paymentStatus: 'failed',
          paymentIntentId: paymentIntent.id,
        });

        return {
          success: false,
          paymentStatus: paymentIntent.status,
          stripeStatus: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          message: `Payment not completed. Status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to process card payment: ${error.message}`,
        error.stack,
      );

      // Update payment status to failed
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      return {
        success: false,
        paymentStatus: 'failed',
        message: `Card payment failed: ${error.message}`,
      };
    }
  }

  /**
   * Handle Stripe webhook events
   * @param rawBody The raw request body
   * @param signature The Stripe signature header
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    this.logger.log('=== PROCESSING STRIPE WEBHOOK IN SERVICE ===');

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('Stripe webhook secret not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    this.logger.log(`Webhook verification details:`, {
      rawBodyLength: rawBody ? rawBody.length : 0,
      signatureProvided: !!signature,
      webhookSecretConfigured: !!webhookSecret,
      webhookSecretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : 'NOT_SET'
    });

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      this.logger.log(`✅ Stripe webhook event verified successfully: ${event.type}`);
      this.logger.log(`Event ID: ${event.id}, Created: ${new Date(event.created * 1000).toISOString()}`);

      if (event.data && event.data.object) {
        const obj = event.data.object as any;
        this.logger.log(`Event object details:`, {
          id: obj.id,
          object: obj.object,
          status: obj.status,
          metadata: obj.metadata
        });
      }
    } catch (error) {
      this.logger.error(`❌ Webhook signature verification failed: ${error.message}`);
      this.logger.error(`Raw body preview: ${rawBody ? rawBody.toString().substring(0, 100) + '...' : 'NULL'}`);
      this.logger.error(`Signature preview: ${signature ? signature.substring(0, 50) + '...' : 'NULL'}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    try {
      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing webhook event: ${error.message}`);
      throw new BadRequestException('Error processing webhook');
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log('=== HANDLING PAYMENT INTENT SUCCEEDED ===');
    this.logger.log(`Payment Intent ID: ${paymentIntent.id}`);
    this.logger.log(`Payment Intent Status: ${paymentIntent.status}`);
    this.logger.log(`Payment Intent Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    this.logger.log(`Payment Intent Metadata:`, paymentIntent.metadata);

    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`❌ No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      this.logger.error(`Available metadata keys: ${Object.keys(paymentIntent.metadata).join(', ')}`);
      return;
    }

    this.logger.log(`✅ Processing successful payment for booking: ${bookingId}`);

    try {
      // Find and update the booking
      this.logger.log(`🔍 Looking for booking with ID: ${bookingId}`);
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        this.logger.error(`❌ Booking not found: ${bookingId}`);
        this.logger.error(`This could indicate the booking was deleted or the ID is incorrect`);
        return;
      }

      this.logger.log(`📋 Found booking:`, {
        id: booking._id.toString(),
        ref: booking.bookingRef,
        currentStatus: booking.status,
        currentPaymentStatus: booking.paymentStatus,
        userId: booking.userId.toString()
      });

      // Update booking status
      this.logger.log(`🔄 Updating booking status to confirmed...`);
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'completed',
          status: 'confirmed',
          paymentIntentId: paymentIntent.id,
          paymentCompletedAt: new Date(),
        },
        { new: true },
      );

      if (updatedBooking) {
        this.logger.log(`✅ Booking updated successfully:`, {
          id: updatedBooking._id.toString(),
          ref: updatedBooking.bookingRef,
          newStatus: updatedBooking.status,
          newPaymentStatus: updatedBooking.paymentStatus,
          paymentCompletedAt: updatedBooking.paymentCompletedAt
        });
      } else {
        this.logger.error(`❌ Failed to update booking ${bookingId}`);
        return;
      }

      // Create payment record
      const paymentData: CreatePaymentDto = {
        userId: updatedBooking.userId.toString(),
        bookingId: updatedBooking._id.toString(),
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        provider: PaymentProvider.STRIPE,
        method: PaymentMethod.CREDIT_CARD,
        transactionId: paymentIntent.id,
        metadata: paymentIntent,
        isTest: paymentIntent.livemode === false,
        status: PaymentStatus.COMPLETED,
      };

      await this.paymentTransactionService.createPayment(paymentData);
      this.logger.log(`Created payment record for webhook payment: ${paymentIntent.id}`);

      // Send confirmation email
      await this.sendBookingConfirmationEmail(updatedBooking);
      this.logger.log(`Sent confirmation email for booking: ${bookingId}`);

    } catch (error) {
      this.logger.error(`Error processing successful payment webhook: ${error.message}`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    this.logger.log(`Processing failed payment for booking: ${bookingId}`);

    try {
      // Update booking status
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
        paymentIntentId: paymentIntent.id,
      });

      this.logger.log(`Updated booking ${bookingId} status to failed`);
    } catch (error) {
      this.logger.error(`Error processing failed payment webhook: ${error.message}`);
    }
  }

  /**
   * Handle canceled payment intent
   */
  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    this.logger.log(`Processing canceled payment for booking: ${bookingId}`);

    try {
      // Update booking status
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'canceled',
        paymentIntentId: paymentIntent.id,
      });

      this.logger.log(`Updated booking ${bookingId} status to canceled`);
    } catch (error) {
      this.logger.error(`Error processing canceled payment webhook: ${error.message}`);
    }
  }
}
