import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IFlightRepository } from './repositories/flight.repository.interface';
import { CreateFlightDto } from './dto/create-flight.dto';
import { QueryFlightDto } from './dto/query-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
@Injectable()
export class FlightService {
  constructor(private readonly flightRepository: IFlightRepository) {}

  async create(createFlightDto: CreateFlightDto) {
    const existingFlight = await this.flightRepository.findByFlightNumber(
      createFlightDto.flightNumber,
    );

    if (existingFlight) {
      // Handle the duplicate case, e.g., throw an exception
      throw new ConflictException('Flight with this number already exists');
    }

    return this.flightRepository.create(createFlightDto);
  }

  findAll(query: QueryFlightDto) {
    return this.flightRepository.searchFlights(query);
  }

  async findOne(id: string) {
    const flight = await this.flightRepository.findById(id);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }

  async update(id: string, updateFlightDto: UpdateFlightDto) {
    const flight = await this.flightRepository.update(id, updateFlightDto);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }

  async remove(id: string) {
    const flight = await this.flightRepository.delete(id);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }

  async searchAvailableFlights(query: QueryFlightDto) {
    return this.flightRepository.searchAvailableFlights(query);
  }
}
