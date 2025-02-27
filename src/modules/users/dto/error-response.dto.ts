// src/users/dto/error-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Validation failed', description: 'A human-readable error message' })
  message: string;

  @ApiProperty({ example: 'Bad Request', description: 'The type of error' })
  error: string;

  @ApiProperty({ example: 400, description: 'HTTP status code of the error' })
  statusCode: number;

  @ApiProperty({ example: '2025-02-27T09:05:47.193Z', description: 'Timestamp of the error' })
  timestamp: string;

  @ApiProperty({
    example: '/users/register',
    description: 'The endpoint path where the error occurred (varies by route)',
  })
  path: string;

  @ApiProperty({
    required: false,
    example: { email: 'Invalid email format' },
    description: 'Optional validation errors (if applicable)',
  })
  errors?: Record<string, string>;
}