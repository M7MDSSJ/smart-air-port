import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  IsString,
  Validate
} from 'class-validator';
import { FlightNumberValidator } from './flight-number.validator';
export class UpdateFlightDto {
  
  @IsString()
  @Validate(FlightNumberValidator)
  flightNumber: string;


  @IsOptional()
  @IsIn(['Scheduled', 'Delayed', 'Cancelled', 'Departed', 'Arrived'])
  status?: string;

  @IsInt()
  @IsNotEmpty()
  version: number;

  @IsNumber()
  @IsPositive()
  @Min(0)
  price: number;
  
  @IsOptional()
  departureTime?: Date;

  @IsOptional()
  arrivalTime?: Date;
  
}