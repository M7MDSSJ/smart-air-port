import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsStrongPassword } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token', description: 'Reset token' })
  @IsString()
  readonly token: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'New password' })
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  readonly newPassword: string;
}
