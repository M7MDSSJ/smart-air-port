import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  Headers,
  RawBodyRequest,
  Req,
  Logger,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { VerifiedUserGuard } from 'src/common/guards/verifiedUser.guard';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';
import { Request } from 'express';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-payment-intent')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(
    @User() user: JwtUser,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    this.logger.log(`Creating payment intent for user: ${user.id}`);

    const paymentIntent = await this.paymentService.createPaymentIntent(
      createPaymentIntentDto,
    );

    return {
      success: true,
      message: 'Payment intent created successfully',
      data: paymentIntent,
      error: null,
      meta: null,
    };
  }

  @Post('confirm-payment')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @User() user: JwtUser,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    this.logger.log(`Confirming payment for user: ${user.id}`);

    // Attach the JWT user's email to the DTO
    confirmPaymentDto.userEmail = user.email;

    const result = await this.paymentService.confirmPayment(confirmPaymentDto);

    // Use the message from the service if available, otherwise use default
    const message = result.message ||
      (result.success ? 'Payment confirmed successfully' : 'Payment confirmation failed');

    return {
      success: result.success,
      message: message,
      data: result,
      error: null,
      meta: null,
    };
  }

  @Get('status/:bookingId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('bookingId') bookingId: string,
    @User() user: JwtUser,
  ) {
    this.logger.log(`Getting payment status for booking: ${bookingId}, user: ${user.id}`);

    const status = await this.paymentService.getPaymentStatus(bookingId);

    return {
      success: true,
      message: 'Payment status retrieved successfully',
      data: status,
      error: null,
      meta: null,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('Received Stripe webhook');

    const result = await this.paymentService.handleWebhook(
      signature,
      req.rawBody,
    );

    return result;
  }

 

  @Post('test-card-payment')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async testCardPayment(
    @User() user: JwtUser,
    @Body() body: {
      bookingId: string;
      testCard?: string;
      amount: number;
      currency: string
    },
  ) {
    this.logger.log(`Testing card payment for user: ${user.id}`);

    const result = await this.paymentService.testCardPaymentFromBackend(
      body.bookingId,
      body.amount,
      body.currency,
      body.testCard || 'pm_card_visa'
    );

    return {
      success: result.success,
      message: result.success ? 'Card payment test successful' : 'Card payment test failed',
      data: result,
      error: null,
      meta: null,
    };
  }
}
