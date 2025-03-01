import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
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

  async create(createFlightDto: CreateFlightDto): Promise<Flight> {
    // Validate input values
    const { departureTime, arrivalTime, seats, price, flightNumber } = createFlightDto;
    const depTime = new Date(departureTime);
    const arrTime = new Date(arrivalTime);

    if (isNaN(depTime.getTime()) || isNaN(arrTime.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (depTime >= arrTime) {
      throw new BadRequestException('Departure must be before arrival');
    }
    if (seats <= 0) {
      throw new BadRequestException('Seats must be positive');
    }
    if (price <= 0) {
      throw new BadRequestException('Price must be positive');
    }

    const existingFlight = await this.flightRepository.findByFlightNumber(flightNumber);
    if (existingFlight) {
      throw new ConflictException('Flight number already exists');
    }

    this.logger.log(`Creating flight ${flightNumber}`);
    return this.flightRepository.create(createFlightDto);
  }

  async updateSeats(params: FlightUpdateSeatsParams, retries = 3): Promise<Flight> {
    const { flightId, seatDelta, expectedVersion } = params;
    this.logger.log(
      `Updating seats for flight ${flightId}, delta: ${seatDelta}, expectedVersion: ${expectedVersion}`,
    );

    const lockKey = `flight:${flightId}:seat_lock`;
    let lock: ILock | undefined;

    // Retry loop for acquiring the lock and updating seats
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const redlockInstance = this.redlock as any; // Using type assertion for simplicity
        lock = await redlockInstance.acquire([lockKey], 5000); // TTL of 5 seconds
        const updatedFlight = await this.flightRepository.updateSeats(params);
        if (!updatedFlight) {
          throw new NotFoundException('Flight not found');
        }
        this.logger.log(`Seats updated for flight ${flightId} on attempt ${attempt}`);
        return updatedFlight;
      } catch (error) {
        this.logger.error(`Attempt ${attempt} failed for flight ${flightId}: ${error.message}`);
        if (attempt === retries) {
          throw new HttpException(
            'Failed to update seats after retries',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        // Wait 200ms before retrying
        await new Promise(resolve => setTimeout(resolve, 200));
      } finally {
        if (lock) {
          await lock.release();
          lock = undefined;
        }
      }
    }
    throw new Error('Unexpected exit from retry loop');
  }

  async findAll(query: QueryFlightDto, page = 1, limit = 10) {
    // Get all matching flights using the repository method (which accepts one argument)
    const flights = await this.flightRepository.searchFlights(query);
    // Simulate pagination by slicing the array
    const total = flights.length;
    const paginatedFlights = flights.slice((page - 1) * limit, page * limit);
    return { flights: paginatedFlights, total, page, limit };
  }

  async findOne(id: string): Promise<Flight> {
    const flight = await this.flightRepository.findById(id);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }

  async update(id: string, updateFlightDto: UpdateFlightDto): Promise<Flight> {
    if (typeof updateFlightDto.version !== 'number') {
      throw new BadRequestException('Optimistic locking requires current version number');
    }

    try {
      const updateData = {
        ...updateFlightDto,
        version: updateFlightDto.version + 1,
      };
      const flight = await this.flightRepository.findOneAndUpdate(
        { _id: id, version: updateFlightDto.version },
        updateData,
      );
      if (!flight) {
        const current = await this.flightRepository.findById(id);
        throw new ConflictException(`Version mismatch. Current version: ${current?.version || 0}`);
      }
      return flight;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Flight update failed: ${error.message}`);
      } else {
        this.logger.error('Flight update failed: Unknown error');
      }
      throw new HttpException('Update failed - refresh and try again', HttpStatus.CONFLICT);
    }
  }

  async searchAvailableFlights(query: QueryFlightDto) {
    const filter: FlightAvailabilityQuery = { seatsAvailable: { $gt: 0 } };

    // Add optional filters if provided
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
      filter.departureTime = { $gte: startOfDay, $lte: endOfDay };
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
