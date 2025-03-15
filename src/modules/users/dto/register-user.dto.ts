import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsStrongPassword,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Passsssword12@@' })
  @IsStrongPassword(
    { minSymbols: 1, minNumbers: 1, minLowercase: 1, minUppercase: 1 },
    {
      message:
        'Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol',
    },
  )
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(3, { message: 'First name must be at least 3 characters' })
  firstName: string;

  @ApiProperty({ example: 'MMM' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(3, { message: 'Last name must be at least 3 characters' })
  lastName: string;

  @ApiProperty({ example: '22265564651', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNumber?: string;

  @ApiProperty({ example: 'KSA', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: '1990-01-01', required: false })
  @IsDateString()
  @IsOptional()
  birthdate?: string;
}
