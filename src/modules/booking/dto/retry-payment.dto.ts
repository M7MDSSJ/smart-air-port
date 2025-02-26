import { ApiProperty } from '@nestjs/swagger';
import { BookingResponseDto } from '../dto/booking-response.dto';

// Define the DTO class separately
export class RetryPaymentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: BookingResponseDto })
  data: BookingResponseDto;
}