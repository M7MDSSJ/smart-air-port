// src/flight/dto/query-flight.dto.ts
import { IsOptional, IsDateString, IsString, IsNumber, Min, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TripType {
  OneWay = 'oneway',
  RoundTrip = 'roundtrip',
  MultiCity = 'multicity',
}

export enum CabinClass {
  Economy = 'ECONOMY',
  PremiumEconomy = 'PREMIUM_ECONOMY',
  Business = 'BUSINESS',
  First = 'FIRST',
}

export class MultiCityLeg {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsDateString()
  departureDate: string;
}

export class QueryFlightDto {
  @IsEnum(TripType)
  tripType: TripType;

  @IsString()
  departureAirport: string;

  @IsString()
  arrivalAirport: string;

  @IsDateString()
  departureDate: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number) // Transform string to number
  adults: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number) // Transform string to number
  children?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number) // Transform string to number
  infants?: number;

  @IsEnum(CabinClass)
  cabinClass: CabinClass;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultiCityLeg)
  multiCityLegs?: MultiCityLeg[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  airline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxStops?: number;

  @IsOptional()
  @IsString()
  departureTimeRange?: 'morning' | 'afternoon' | 'evening' | 'night'; // e.g., morning: 00:00-12:00, afternoon: 12:00-18:00


  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'duration' | 'stops' | 'totalPrice';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // Pagination parameters
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

export interface FlightQueryFilter {
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: {
    $gte: Date;
    $lte: Date;
  };
  adults?: number;
  children?: number;
  infants?: number;
  cabinClass?: CabinClass;
  multiCityLegs?: MultiCityLeg[];
}