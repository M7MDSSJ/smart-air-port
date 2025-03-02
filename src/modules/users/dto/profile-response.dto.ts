import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './register-response.dto';

export class ProfileResponseDto {
  @ApiProperty({ example: 'User profile retrieved successfully' })
  message: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}