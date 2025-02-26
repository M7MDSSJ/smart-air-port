// src/modules/booking/controllers/payment.controller.ts
import { Controller, Post, Body, Headers, Param } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { BookingService } from '../services/booking.service';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../../email/email.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly bookingService: BookingService,
    private readonly emailService: EmailService,
  ) {}

  // Webhook endpoint with rate limiting (10 requests per minute)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('webhook')
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    return this.paymentService.handleWebhookEvent(rawBody, signature);
  }

  // Confirm payment endpoint
  @Post('confirm/:paymentIntentId')
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: ConfirmPaymentDto,
  ): Promise<{ success: boolean; message: string }> {
    // Confirm the payment using the PaymentService
    await this.paymentService.confirmPayment(paymentIntentId, body.expectedAmount);
    
    // Update the corresponding booking's status via the BookingService
    const booking = await this.bookingService.confirmBookingByPayment(paymentIntentId);
    
    return {
      success: true,
      message: `Booking ${booking.id} confirmed successfully.`,
    };
  }

  // Retry payment endpoint: only allowed for failed bookings
  @Post(':id/retry-payment')
  async retryPayment(@Param('id') bookingId: string): Promise<{ success: boolean; data: any }> {
    const booking = await this.bookingService.retryPayment(bookingId);
    return {
      success: true,
      data: booking,  // Optionally, transform this object if needed before returning.
    };
  }
}
