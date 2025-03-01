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
import { FlightNumberValidator } from './flight-number.validator';

export class CreateFlightDto {
  @IsNotEmpty({message:'FlightNumber can`t be empty'})
  @IsString({message:'flightNumber must be string'})
  @Validate(FlightNumberValidator)
  flightNumber: string;
  
  @IsString({message:'airLine must be string'})
  @IsNotEmpty({message:'airLine can`t be empty'})
  airline: string;

  @IsString({message:'departureAirport must be string'})
  @IsNotEmpty({message:'departureAirport can`t be empty'})
  departureAirport: string;

  @IsString({message:' arrivalAirport must be string'})
  @IsNotEmpty({message:' arrivalAirport can`t be empty'})
  arrivalAirport: string;

  @IsDateString({ strict: true })
  @Validate(IsBefore, ['arrivalTime'])
  departureTime: string;

  @IsDateString({ strict: true })
  @IsAfter('departureTime')
  arrivalTime: string;

  @IsString({message:' aircraft must be string'})
  @IsOptional()
  aircraft?: string;

  @IsNumber()
  @IsPositive({message:'Price must be positive'})
  @Min(0)
  price: number;

  @IsNumber()
  @IsPositive({message:'seats must be positive'})
  @Min(1)
  seats: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  @IsOptional()
  stops: StopDto[];
}
class StopDto {
  @IsString({message:'airPort must be string'})
  @IsNotEmpty({message:'airPort can`t be empty'})
  airport: string;

  @IsDateString({ strict: true })
  arrivalTime: string;

  @IsDateString({ strict: true })
  departureTime: string;
}
