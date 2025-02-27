import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsStrongPassword,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsStrongPassword({
    minSymbols: 1,
    minNumbers: 1,
    minLowercase: 1,
    minUppercase: 1,
  }, {
    message: 'Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol'
  })
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(3, { message: 'First name must be at least 3 characters' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(3, { message: 'Last name must be at least 3 characters' })
  lastName: string;
}