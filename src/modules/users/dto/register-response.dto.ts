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

  @ApiProperty({ example: 'male', required: false })
  gender?: string;

  @ApiProperty({ example: 'en', required: false })
  preferredLanguage?: string;

  @ApiProperty({ example: ['AA', 'UA'], required: false })
  preferredAirlines?: string[];

  @ApiProperty({ example: 'mobile', required: false })
  deviceType?: string;

  @ApiProperty({ example: 'miles', required: false })
  loyaltyProgram?: string;

  @ApiProperty({ example: [], required: false })
  bookingHistory?: Array<{
    airline: string;
    date: Date;
    cabinClass: string;
  }>;

  @ApiProperty({ example: 'economy', required: false })
  preferredCabinClass?: string;

  @ApiProperty({ example: true, required: false })
  useRecommendationSystem?: boolean;
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
    user: BasicUserResponseDto;
  };
}
export class BasicUserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phoneNumber: string;
  isVerified: boolean;
  birthdate?: string;
}
