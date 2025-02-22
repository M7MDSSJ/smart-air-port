import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'e1dASL2qpwd2ld!@asca',
    description: 'Verification token',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  verificationToken: string;
}
