import { IsOptional, IsString, IsDateString } from 'class-validator';

export class QueryFlightDto {
  @IsOptional()
  @IsString()
  departureAirport?: string;

  @IsOptional()
  @IsString()
  arrivalAirport?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  departureDate?: string;
}
