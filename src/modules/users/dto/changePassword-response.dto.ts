import { ApiProperty } from "@nestjs/swagger";
export class ChangePasswordResponseDto {
    @ApiProperty({ example: true })
    success: boolean;
  
    @ApiProperty({ example: 'Password changed successfully' })
    message: string;
  }