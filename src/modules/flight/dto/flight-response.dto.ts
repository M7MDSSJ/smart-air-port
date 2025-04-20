import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum FlightStatus {
  // Add your flight status values here
}

export class BaggageOptionsDto {
  // Add your baggage options properties here
}

export class FlightResponseDto {
  @Expose()
  @ApiProperty({ example: '6803fbee5815daa3adf959c1' })
  _id: string;

  @Expose()
  @ApiProperty({ example: '1' })
  offerId: string;

  @Expose()
  @ApiProperty({ example: 'NE' })
  airline: string;

  @Expose()
  @ApiProperty({ example: '174' })
  flightNumber: string;

  @Expose()
  @ApiProperty({ example: '320' })
  aircraft: string;

  @Expose()
  @ApiProperty({ example: 'CAI' })
  departureAirport: string;

  @Expose()
  @ApiProperty({ example: '2025-05-20T15:25:00.000Z' })
  departureTime: Date;

  @Expose()
  @ApiProperty({ example: 'JED' })
  arrivalAirport: string;

  @Expose()
  @ApiProperty({ example: '2025-05-20T17:40:00.000Z' })
  arrivalTime: Date;

  @Expose()
  @ApiProperty({ example: 5118.13 })
  price: number;

  @Expose()
  @ApiProperty({ example: 'EGP' })
  currency: string;

  @Expose()
  @ApiProperty({ example: 9 })
  seatsAvailable: number;

  @Expose()
  @ApiProperty({ enum: FlightStatus })
  status: string;

  @Expose()
  @ApiProperty({ type: [String], example: [] })
  stops: string[];

  @Expose()
  @ApiProperty({ example: '2025-05-20' })
  lastTicketingDate: string;

  @Expose()
  @ApiProperty({ type: BaggageOptionsDto })
  baggageOptions: BaggageOptionsDto;

  @Expose()
  @ApiProperty({ example: '2025-04-19T19:39:26.301Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-04-19T19:44:09.777Z' })
  updatedAt: Date;
}