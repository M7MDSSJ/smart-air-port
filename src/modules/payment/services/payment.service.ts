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

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private emailService: EmailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
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
      throw error;
    }
  }

  async confirmPayment(confirmPaymentDto: ConfirmPaymentDto) {
    const { paymentIntentId, bookingId, userEmail } = confirmPaymentDto;

    try {
      // Retrieve payment intent from Stripe
      let paymentIntent =
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
          await this.handlePaymentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
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
    return {
      bookingRef: booking.bookingRef,
      flightId: booking.flightId,
      originAirportCode: booking.originAirportCode,
      destinationAirportCode: booking.destinationAirportCode,
      originCity: booking.originCity,
      destinationCity: booking.destinationCity,
      departureDate: booking.departureDate,
      arrivalDate: booking.arrivalDate,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      travellersInfo: booking.travellersInfo.map((traveler) => ({
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        travelerType: traveler.travelerType,
      })),
      contactDetails: booking.contactDetails,
      selectedBaggageOption: booking.selectedBaggageOption,
    };
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

    let stripeStatus = null;
    if (booking.paymentIntentId) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(
          booking.paymentIntentId,
        );
        stripeStatus = paymentIntent.status;
      } catch (error) {
        this.logger.error(
          `Failed to retrieve payment intent: ${error.message}`,
        );
      }
    }

    return {
      bookingId,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      paymentIntentId: booking.paymentIntentId,
      stripeStatus,
      paymentCompletedAt: booking.paymentCompletedAt,
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
      if (
        booking.paymentStatus === 'completed' ||
        booking.status === 'confirmed'
      ) {
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
}
