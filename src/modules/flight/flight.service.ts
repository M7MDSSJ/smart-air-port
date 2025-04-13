// src/flight/flight.service.ts
import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AmadeusService } from './amadeus.service';
import { QueryFlightDto, TripType } from './dto/query-flight.dto';
import { FlightOfferSearchResponse } from './dto/amadeus-flight-offer.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Flight } from './schemas/flight.schema';

// Static mapping of IATA codes to airline names
const AIRLINE_MAP: { [key: string]: string } = {
  F9: 'Frontier Airlines',
  AA: 'American Airlines',
  DL: 'Delta Air Lines',
  UA: 'United Airlines',
  // Add more airlines as needed
};

// Define and export the type for the formatted flight response
export interface FormattedFlight {
  offerId: string;
  flightNumber: string;
  airline: string;
  airlineName: string; // Added
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  status: string;
  aircraft?: string;
  price: number;
  currency: string;
  totalPrice: number;
  seatsAvailable: number;
  stops: Array<{
    airport: string;
    arrivalTime: Date;
    departureTime: Date;
    flightNumber: string;
    carrierCode: string;
    layoverDuration?: string; // Added
    layoverDurationInMinutes?: number; // Added
  }>;
  lastTicketingDate: string;
  baggageOptions: {
    included: string;
    options: Array<{ weightInKg: number; price: number }>;
  };
  _id: string;
  duration: string;
  durationInMinutes: number;
  numberOfStops: number;
  isRecommended: boolean;
  departureHour: number;
}

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) { }

  async searchAvailableFlights(query: QueryFlightDto): Promise<{ paginatedFlights: FormattedFlight[]; total: number }> {
    const {
      tripType,
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate,
      adults,
      children = 0,
      infants = 0,
      cabinClass,
      multiCityLegs,
    } = query;

    // Validate required parameters
    if (!departureAirport || !arrivalAirport || !departureDate || !tripType || !adults || !cabinClass) {
      throw new HttpException(
        'departureAirport, arrivalAirport, departureDate, tripType, adults, and cabinClass are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.RoundTrip && !returnDate) {
      throw new HttpException('returnDate is required for round-trip', HttpStatus.BAD_REQUEST);
    }
    if (tripType === TripType.MultiCity && (!multiCityLegs || multiCityLegs.length === 0)) {
      throw new HttpException('multiCityLegs are required for multi-city', HttpStatus.BAD_REQUEST);
    }

    // Build cache key
    const cacheKey = `flight:${tripType}:${departureAirport}:${arrivalAirport}:${departureDate}:${returnDate || 'none'}:${adults}:${children}:${infants}:${cabinClass}`;

    // Check cache
    const cachedResult = await this.cacheManager.get<{ paginatedFlights: FormattedFlight[]; total: number }>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }

    // Check database (for one-way only as an example; extend as needed)
    let flights: Flight[] = [];
    if (tripType === TripType.OneWay) {
      const dbFlights = await this.flightModel
        .find({
          departureAirport,
          arrivalAirport,
          departureTime: {
            $gte: new Date(departureDate),
            $lt: new Date(new Date(departureDate).setDate(new Date(departureDate).getDate() + 1)),
          },
        })
        .exec();
      if (dbFlights.length > 0) {
        this.logger.log(`Database hit: Found ${dbFlights.length} flights`);
        flights = dbFlights;
      }
    }

    // Fetch from Amadeus if no flights found in database
    if (flights.length === 0) {
      let amadeusFlights: FlightOfferSearchResponse = [];
      if (tripType === TripType.OneWay) {
        amadeusFlights = await this.amadeusService.searchFlightOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          adults,
          children,
          infants,
          cabinClass,
        );
      } else if (tripType === TripType.RoundTrip) {
        amadeusFlights = await this.amadeusService.searchRoundTripOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          returnDate!,
          adults,
          children,
          infants,
          cabinClass,
        );
      } else if (tripType === TripType.MultiCity) {
        amadeusFlights = await this.amadeusService.searchMultiCityOffers(
          multiCityLegs!,
          adults,
          children,
          infants,
          cabinClass,
        );
      }

      // Filter flights to ensure arrivalAirport matches the query
      amadeusFlights = amadeusFlights.filter((flight) => {
        const segments = flight.itineraries[0].segments;
        const finalArrivalAirport = segments[segments.length - 1].arrival.iataCode;
        return finalArrivalAirport === arrivalAirport;
      });

      flights = await this.flightModel.create(
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
            stops: segments.length > 1 ? segments.slice(0, -1).map((seg, index) => ({
              airport: seg.arrival.iataCode,
              arrivalTime: new Date(seg.arrival.at),
              departureTime: new Date(segments[index + 1].departure.at),
              flightNumber: `${segments[index + 1].carrierCode}${segments[index + 1].number}`,
              carrierCode: segments[index + 1].carrierCode,
            })) : [],
            lastTicketingDate: flight.lastTicketingDate,
            baggageOptions: this.parseBaggageOptions(flight),
          };
        }),
      );

      this.logger.log(`Stored ${flights.length} flights in database`);
    }

    // Format the flights to include duration and isRecommended
    const result = this.formatFlightResponse(flights, query);
    await this.cacheManager.set(cacheKey, result, 3600);
    this.logger.log(`Cached flight offers for ${cacheKey}`);

    // Notify admin
    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      'New Flight Search',
      `Searched flights (${tripType}) from ${departureAirport} to ${arrivalAirport} on ${departureDate}`,
    );

    return result;
  }

  private parseBaggageOptions(flight: any): any {
    return {
      included: '1 checked bag',
      options: [
        { weightInKg: 15, price: 20 },
        { weightInKg: 23, price: 40 },
      ],
    };
  }
  private formatFlightResponse(flights: Flight[], query: QueryFlightDto): { paginatedFlights: FormattedFlight[]; total: number } {
    const {
      adults,
      children = 0,
      infants = 0,
      minPrice,
      maxPrice,
      airline,
      maxStops,
      departureTimeRange,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = query;

    // Calculate total passengers for totalPrice
    const totalPassengers = adults + children + infants;

    let formattedFlights: FormattedFlight[] = flights.map(flight => {
      const flightObj = flight.toObject ? flight.toObject() : flight;
      const departure = new Date(flight.departureTime);
      const arrival = new Date(flight.arrivalTime);
      const durationMs = arrival.getTime() - departure.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const totalMinutes = hours * 60 + minutes;
      const isRecommended = flight.price < 350 && flight.stops.length === 0 && flight.baggageOptions.included !== '0 checked bags';

      // Calculate layover duration for each stop and clean up Mongoose metadata
      const stops = (flight.stops || []).map(stop => {
        const layoverMs = new Date(stop.departureTime).getTime() - new Date(stop.arrivalTime).getTime();
        const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
        const layoverMinutes = Math.floor((layoverMs % (1000 * 60 * 60)) / (1000 * 60));
        const layoverDuration = layoverHours || layoverMinutes ? `${layoverHours}h ${layoverMinutes}m` : undefined;
        const layoverDurationInMinutes = (layoverHours * 60) + layoverMinutes;

        // Explicitly return only the desired fields to exclude Mongoose metadata
        return {
          airport: stop.airport,
          arrivalTime: stop.arrivalTime,
          departureTime: stop.departureTime,
          flightNumber: stop.flightNumber,
          carrierCode: stop.carrierCode,
          layoverDuration,
          layoverDurationInMinutes,
        };
      });

      // Exclude unnecessary fields and add new fields
      const { __v, createdAt, updatedAt, ...rest } = flightObj;

      return {
        ...rest,
        duration: `${hours}h ${minutes}m`,
        durationInMinutes: totalMinutes,
        stops,
        numberOfStops: flight.stops?.length || 0,
        isRecommended: isRecommended,
        departureHour: departure.getUTCHours(),
        price: flight.price,
        totalPrice: flight.price * totalPassengers,
        currency: 'USD',
        airlineName: AIRLINE_MAP[flight.airline] || flight.airline,
      };
    });

    // Apply Filters
    if (minPrice !== undefined) {
      formattedFlights = formattedFlights.filter(flight => flight.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      formattedFlights = formattedFlights.filter(flight => flight.price <= maxPrice);
    }

    if (airline) {
      formattedFlights = formattedFlights.filter(flight => flight.airline === airline);
    }

    if (maxStops !== undefined) {
      formattedFlights = formattedFlights.filter(flight => flight.numberOfStops <= maxStops);
    }

    if (departureTimeRange) {
      formattedFlights = formattedFlights.filter(flight => {
        const hour = flight.departureHour;
        if (departureTimeRange === 'morning') return hour >= 0 && hour < 12;
        if (departureTimeRange === 'afternoon') return hour >= 12 && hour < 18;
        if (departureTimeRange === 'evening') return hour >= 18 && hour < 21;
        if (departureTimeRange === 'night') return hour >= 21 || hour < 0;
        return true;
      });
    }

    // Apply Sorting
    if (sortBy) {
      formattedFlights.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'price' && a.price !== undefined && b.price !== undefined) {
          comparison = a.price - b.price;
        } else if (sortBy === 'duration') {
          comparison = a.durationInMinutes - b.durationInMinutes;
        } else if (sortBy === 'stops') {
          comparison = a.numberOfStops - b.numberOfStops;
        } else if (sortBy === 'totalPrice') {
          comparison = a.totalPrice - b.totalPrice;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Calculate total count after filtering
    const total = formattedFlights.length;

    // Apply Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFlights = formattedFlights.slice(startIndex, endIndex);

    return { paginatedFlights, total };
  }
}