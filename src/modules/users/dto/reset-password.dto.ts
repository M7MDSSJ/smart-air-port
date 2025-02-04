import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  readonly token: string;

  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  readonly newPassword: string;
}
