// src/modules/booking/dto/create-booking.dto.ts
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatClass } from '../types/booking.types';
import { PaymentProvider } from '../types/booking.types';

export class SeatSelectionDto {
  @IsString()
  @IsNotEmpty()
  seatNumber: string;

  @IsString()
  @IsNotEmpty()
  class: SeatClass;

  @IsNumber()
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
  @IsUUID(4)
  idempotencyKey: string;
}
