import { IsPositive } from 'class-validator';

export class ConfirmPaymentDto {
  @IsPositive()
  expectedAmount: number;
}
