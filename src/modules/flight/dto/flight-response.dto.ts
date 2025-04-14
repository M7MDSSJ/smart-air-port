import { Exclude, Expose } from 'class-transformer';

export class FlightResponseDto {
  @Expose()
  offerId: string;

  @Expose()
  flightNumber: string;

  @Expose()
  airline: string;

  @Expose()
  airlineName: string;

  @Expose()
  departureAirport: string;

  @Expose()
  departureTime: Date;

  @Expose()
  departureTimeLocal: string;

  @Expose()
  arrivalAirport: string;

  @Expose()
  arrivalTime: Date;

  @Expose()
  arrivalTimeLocal: string;

  @Expose()
  status: string;

  @Expose()
  aircraft?: string;

  @Expose()
  price: number;

  @Expose()
  currency: string;

  @Expose()
  totalPrice: number;

  @Expose()
  seatsAvailable: number;
  
  @Expose()
  bookable: boolean;

  @Expose()
  stops: Array<{
    airport: string;
    arrivalTime: Date;
    departureTime: Date;
    flightNumber: string;
    carrierCode: string;
    layoverDuration?: string;
    layoverDurationInMinutes?: number;
  }>;

  @Expose()
  lastTicketingDate: string;

  @Expose()
  baggageOptions: {
    included: string;
    options: Array<{ weightInKg: number; price: number }>;
  };

  @Expose()
  _id: string;

  @Expose()
  duration: string;

  @Expose()
  durationInMinutes: number;

  @Expose()
  numberOfStops: number;

  @Expose()
  isRecommended: boolean;

  @Expose()
  departureHour: number;

  @Exclude()
  version: number;
}