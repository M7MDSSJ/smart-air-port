// src/users/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Ahmed' })
  firstName: string;

  @ApiProperty({ example: 'MMM' })
  lastName: string;

  @ApiProperty({ example: 'cse.zag1@example.com' })
  email: string;

  @ApiProperty({ example: 'EGY', required: false })
  country?: string;

  @ApiProperty({ example: '22265564651', required: false })
  phoneNumber?: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: '1990-01-01', required: false })
  birthdate?: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    type: 'object',
    properties: {
      message: { type: 'string', example: 'User registered successfully' },
      user: { type: UserResponseDto },
    },
  })
  data: {
    message: string;
    user: UserResponseDto;
  };
}