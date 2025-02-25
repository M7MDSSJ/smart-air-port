import { IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Expected amount in cents for payment confirmation',
    example: 25000,
  })
  @IsPositive()
  expectedAmount: number;
}
