import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsStrongPassword } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-code', description: 'Reset code' })
  @IsString()
  readonly code: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'New password' })
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  readonly newPassword: string;
}
