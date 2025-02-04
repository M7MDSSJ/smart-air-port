import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @IsStrongPassword()
  newPassword: string;
}
