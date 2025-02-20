import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  IsArray,
  Validate,
  ValidateNested,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IsAfter,
  IsBefore,
} from 'src/common/decorators/date-validation.decorator';

export class CreateFlightDto {
  @IsNotEmpty()
  @IsString()
  flightNumber: string;

  @IsString()
  @IsNotEmpty()
  airline: string;

  @IsString()
  @IsNotEmpty()
  departureAirport: string;

  @IsString()
  @IsNotEmpty()
  arrivalAirport: string;

  @IsDateString({ strict: true })
  @Validate(IsBefore, ['arrivalTime'])
  departureTime: string;

  @IsDateString({ strict: true })
  @IsAfter('departureTime')
  arrivalTime: string;

  @IsString()
  @IsOptional()
  aircraft?: string;

  @IsNumber()
  @IsPositive()
  @Min(0)
  price: number;

  @IsNumber()
  @IsPositive()
  @Min(1)
  seats: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  @IsOptional()
  stops: StopDto[];
}
class StopDto {
  @IsString()
  @IsNotEmpty()
  airport: string;

  @IsDateString()
  arrivalTime: string;

  @IsDateString()
  departureTime: string;
}
