import { ApiProperty } from "@nestjs/swagger";
export class LogoutResponseDto {
    @ApiProperty({ example: true })
    success: boolean;
  
    @ApiProperty({ example: 'User logged out successfully' })
    message: string;
  }