import { IsEnum, IsOptional, IsString, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../types/booking.types';

export class QueryBookingDto {
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 10,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Booking status filter',
    required: false,
    enum: ['pending', 'confirmed', 'cancelled', 'expired', 'failed'],
  })
  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'cancelled', 'expired', 'failed'])
  status?: BookingStatus;

  @ApiProperty({
    description: 'User ID to filter bookings',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Start date for booking search range (ISO format)',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'End date for booking search range (ISO format)',
    required: false,
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({
    description: 'Field to sort results by',
    required: false,
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'status', 'totalPrice'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order (-1 for descending, 1 for ascending)',
    required: false,
    default: -1,
    enum: [1, -1],
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum([1, -1])
  sortOrder?: -1 | 1;
}
