import { ApiProperty } from '@nestjs/swagger';
import { BookingResponseDto } from './booking-response.dto';

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of bookings that match the filter criteria',
    example: 157,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 16,
  })
  pages: number;
}

export class PaginatedBookingsResponseDto {
  @ApiProperty({
    description: 'Whether the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'A message describing the result',
    example: 'Retrieved 10 bookings',
  })
  message: string;

  @ApiProperty({
    description: 'The booking data',
    type: [BookingResponseDto],
  })
  data: BookingResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}
