import { ApiProperty } from '@nestjs/swagger';

export class RequestResetPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password reset email sent' })
  message: string;
}