// flight.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AmadeusService } from './amadeus.service';
import { QueryFlightDto } from './dto/query-flight.dto';
import { FlightOfferSearchResponse } from './dto/amadeus-flight-offer.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Flight } from './schemas/flight.schema';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async searchAvailableFlights(query: QueryFlightDto): Promise<Flight[]> {
    const { departureAirport, arrivalAirport, departureDate, adults } = query;

    if (!departureAirport || !arrivalAirport || !departureDate) {
      throw new Error('departureAirport, arrivalAirport, and departureDate are required');
    }

    const cacheKey = `flight:${departureAirport}:${arrivalAirport}:${departureDate}:${adults || 1}`;

    // Check cache
    const cachedResult = await this.cacheManager.get<Flight[]>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }

    // Check database
    const dbFlights = await this.flightModel
      .find({
        departureAirport,
        arrivalAirport,
        departureTime: { $gte: new Date(departureDate), $lt: new Date(departureDate).setDate(new Date(departureDate).getDate() + 1) },
      })
      .exec();

    if (dbFlights.length > 0) {
      this.logger.log(`Database hit: Found ${dbFlights.length} flights`);
      await this.cacheManager.set(cacheKey, dbFlights, 3600);
      return dbFlights;
    }

    // Fetch from Amadeus
    const amadeusFlights = await this.amadeusService.searchFlightOffers(
      departureAirport,
      arrivalAirport,
      departureDate,
      adults || 1,
    );

    // Transform and store
    const flightDocs = await this.flightModel.create(
      amadeusFlights.map((flight) => {
        const segments = flight.itineraries[0].segments;
        return {
          offerId: flight.id,
          flightNumber: `${segments[0].carrierCode}${segments[0].number}`,
          airline: segments[0].carrierCode,
          departureAirport: segments[0].departure.iataCode,
          arrivalAirport: segments[segments.length - 1].arrival.iataCode,
          departureTime: new Date(segments[0].departure.at),
          arrivalTime: new Date(segments[segments.length - 1].arrival.at),
          status: 'Scheduled',
          aircraft: segments[0].aircraft?.code,
          price: parseFloat(flight.price.total),
          seatsAvailable: flight.numberOfBookableSeats,
          stops: segments.slice(1).map((seg) => ({
            airport: seg.arrival.iataCode,
            arrivalTime: new Date(seg.arrival.at),
            departureTime: new Date(seg.departure.at),
            flightNumber: `${seg.carrierCode}${seg.number}`,
            carrierCode: seg.carrierCode,
          })),
          lastTicketingDate: flight.lastTicketingDate,
        };
      })
    );

    this.logger.log(`Stored ${flightDocs.length} flights in database`);

    // Cache the result
    await this.cacheManager.set(cacheKey, flightDocs, 3600);
    this.logger.log(`Cached flight offers for ${cacheKey}`);

    // Notify admin
    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      'New Flight Search',
      `Searched flights from ${departureAirport} to ${arrivalAirport} on ${departureDate}`,
    );

    return flightDocs;
  }
}