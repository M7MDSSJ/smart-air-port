import { Flight } from '../schemas/flight.schema';
import { CreateFlightDto } from '../dto/create-flight.dto';
import { UpdateFlightDto } from '../dto/update-flight.dto';
import { QueryFlightDto } from '../dto/query-flight.dto';
import { FlightAvailabilityQuery } from '../dto/available-flight-query.dto';
export const FLIGHT_REPOSITORY = 'FLIGHT_REPOSITORY';

export interface IFlightRepository {
  create(createFlightDto: CreateFlightDto): Promise<Flight>;
  findAll(): Promise<Flight[]>;
  findById(id: string): Promise<Flight | null>;
  findByFlightNumber(flightNumber: string): Promise<Flight | null>;
  searchFlights(query: QueryFlightDto): Promise<Flight[]>;
  searchAvailableFlights(query: FlightAvailabilityQuery): Promise<Flight[]>;
  update(id: string, updateFlightDto: UpdateFlightDto): Promise<Flight>;
  delete(id: string): Promise<Flight>;
  // Optionally, add custom queries like searchByAirport, etc.
}
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
