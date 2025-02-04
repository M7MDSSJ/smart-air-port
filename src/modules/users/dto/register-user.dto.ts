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
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  lastName: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[]; // Optional field (only admins can set this)

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
