// flight.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  IFlightRepository,
  FLIGHT_REPOSITORY,
} from './repositories/flight.repository.interface';
import { CreateFlightDto } from './dto/create-flight.dto';
import { QueryFlightDto } from './dto/query-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightAvailabilityQuery } from './dto/available-flight-query.dto';
import { Flight } from './schemas/flight.schema';
import { FlightUpdateSeatsParams } from './dto/flight-update-seats.dto';
import Redlock from 'redlock';
interface ILock {
  release(): Promise<void>;
}

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    @Inject(FLIGHT_REPOSITORY)
    private readonly flightRepository: IFlightRepository,
    @Inject('REDLOCK')
    private readonly redlock: Redlock,
  ) {}

  async create(createFlightDto: CreateFlightDto) {
    // Validate dates
    const departureTime = new Date(createFlightDto.departureTime);
    const arrivalTime = new Date(createFlightDto.arrivalTime);

    if (isNaN(departureTime.getTime()) || isNaN(arrivalTime.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (departureTime >= arrivalTime) {
      throw new BadRequestException('Departure must be before arrival');
    }

    const existingFlight = await this.flightRepository.findByFlightNumber(
      createFlightDto.flightNumber,
    );

    if (existingFlight) {
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

  async updateSeats(params: FlightUpdateSeatsParams): Promise<Flight> {
    this.logger.log(
      `Updating seats for flight ${params.flightId}, delta: ${params.seatDelta}, expectedVersion: ${params.expectedVersion}`,
    );

    // Create a unique lock key for the flight seats update
    const lockKey = `flight:${params.flightId}:seat_lock`;
    let lock: ILock | undefined = undefined;

    try {
      // Cast this.redlock to a type with an acquire method returning ILock
      const redlockInstance = this.redlock as unknown as {
        acquire(keys: string[], ttl: number): Promise<ILock>;
      };
      lock = await redlockInstance.acquire([lockKey], 5000);

      // Execute the seat update logic
      const updatedFlight = await this.flightRepository.updateSeats(params);
      if (!updatedFlight) {
        throw new NotFoundException('Flight not found');
      }

      this.logger.log(
        `Seats updated successfully for flight ${params.flightId}`,
      );
      return updatedFlight;
    } catch (error: unknown) {
      let errorMessage = 'Unknown error occurred';
      let stackTrace: string | undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        stackTrace = error.stack;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      this.logger.error(
        `Failed to update seats for flight ${params.flightId}: ${errorMessage}`,
        stackTrace || 'No stack trace available',
      );

      throw new ConflictException('Could not update seat availability');
    } finally {
      // Safely release the lock if it was acquired
      if (lock) {
        await lock.release();
      }
    }
  }

  async update(id: string, updateFlightDto: UpdateFlightDto) {
    if (!updateFlightDto.version) {
      throw new BadRequestException('Version is required for update');
    }

    const flight = await this.flightRepository.findOneAndUpdate(
      { _id: id, version: updateFlightDto.version },
      updateFlightDto,
    );

    if (!flight) {
      throw new NotFoundException('Flight not found or version mismatch');
    }
    return flight;
  }

  async searchAvailableFlights(query: QueryFlightDto) {
    const filter: FlightAvailabilityQuery = {
      seatsAvailable: { $gt: 0 },
    };

    // Add optional filters
    if (query.departureAirport) {
      filter.departureAirport = query.departureAirport;
    }
    if (query.arrivalAirport) {
      filter.arrivalAirport = query.arrivalAirport;
    }

    if (query.departureDate) {
      const date = new Date(query.departureDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid departure date format');
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.departureTime = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    return this.flightRepository.searchAvailableFlights(filter);
  }

  async remove(id: string) {
    this.logger.log(`Attempting to delete flight ${id}`);
    const result = await this.flightRepository.delete(id);

    if (!result) {
      throw new NotFoundException('Flight not found');
    }

    this.logger.log(`Successfully deleted flight ${id}`);
    return result;
  }
}
