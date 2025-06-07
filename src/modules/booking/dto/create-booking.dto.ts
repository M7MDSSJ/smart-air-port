import {
  IsDateString,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsValidPhoneNumber } from '../../../common/validators/is-valid-phone-number';
import { IsValidCountry } from '../../../common/validators/is-valid-country';

export enum TravelerType {
  ADULT = 'adult',
  CHILD = 'child',
  INFANT = 'infant',
}

export class ContactDetailsDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Contact email for booking notifications',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: '+201234567890',
    description: 'Contact phone number in international format',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsValidPhoneNumber({
    message:
      'Phone number must be a valid international phone number (e.g., +201234567890)',
  })
  phone: string;
}

export class TravellerInfoDto {
  @ApiProperty({
    example: 'Ahmed',
    description: 'Traveler first name',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  firstName: string;

  @ApiProperty({
    example: 'Mohamed',
    description: 'Traveler last name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  lastName: string;

  @ApiProperty({
    example: '2000-02-01',
    description: 'Traveler birth date in YYYY-MM-DD format',
  })
  @IsDateString(
    {},
    { message: 'Birth date must be a valid date in YYYY-MM-DD format' },
  )
  birthDate: string;

  @ApiProperty({
    enum: TravelerType,
    example: TravelerType.ADULT,
    description: 'Type of traveler',
  })
  @IsEnum(TravelerType, {
    message: 'Traveler type must be adult, child, or infant',
  })
  travelerType: TravelerType;

  @ApiProperty({
    example: 'Egyptian',
    description: 'Traveler nationality',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nationality is required' })
  @IsValidCountry({
    message: 'Nationality must be a valid country name or ISO code',
  })
  nationality: string;

  @ApiProperty({
    example: 'A12345678',
    description: 'Passport number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Passport number is required' })
  @MinLength(6, { message: 'Passport number must be at least 6 characters' })
  passportNumber: string;

  @ApiProperty({
    example: 'Egypt',
    description: 'Passport issuing country',
  })
  @IsString()
  @IsNotEmpty({ message: 'Issuing country is required' })
  @IsValidCountry({
    message: 'Issuing country must be a valid country name or ISO code',
  })
  issuingCountry: string;

  @ApiProperty({
    example: '2030-02-01',
    description: 'Passport expiry date in YYYY-MM-DD format',
  })
  @IsDateString(
    {},
    { message: 'Expiry date must be a valid date in YYYY-MM-DD format' },
  )
  expiryDate: string;
}

export class CreateBookingDto {
  @ApiProperty({
    example: 'FL123456',
    description: 'Unique flight identifier',
  })
  @IsString()
  @IsNotEmpty({ message: 'Flight ID is required' })
  flightID: string;

  @ApiProperty({
    example: 'LGA',
    description: 'Origin airport IATA code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Origin airport code is required' })
  @MinLength(3, { message: 'Airport code must be 3 characters' })
  originAirportCode: string;

  @ApiProperty({
    example: 'DAD',
    description: 'Destination airport IATA code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Destination airport code is required' })
  @MinLength(3, { message: 'Airport code must be 3 characters' })
  destinationAirportCode: string;

  @ApiProperty({
    example: 'New York',
    description: 'Origin city name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Origin city is required' })
  originCIty: string;

  @ApiProperty({
    example: 'Da Nang',
    description: 'Destination city name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Destination city is required' })
  destinationCIty: string;

  @ApiProperty({
    example: '2024-08-28',
    description: 'Departure date in YYYY-MM-DD format',
  })
  @IsDateString(
    {},
    { message: 'Departure date must be a valid date in YYYY-MM-DD format' },
  )
  departureDate: string;

  @ApiProperty({
    example: '2024-08-28',
    description: 'Arrival date in YYYY-MM-DD format',
  })
  @IsDateString(
    {},
    { message: 'Arrival date must be a valid date in YYYY-MM-DD format' },
  )
  arrivalDate: string;

  @ApiProperty({
    example: {
      type: 'checked',
      weight: '23kg',
      price: 50,
      currency: 'USD',
    },
    description: 'Selected baggage option details',
    required: false,
  })
  @IsOptional()
  selectedBaggageOption?: Record<string, any>;

  @ApiProperty({
    example: 1500.0,
    description: 'Total price including all fees and taxes',
  })
  @IsNumber({}, { message: 'Total price must be a valid number' })
  @Min(0, { message: 'Total price must be positive' })
  totalPrice: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code (ISO 4217)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Currency is required' })
  @MinLength(3, { message: 'Currency must be 3 characters' })
  currency: string;

  @ApiProperty({
    type: [TravellerInfoDto],
    description: 'Array of traveler information',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravellerInfoDto)
  travellersInfo: TravellerInfoDto[];

  @ApiProperty({
    type: ContactDetailsDto,
    description: 'Contact details for booking notifications',
  })
  @ValidateNested()
  @Type(() => ContactDetailsDto)
  contactDetails: ContactDetailsDto;

  @ApiProperty({
    example: 'BK123456',
    description: 'Booking reference (auto-generated if not provided)',
    required: false,
  })
  @IsString()
  @IsOptional()
  bookingRef?: string;
}
