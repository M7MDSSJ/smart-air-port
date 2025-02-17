// src/common/dto/api-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ required: false })
  error?: string;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    Object.assign(this, partial);
  }
}
