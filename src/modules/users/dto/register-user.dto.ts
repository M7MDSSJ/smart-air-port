import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsStrongPassword,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'User password' })
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'cse', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  firstName: string;

  @ApiProperty({ example: 'zag', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  lastName: string;

  @ApiProperty({
    example: '123-456-7890',
    description: 'User phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
