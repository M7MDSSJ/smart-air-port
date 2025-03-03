import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
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
import Redlock, { Lock } from 'redlock';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    @Inject(FLIGHT_REPOSITORY) private readonly flightRepository: IFlightRepository,
    @Inject('REDLOCK') private readonly redlock: Redlock,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async create(createFlightDto: CreateFlightDto): Promise<Flight> {
    const { departureTime, arrivalTime, seats, price, flightNumber } = createFlightDto;
    const depTime = new Date(departureTime);
    const arrTime = new Date(arrivalTime);

    if (isNaN(depTime.getTime()) || isNaN(arrTime.getTime())) {
      throw new BadRequestException(this.i18n.t('errors.invalidDate'));
    }
    if (depTime >= arrTime) {
      throw new BadRequestException(this.i18n.t('errors.departureBeforeArrival'));
    }
    if (seats <= 0) {
      throw new BadRequestException(this.i18n.t('errors.seatsPositive'));
    }
    if (price <= 0) {
      throw new BadRequestException(this.i18n.t('errors.pricePositive'));
    }

    const existingFlight = await this.flightRepository.findByFlightNumber(flightNumber);
    if (existingFlight) {
      throw new ConflictException(this.i18n.t('errors.flightExists'));
    }

    this.logger.log(`Creating flight ${flightNumber}`);
    return this.flightRepository.create(createFlightDto);
  }

  async updateSeats(params: FlightUpdateSeatsParams, retries = 3): Promise<Flight> {
    const { flightId, seatDelta } = params;
    const lockKey = `flight:${flightId}:seat_lock`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      let lock: Lock | undefined;
      try {
        lock = await this.redlock.acquire([lockKey], 5000);
        const updatedFlight = await this.flightRepository.updateSeats(params);
        if (!updatedFlight) throw new NotFoundException('Flight not found');
        return updatedFlight;
      } catch (error) {
        this.logger.error(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt === retries) {
          await this.emailService.sendImportantEmail(
            this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
            'Seat Update Failure',
            `Failed to update seats for flight ${flightId} after ${retries} attempts.`,
          );
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 200));
      } finally {
        if (lock) await lock.release();
      }
    }
    throw new Error('Unexpected exit from retry loop');
  }

  async findAll(query: QueryFlightDto, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [flights, total] = await Promise.all([
      this.flightRepository.searchFlights({ ...query, skip, limit }),
      this.flightRepository.countFlights(query),
    ]);
    return { flights, total, page, limit };
  }

  async findOne(id: string): Promise<Flight> {
    const flight = await this.flightRepository.findById(id);
    if (!flight) throw new NotFoundException('Flight not found');
    return flight;
  }

  async update(id: string, updateFlightDto: UpdateFlightDto): Promise<Flight> {
    if (typeof updateFlightDto.version !== 'number') {
      throw new BadRequestException('Optimistic locking requires current version number');
    }
    const updateData = { ...updateFlightDto, version: updateFlightDto.version + 1 };
    const flight = await this.flightRepository.findOneAndUpdate(
      { _id: id, version: updateFlightDto.version },
      { $set: updateData },
    );
    if (!flight) {
      const current = await this.flightRepository.findById(id);
      throw new ConflictException(`Version mismatch. Current version: ${current?.version || 0}`);
    }
    return flight;
  }

  async findByFlightNumber(flightNumber: string): Promise<Flight | null> {
    return this.flightRepository.findByFlightNumber(flightNumber);
  }

  async searchAvailableFlights(query: QueryFlightDto): Promise<Flight[]> {
    const filter: FlightAvailabilityQuery = { seatsAvailable: { $gt: 0 } };
    if (query.departureAirport) filter.departureAirport = query.departureAirport;
    if (query.arrivalAirport) filter.arrivalAirport = query.arrivalAirport;
    if (query.departureDate) {
      const date = new Date(query.departureDate);
      if (isNaN(date.getTime())) throw new BadRequestException('Invalid departure date format');
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }
    return this.flightRepository.searchAvailableFlights(filter);
  }

  async remove(id: string): Promise<Flight> {
    this.logger.log(`Attempting to delete flight ${id}`);
    const result = await this.flightRepository.delete(id);
    if (!result) throw new NotFoundException('Flight not found');
    this.logger.log(`Successfully deleted flight ${id}`);
    return result;
  }
}