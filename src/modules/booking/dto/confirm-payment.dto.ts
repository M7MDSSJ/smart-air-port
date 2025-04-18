import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Booking ID', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  bookingId: string;

  @ApiProperty({ description: 'Stripe payment method ID', example: 'pm_card_visa' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;

  @ApiProperty({ description: 'Expected amount in smallest currency unit (e.g. cents)', example: 5000 })
  @IsNumber()
  @Min(1)
  expectedAmount: number;
}
