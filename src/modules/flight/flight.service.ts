import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  IFlightRepository,
  FLIGHT_REPOSITORY,
} from './repositories/flight.repository.interface';
import { CreateFlightDto } from './dto/create-flight.dto';
import { QueryFlightDto } from './dto/query-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightAvailabilityQuery } from './dto/available-flight-query.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    @Inject(FLIGHT_REPOSITORY)
    private readonly flightRepository: IFlightRepository,
  ) {}

  async create(createFlightDto: CreateFlightDto) {
    if (
      new Date(createFlightDto.departureTime) >=
      new Date(createFlightDto.arrivalTime)
    ) {
      throw new BadRequestException('Departure must be before arrival');
    }
    const existingFlight = await this.flightRepository.findByFlightNumber(
      createFlightDto.flightNumber,
    );

    if (existingFlight) {
      // Handle the duplicate case, e.g., throw an exception
      throw new ConflictException('Flight with this number already exists');
    }

    return this.flightRepository.create(createFlightDto);
  }

  async findAll(query: QueryFlightDto) {
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
    if (updateFlightDto.version === undefined) {
      throw new BadRequestException('Version is required for update');
    }
    const flight = await this.flightRepository.findOneAndUpdate(
      { _id: id, version: updateFlightDto.version },
      updateFlightDto,
    );
    if (!flight) {
      throw new NotFoundException('Flight not found or outdated');
    }
    return flight;
  }

  async searchAvailableFlights(query: QueryFlightDto) {
    const filter: FlightAvailabilityQuery = {
      seatsAvailable: { $gt: 0 },
      departureAirport: query.departureAirport,
      arrivalAirport: query.arrivalAirport,
    };

    if (query.departureDate) {
      const date = new Date(query.departureDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }

    // Clean undefined values
    Object.keys(filter).forEach((key) => {
      if (filter[key] === undefined) {
        delete filter[key];
      }
    });

    return this.flightRepository.searchAvailableFlights(filter);
  }

  async remove(id: string) {
    this.logger.warn(`Attempting to delete flight ${id}`);
    const flight = await this.flightRepository.delete(id);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }
}
