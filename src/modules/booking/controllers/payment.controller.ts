import { Controller, Post, Body, Headers, Param } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  async handleWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentService.handleWebhookEvent(rawBody, signature);
  }
  @Post('confirm/:paymentIntentId')
  async confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Body() body: { expectedAmount: number },
  ): Promise<void> {
    return this.paymentService.confirmPayment(
      paymentIntentId,
      body.expectedAmount,
    );
  }
}
