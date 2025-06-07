import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePaymobPaymentDto {
  @IsMongoId()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class PaymobPaymentResponseDto {
  paymentKey: string;
  iframeId: string;
  integrationId: string;
  success: boolean;
  paymentUrl: string;
}
