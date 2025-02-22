import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsStrongPassword } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!', description: 'Old password' })
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'New password' })
  @IsString()
  @MinLength(6)
  @IsStrongPassword()
  newPassword: string;
}
