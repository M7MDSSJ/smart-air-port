import { IsOptional, IsDateString, IsString, IsNumber, Min } from 'class-validator';

export class QueryFlightDto {
  @IsOptional()
  @IsString()
  departureAirport?: string;

  @IsOptional()
  @IsString()
  arrivalAirport?: string;

  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  adults?: number;
}

export interface FlightQueryFilter {
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: {
    $gte: Date;
    $lte: Date;
  };
}
