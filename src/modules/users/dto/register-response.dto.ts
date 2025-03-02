// src/users/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'Ahmed' })
  firstName: string;

  @ApiProperty({ example: 'MMM' })
  lastName: string;

  @ApiProperty({ example: 'cse.zag1@example.com' })
  email: string;

  @ApiProperty({ example: 'KSA' })
  country?: string;

  @ApiProperty({ example: '01265564651' })
  phoneNumber?: string;

  @ApiProperty({ example: true })
  isVerified: boolean;
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