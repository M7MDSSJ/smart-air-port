import { Type } from 'class-transformer';
import { IsArray, ValidateNested, IsOptional, IsString, IsNotEmpty, IsEnum, Min, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SeatClass } from '../types/booking.types';
import { PaymentProvider } from '../types/booking.types';
import { BaggageSelectionDto } from '../../flight/dto/baggage.dto';

export class SeatSelectionDto {
  @ApiProperty({ example: 'B2', description: 'Seat number (e.g., A1, B2)' })
  @IsString()
  @IsNotEmpty()
  seatNumber: string;

  @ApiProperty({
    example: 'economy',
    enum: ['economy', 'premium_economy', 'business', 'first'],
    description: 'Class of the seat',
  })
  @IsEnum(['economy', 'premium_economy', 'business', 'first'] as const, {
    message: 'Invalid seat class. Valid values: economy, premium_economy, business, first',
  })
  @IsNotEmpty()
  class: SeatClass;

  @ApiProperty({ example: 100, description: 'Price of the seat in currency units' })
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price must be positive' })
  price: number;
}

export class CreateBookingDto {
  @ApiProperty({
    type: [SeatSelectionDto],
    description: 'Array of selected seats',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatSelectionDto)
  seats: SeatSelectionDto[];

  @ApiProperty({ example: '67bd1121eb2ea3cd9bb865bf', description: 'MongoDB ID of the flight' })
  @IsString()
  @IsNotEmpty()
  flightId: string;

  @ApiProperty({
    example: 'stripe',
    enum: ['stripe', 'paypal', 'mobile_wallet'],
    description: 'Payment provider for the booking',
  })
  @IsString()
  @IsNotEmpty()
  paymentProvider: PaymentProvider;

  @ApiProperty({
    example: 'd1244128-122b-11ee-be56-024123120002',
    description: 'Unique key to prevent duplicate bookings',
  })
  @IsString()
  @IsNotEmpty({ message: 'Idempotency key is required' })
  idempotencyKey: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaggageSelectionDto)
  baggageOptions?: BaggageSelectionDto[];
}