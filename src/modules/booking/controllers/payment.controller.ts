import { 
  Controller, 
  Post, 
  Body, 
  Headers, 
  Param, 
  HttpException, 
  HttpStatus,
  HttpCode,
  Logger 
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { BookingService } from '../services/booking.service';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiParam, 
  ApiHeader 
} from '@nestjs/swagger';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { PaymentConfirmationResponseDto } from '../dto/payment-response.dto';
import { BookingErrorResponseDto } from '../dto/error-response.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Payments')
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly bookingService: BookingService,
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
    type: PaymentConfirmationResponseDto,
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
  async confirmIntentPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: ConfirmPaymentDto,
  ): Promise<PaymentConfirmationResponseDto> {
    const paymentResult = await this.paymentService.confirmPayment(
      paymentIntentId, 
      body.expectedAmount.toString()
    );
    const booking = await this.bookingService.confirmBookingByPayment(paymentIntentId);
    return {
      success: true,
      message: `Booking ${booking.id} confirmed successfully.`,
      data: {
        booking: this.transformBookingToResponse(booking),
        receiptUrl: paymentResult.receiptUrl
      }
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm payment for a booking',
    description: 'Confirms payment for a booking and updates its status'
  })
  @ApiBody({ type: ConfirmPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully',
    type: PaymentConfirmationResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment method or booking state',
    type: BookingErrorResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: BookingErrorResponseDto
  })
  @ApiResponse({
    status: 409,
    description: 'Payment already processed',
    type: BookingErrorResponseDto
  })
  async confirmPayment(
    @Body() confirmPaymentDto: ConfirmPaymentDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<any> {
    try {
      const result = await this.paymentService.confirmPayment(
        confirmPaymentDto.bookingId,
        confirmPaymentDto.paymentMethodId,
        idempotencyKey
      );
      
      return {
        success: true,
        data: {
          booking: result.booking,
          receiptUrl: result.receiptUrl
        }
      };
    } catch (error) {
      this.logger.error(`Payment confirmation failed: ${error.message}`);
      throw new HttpException(
        error.message, 
        HttpStatus.BAD_REQUEST
      );
    }
  }


  private transformBookingToResponse(
    booking: any,
  ): any {
    const plainBooking = booking.toObject ? booking.toObject() : booking;
    return {
      _id: plainBooking._id.toString(),
      bookingRef: plainBooking.bookingRef,
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
      version: plainBooking.version || 0,
    };
  }
}
