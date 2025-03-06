import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Ahmed', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'First name must be at least 3 characters' })
  firstName?: string;

  @ApiProperty({ example: 'MMM', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Last name must be at least 3 characters' })
  lastName?: string;

  @ApiProperty({ example: 'cse.zag1@example.com', required: false })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '01265564651', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be a valid international number',
  })
  phoneNumber?: string;
}
