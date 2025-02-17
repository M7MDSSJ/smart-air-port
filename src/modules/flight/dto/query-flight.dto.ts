// query-flight.dto.ts
import { IsOptional, IsDateString, IsString } from 'class-validator';

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
}
export interface FlightQueryFilter {
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: {
    $gte: Date;
    $lte: Date;
  };
}
