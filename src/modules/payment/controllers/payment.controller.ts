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
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymobService } from '../services/paymob.service';
import { PaymentTransactionService } from '../services/payment-transaction.service';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  CreatePaymobPaymentDto,
  PaymobPaymentResponseDto,
} from '../dto/paymob-payment.dto';
import { BookingService } from '../../booking/services/booking.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymobService: PaymobService,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly configService: ConfigService,
    private readonly bookingService: BookingService,
  ) {}

  @Post('create-payment-intent')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(
    @User() user: JwtUser,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    this.logger.log(`Creating payment intent for testing`);

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
    const message =
      result.message ||
      (result.success
        ? 'Payment confirmed successfully'
        : 'Payment confirmation failed');

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
    this.logger.log(
      `Getting payment status for booking: ${bookingId}, user: ${user.id}`,
    );

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
    @Headers('x-paymob-signature') paymobSignature: string,
    @Headers('x-provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.debug(
      `Webhook received: provider=${provider}, paymobSignature=${paymobSignature}`,
    );
    if (provider === 'paymob') {
      this.logger.log('Received Paymob webhook');
      return this.paymobService.handleWebhook(paymobSignature, req.rawBody);
    } else {
      this.logger.log('Received Stripe webhook');
      return this.paymentService.handleWebhook(signature, req.rawBody);
    }
  }

  @Post('test-card-payment')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async testCardPayment(
    @User() user: JwtUser,
    @Body()
    body: {
      bookingId: string;
      testCard?: string;
      amount: number;
      currency: string;
    },
  ) {
    this.logger.log(`Testing card payment`);

    const result = await this.paymentService.testCardPaymentFromBackend(
      body.bookingId,
      body.amount,
      body.currency,
      body.testCard || 'pm_card_visa',
    );

    return {
      success: result.success,
      message: result.success
        ? 'Card payment test successful'
        : 'Card payment test failed',
      data: result,
      error: null,
      meta: null,
    };
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() request: any,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('Received Stripe webhook');
    return this.paymentService.handleStripeWebhook(request.rawBody, signature);
  }

  @Get('stripe/config')
  @HttpCode(HttpStatus.OK)
  async getStripeConfig() {
    const stripePublicKey = this.configService.get<string>('STRIPE_PUBLIC_KEY');
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    return {
      success: true,
      data: {
        publicKey: stripePublicKey,
        secretKeyPrefix: stripeSecretKey ? stripeSecretKey.substring(0, 12) + '...' : 'NOT_SET',
        keysMatch: stripePublicKey && stripeSecretKey &&
                   stripePublicKey.includes(stripeSecretKey.split('_')[2]) // Extract account ID
      },
      message: 'Stripe configuration retrieved'
    };
  }

  @Get('stripe/test-cards')
  @HttpCode(HttpStatus.OK)
  async getTestCards() {
    return {
      success: true,
      data: this.paymentService.getTestPaymentMethods(),
      message: 'Test payment methods retrieved'
    };
  }

  // Test endpoints removed for production security

  @Get('debug/payment-intent/:paymentIntentId')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async debugPaymentIntent(
    @User() user: JwtUser,
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    this.logger.log(`Debugging payment intent: ${paymentIntentId} for user: ${user.id}`);

    try {
      const paymentIntent = await this.paymentService.getPaymentIntentDetails(paymentIntentId);

      return {
        success: true,
        data: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          client_secret_prefix: paymentIntent.client_secret ?
            paymentIntent.client_secret.substring(0, 20) + '...' : 'null',
          metadata: paymentIntent.metadata,
          created: new Date(paymentIntent.created * 1000),
        },
        message: 'Payment intent details retrieved'
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve payment intent details'
      };
    }
  }

  @Post('paymob/create-payment-key')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPaymobPaymentKey(
    @User() user: JwtUser,
    @Body() createPaymobPaymentDto: CreatePaymobPaymentDto,
  ): Promise<PaymobPaymentResponseDto> {
    this.logger.log(
      `Creating Paymob payment key for user: ${user.id}, booking: ${createPaymobPaymentDto.bookingId}`,
    );

    // Get the booking details
    const booking = await this.paymentService.getBookingById(
      createPaymobPaymentDto.bookingId,
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify the booking belongs to the user
    if (booking.userId.toString() !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to pay for this booking',
      );
    }

    // Check if booking is already paid
    if (booking.paymentStatus === 'paid') {
      throw new BadRequestException('This booking is already paid');
    }

    // Convert amount to cents (Paymob expects amount in the smallest currency unit)
    const amountCents = Math.round(booking.totalPrice * 100);

    // Create billing data for Paymob
    const billingData = {
      apartment: 'NA',
      email: createPaymobPaymentDto.email || user.email,
      floor: 'NA',
      first_name: user.firstName || 'User',
      street: 'NA',
      building: 'NA',
      phone_number: createPaymobPaymentDto.mobileNumber || '+201234567890', // Default number if not provided
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'NA',
      country: 'EG',
      last_name: user.lastName || 'NA',
      state: 'NA',
    };

    // Get auth token from Paymob
    const authToken = await this.paymobService.authenticate();

    // Register order with Paymob
    const { orderId } = await this.paymobService.registerOrder(
      authToken,
      createPaymobPaymentDto.bookingId,
      amountCents,
      'EGP', // Force EGP for Paymob
    );

    // Get payment key from Paymob
    const paymentKey = await this.paymobService.requestPaymentKey(
      authToken,
      amountCents,
      orderId,
      billingData,
      'EGP', // Force EGP for Paymob
    );

    // Create a payment record with PENDING status
    const paymentData: CreatePaymentDto = {
      userId: user.id,
      bookingId: createPaymobPaymentDto.bookingId,
      amount: booking.totalPrice,
      currency: 'EGP',
      provider: PaymentProvider.PAYMOB,
      method: PaymentMethod.CREDIT_CARD,
      paymentKey: paymentKey.paymentKey,
      metadata: {
        paymobOrderId: orderId,
        integrationId: this.paymobService.getCardIntegrationId(),
      },
      isTest: process.env.NODE_ENV !== 'production',
    };
    const payment = await this.paymentTransactionService.createPayment(
      paymentData,
    );
    this.logger.log(
      `Created initial payment record ${payment._id.toString()} with pending status for booking ${
        createPaymobPaymentDto.bookingId
      }`,
    );

    // Build the full payment URL for the iframe
    const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${this.paymobService.getIframeId()}?payment_token=${paymentKey.paymentKey}`;

    // Return the payment key, payment URL, and other required data for the Flutter SDK
    return {
      success: true,
      paymentKey: paymentKey.paymentKey,
      iframeId: this.paymobService.getIframeId(),
      integrationId: this.paymobService.getCardIntegrationId(),
      paymentUrl,
    };
  }
}
