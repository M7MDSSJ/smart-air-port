import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordData {
  @ApiProperty({ example: 'Password changed successfully' })
  message: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ChangePasswordData })
  data: ChangePasswordData;
}
