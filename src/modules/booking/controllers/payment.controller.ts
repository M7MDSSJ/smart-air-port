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

  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('webhook')
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    return this.paymentService.handleWebhookEvent(rawBody, signature);
  }

  @Post('confirm/:paymentIntentId')
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: ConfirmPaymentDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.paymentService.confirmPayment(
      paymentIntentId,
      body.expectedAmount,
    );
    const booking =
      await this.bookingService.confirmBookingByPayment(paymentIntentId);

    return {
      success: true,
      message: `Booking ${booking.id} confirmed successfully.`,
    };
  }

  @Post(':id/retry-payment')
  async retryPayment(@Param('id') bookingId: string) {
    return this.bookingService.retryPayment(bookingId);
  }
}
