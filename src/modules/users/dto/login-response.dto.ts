import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "./register-response.dto";
export class LoginResponseDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    accessToken: string;
  
    @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4=' })
    refreshToken: string;
  
    @ApiProperty({ type: UserResponseDto })
    user: UserResponseDto;
  }