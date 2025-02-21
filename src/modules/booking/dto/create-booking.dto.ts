// src/modules/booking/dto/create-booking.dto.ts
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatClass } from '../types/booking.types';
import { PaymentProvider } from '../types/booking.types';

export class SeatSelectionDto {
  @IsString()
  @IsNotEmpty()
  seatNumber: string;

  @IsEnum(['economy', 'premium_economy', 'business', 'first'] as const, {
    message:
      'Invalid seat class. Valid values: economy, premium_economy, business, first',
  })
  @IsNotEmpty()
  class: SeatClass;

  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price must be positive' })
  price: number;
}

export class CreateBookingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatSelectionDto)
  seats: SeatSelectionDto[];

  @IsString()
  @IsNotEmpty()
  flightId: string;

  @IsString()
  @IsNotEmpty()
  paymentProvider: PaymentProvider;

  // Require the idempotencyKey.
  @IsString()
  @IsNotEmpty({ message: 'Idempotency key is required' })
  idempotencyKey: string;
}
