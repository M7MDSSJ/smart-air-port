// src/users/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'cse' })
  firstName: string;

  @ApiProperty({ example: 'zag' })
  lastName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: ['user'] })
  roles: string[];

  @ApiProperty({ example: false })
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