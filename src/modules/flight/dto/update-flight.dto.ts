// update-flight.dto.ts
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';

export class UpdateFlightDto {
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
