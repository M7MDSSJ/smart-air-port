

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { I18nService } from 'nestjs-i18n';
import { QueryFlightDto } from './dto/query-flight.dto';
import { FlightSearchService } from './flight-search.service';
import { SeatHoldService } from './seat-hold.service';
import { BaggageService } from './baggage.service';
import { CacheService } from './cache.service';
import { FormattedFlight } from './interfaces/flight-data.interface';
import { BaggageSelectionDto } from '../../shared/dtos/baggage.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight } from './schemas/flight.schema';
import { PricingService } from './pricing.service';
@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly flightSearchService: FlightSearchService,
    private readonly seatHoldService: SeatHoldService,
    private readonly baggageService: BaggageService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly i18n: I18nService,
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async searchAvailableFlights(query: QueryFlightDto): Promise<{ paginatedFlights: FormattedFlight[]; total: number }> {
    const result = await this.flightSearchService.searchAvailableFlights(query);
    setTimeout(() => {
      this.emailService.sendImportantEmail(
        this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
        this.i18n.t('email.newFlightSearchSubject', { lang: query.language }),
        this.i18n.t('email.newFlightSearchBody', {
          lang: query.language,
          args: { tripType: query.tripType, departureAirport: query.departureAirport, arrivalAirport: query.arrivalAirport, departureDate: query.departureDate },
        }),
      ).catch(err => this.logger.error(`Failed to send notification email: ${err.message}`));
    }, 0);
    return result;
  }

  async createSeatHold(flightId: string, seats: number, sessionId: string) {
    return await this.seatHoldService.createSeatHold(flightId, seats, sessionId);
  }

  async cleanupAllSeatHolds() {
    return await this.seatHoldService.cleanupAllSeatHolds();
  }

  async fixSeatHoldFlightIds() {
    return await this.seatHoldService.fixSeatHoldFlightIds();
  }

  async validateBaggage(flightId: string, options: BaggageSelectionDto[]): Promise<boolean> {
    return await this.baggageService.validateBaggage(flightId, options);
  }

  async setCache(key: string, value: any): Promise<void> {
    await this.cacheService.set(key, value);
  }

  async getCache(key: string): Promise<any> {
    return await this.cacheService.get(key);
  }

  async getAvailableSeats(flightId: string): Promise<number> {
    if (!Types.ObjectId.isValid(flightId)) {
      throw new HttpException('Invalid flight ID format', HttpStatus.BAD_REQUEST);
    }

    const flight = await this.flightModel
      .findById(flightId)
      .select('seatsAvailable version')
      .lean();

    if (!flight) {
      throw new HttpException('Flight not found', HttpStatus.NOT_FOUND);
    }

    return flight.seatsAvailable;
  }

  async findOne(id: string): Promise<Flight> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const flight = await this.flightModel.findById(id).lean().exec();
        if (flight) return flight;
      }

      const flight = await this.flightModel.findOne({ offerId: id }).lean().exec();
      if (!flight) {
        throw new HttpException(`Flight with ID ${id} not found`, HttpStatus.NOT_FOUND);
      }

      return flight;
    } catch (error) {
      this.logger.error(`Error finding flight ${id}: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Error finding flight', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getFlightPricing(flightId: string): Promise<{ basePrice: number; currency: string }> {
    const flight = await this.findOne(flightId);
    return {
      basePrice: Number(flight.price),
      currency: flight.currency || 'USD',
    };
  }
}