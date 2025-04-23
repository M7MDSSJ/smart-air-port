import { ApiProperty } from '@nestjs/swagger';

export class BookingErrorResponseDto {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  error?: string;
}
