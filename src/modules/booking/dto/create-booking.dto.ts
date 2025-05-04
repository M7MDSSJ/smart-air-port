import {
  IsDateString,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TravellerInfoDto {
  @IsString()
  gender: string;
  @IsString()
  firstName: string;
  @IsString()
  middleName: string;
  @IsString()
  lastName: string;
  @IsDateString()
  birthDate: string;
  @IsString()
  nationality: string;
  @IsString()
  passportNumber: string;
  @IsString()
  issuingCountry: string;
  @IsDateString()
  expiryDate: string;
  @IsString()
  contactEmail: string;
  @IsString()
  contactPhone: string;
}

export class CreateBookingDto {
  @IsString()
  flightID: string;
  @IsString()
  originAirportCode: string;
  @IsString()
  destinationAirportCode: string;
  @IsString()
  originCIty: string;
  @IsString()
  destinationCIty: string;
  @IsString()
  departureDate: string;
  @IsString()
  arrivalDate: string;
  @IsOptional()
  selectedBaggageOption?: Record<string, any>;
  @IsNumber()
  totalPrice: number;
  @IsNumber()
  applicationFee: number;
  @IsString()
  currency: string;
  @IsString()
  @IsOptional()
  bookingRef?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravellerInfoDto)
  travellersInfo: TravellerInfoDto[];
}
