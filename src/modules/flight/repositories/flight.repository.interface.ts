import { Flight } from '../schemas/flight.schema';
import { UpdateFlightDto } from '../dto/update-flight.dto';
import { QueryFlightDto } from '../dto/query-flight.dto';
import { FlightAvailabilityQuery } from '../dto/available-flight-query.dto';
import { FlightUpdateSeatsParams } from '../dto/flight-update-seats.dto';
import { UpdateQuery, FilterQuery, QueryOptions } from 'mongoose';
export const FLIGHT_REPOSITORY = 'FLIGHT_REPOSITORY';

export interface IFlightRepository {
  
  findAll(): Promise<Flight[]>;
  findById(id: string): Promise<Flight | null>;
  findOneAndUpdate(
    filter: FilterQuery<Flight>,
    update: UpdateQuery<Flight>,
    options?: QueryOptions
  ): Promise<Flight | null>;
  findByFlightNumber(flightNumber: string): Promise<Flight | null>;
  searchFlights(query: QueryFlightDto & { skip?: number; limit?: number }): Promise<Flight[]>; 
  searchAvailableFlights(query: FlightAvailabilityQuery): Promise<Flight[]>;
  countFlights(query: QueryFlightDto): Promise<number>;
  updateSeats(params: FlightUpdateSeatsParams): Promise<Flight | null>;
  update(id: string, updateFlightDto: UpdateFlightDto): Promise<Flight>;
  delete(id: string): Promise<Flight>;
}
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
