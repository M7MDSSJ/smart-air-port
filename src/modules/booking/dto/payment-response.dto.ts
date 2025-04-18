import { ApiProperty } from '@nestjs/swagger';

export class PaymentConfirmationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Booking bkg_12345 confirmed successfully.' })
  message: string;

  @ApiProperty({
    example: {
      booking: {
        id: 'bkg_12345',
        status: 'confirmed',
      },
      receiptUrl: 'https://stripe.com/receipt/abc123',
    },
  })
  data: {
    booking: any;
    receiptUrl: string;
  };
}
