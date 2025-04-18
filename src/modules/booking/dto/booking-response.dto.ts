import { ApiProperty } from '@nestjs/swagger';

export class SeatResponseDto {
  @ApiProperty({ example: '67be8671461b2609214e658c' })
  _id: string;

  @ApiProperty({ example: 'B2' })
  seatNumber: string;

  @ApiProperty({ example: 'economy' })
  class: string;

  @ApiProperty({ example: 100 })
  price: number;
}

export class BookingResponseDto {
  @ApiProperty({ example: 'SMAIR-20250418-XYZ123', description: 'User-friendly booking reference code' })
  bookingRef: string;

  @ApiProperty({ example: '67be8671461b2609214e658b' })
  _id: string;

  @ApiProperty({ example: '67be6d62391984265fc51a7f' })
  user: string;

  @ApiProperty({ example: '67bd1121eb2ea3cd9bb865bf' })
  flight: string;

  @ApiProperty({ type: [SeatResponseDto] })
  seats: SeatResponseDto[];

  @ApiProperty({ example: 1 })
  totalSeats: number;

  @ApiProperty({ example: 100 })
  totalPrice: number;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: 'stripe' })
  paymentProvider: string;

  @ApiProperty({ example: 'd1244128-122b-11ee-be56-024123120002' })
  idempotencyKey: string;

  @ApiProperty({ example: 'pi_3NxyzStripePaymentIntent', required: false })
  paymentIntentId?: string;

  @ApiProperty({ example: '2025-02-26T03:38:37.886Z', required: false })
  expiresAt?: string;

  @ApiProperty({ example: '2025-02-26T03:08:37.898Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-02-26T03:08:37.898Z' })
  updatedAt: string;
  
  @ApiProperty({ example: 0, description: 'Optimistic concurrency control version' })
  version: number;
}