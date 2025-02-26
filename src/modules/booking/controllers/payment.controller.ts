import { Controller, Post, Body, Headers, Param, HttpException } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { BookingService } from '../services/booking.service';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../../email/email.service';
import { BookingResponseDto } from '../dto/booking-response.dto';
import { BookingDocument } from '../schemas/booking.schema';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { RetryPaymentResponseDto } from '../dto/retry-payment.dto';

@ApiTags('Payments')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly bookingService: BookingService,
    private readonly emailService: EmailService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('webhook')
  @ApiOperation({
    summary: 'Handle Stripe webhook events',
    description:
      'Receives and processes Stripe webhook events. Rate-limited to 10 requests per minute.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe signature for verifying the webhook event',
    required: true,
  })
  // Updated here: use "schema" instead of "type" to define the request body
  @ApiBody({
    description: 'Raw webhook event data from Stripe (typically a JSON buffer)',
    schema: { type: 'object' },
    examples: {
      example1: {
        summary: 'Payment Intent Succeeded Event',
        value: {
          id: 'evt_1NxyzStripeEvent',
          object: 'event',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_3NxyzStripePaymentIntent',
              amount: 1000,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook signature or event',
    type: HttpException,
    example: { statusCode: 400, message: 'Invalid Stripe signature' },
  })
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    return this.paymentService.handleWebhookEvent(rawBody, signature);
  }

  @Post('confirm/:paymentIntentId')
  @ApiOperation({
    summary: 'Confirm a payment',
    description:
      'Confirms a payment using the payment intent ID and updates the associated booking status.',
  })
  @ApiParam({
    name: 'paymentIntentId',
    description: 'Stripe payment intent ID',
    example: 'pi_3NxyzStripePaymentIntent',
  })
  @ApiBody({
    type: ConfirmPaymentDto,
    examples: {
      example1: {
        summary: 'Confirm Payment Example',
        value: {
          expectedAmount: 100,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment intent or amount mismatch',
    type: HttpException,
    example: { statusCode: 400, message: 'Invalid payment intent' },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: HttpException,
    example: { statusCode: 404, message: 'Booking not found' },
  })
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: ConfirmPaymentDto,
  ): Promise<PaymentResponseDto> {
    await this.paymentService.confirmPayment(paymentIntentId, body.expectedAmount);
    const booking = await this.bookingService.confirmBookingByPayment(paymentIntentId);
    return {
      success: true,
      message: `Booking ${booking.id} confirmed successfully.`,
    };
  }

  @Post(':id/retry-payment')
  @ApiOperation({
    summary: 'Retry a failed payment',
    description: 'Retries a payment for a booking that previously failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Booking ID',
    example: '67be8671461b2609214e658b',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment retry initiated successfully',
    type: RetryPaymentResponseDto, // Reference the external DTO
  })
  @ApiResponse({
    status: 400,
    description: 'Booking not in a retryable state',
    type: HttpException,
    example: { statusCode: 400, message: 'Booking cannot be retried' },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: HttpException,
    example: { statusCode: 404, message: 'Booking not found' },
  })
  async retryPayment(
    @Param('id') bookingId: string,
  ): Promise<RetryPaymentResponseDto> {
    const booking = await this.bookingService.retryPayment(bookingId);
    return {
      success: true,
      data: this.transformBookingToResponse(booking),
    };
  }

  private transformBookingToResponse(
    booking: BookingDocument,
  ): BookingResponseDto {
    const plainBooking = booking.toObject ? booking.toObject() : booking;
    return {
      _id: plainBooking._id.toString(),
      user: plainBooking.user.toString(),
      flight: plainBooking.flight.toString(),
      seats: plainBooking.seats.map(seat => ({
        _id: seat._id.toString(),
        seatNumber: seat.seatNumber,
        class: seat.class,
        price: seat.price,
      })),
      totalSeats: plainBooking.totalSeats,
      totalPrice: plainBooking.totalPrice,
      status: plainBooking.status,
      paymentProvider: plainBooking.paymentProvider,
      idempotencyKey: plainBooking.idempotencyKey,
      paymentIntentId: plainBooking.paymentIntentId,
      expiresAt: plainBooking.expiresAt?.toISOString(),
      createdAt: plainBooking.createdAt.toISOString(),
      updatedAt: plainBooking.updatedAt.toISOString(),
    };
  }
}
