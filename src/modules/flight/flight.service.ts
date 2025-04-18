import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AmadeusService } from './amadeus.service';
import { DepartureTimeRange, QueryFlightDto, SortBy, SortOrder, TripType } from './dto/query-flight.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { FlightStatusService } from './flight-status.service';
import axios from 'axios';
import { Model, Types, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { SeatHold, Flight } from './schemas/flight.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AIRLINE_MAP, AIRPORT_MAP, AIRPORT_TIMEZONES, EXCHANGE_RATES, FormattedFlight} from './interfaces/flight-data.interface';
import { IFlightRepository } from './repositories/flight.repository.interface';
import { format } from 'date-fns';

@Injectable()
export class FlightService {
  // In-memory cache for flight search results
  private readonly flightCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache lifetime
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly flightStatusService: FlightStatusService,
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
    @InjectModel('SeatHold') private readonly seatHoldModel: Model<SeatHold>,
    @Inject('FLIGHT_REPOSITORY') private readonly flightRepository: IFlightRepository
  ) {}

  private formatFlightForResponse(flight: any, language: string = 'en'): FormattedFlight {
    return {
      _id: flight._id.toString(),
      offerId: flight.offerId,
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      airlineName: flight.airlineName || AIRLINE_MAP[flight.airline]?.[language] || flight.airline,
      departureAirport: flight.departureAirport,
      departureAirportName: flight.departureAirportName || AIRPORT_MAP[flight.departureAirport]?.[language] || flight.departureAirport,
      departureTime: flight.departureTime,
      departureTimeLocal: flight.departureTime ? format(new Date(flight.departureTime), 'HH:mm') : '',
      arrivalAirport: flight.arrivalAirport,
      arrivalAirportName: flight.arrivalAirportName || AIRPORT_MAP[flight.arrivalAirport]?.[language] || flight.arrivalAirport,
      arrivalTime: flight.arrivalTime,
      arrivalTimeLocal: flight.arrivalTime ? format(new Date(flight.arrivalTime), 'HH:mm') : '',
      status: flight.status,
      aircraft: flight.aircraft,
      price: flight.price,
      totalPrice: flight.totalPrice,
      currency: flight.currency,
      seatsAvailable: flight.seatsAvailable,
      stops: flight.stops,
      lastTicketingDate: flight.lastTicketingDate,
      baggageOptions: flight.baggageOptions,
      duration: flight.duration,
      durationInMinutes: flight.durationInMinutes,
      numberOfStops: flight.numberOfStops,
      isRecommended: flight.isRecommended,
      departureHour: flight.departureHour
    };
  }

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
      language = 'en',
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      airline,
      maxStops,
      departureTimeRange,
      sortBy,
      sortOrder,
    } = query;

    const totalPassengers = adults + children + infants;

    if (!departureAirport || !arrivalAirport || !departureDate || !tripType || !adults || !cabinClass) {
      throw new HttpException(
        await this.i18n.t('errors.missingRequiredFields', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.RoundTrip && !returnDate) {
      throw new HttpException(
        await this.i18n.t('errors.returnDateRequired', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.MultiCity && (!multiCityLegs || multiCityLegs.length === 0)) {
      throw new HttpException(
        await this.i18n.t('errors.multiCityLegsRequired', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create a more specific cache key that includes filter parameters
    const cacheKey = `flight:${tripType}:${departureAirport}:${arrivalAirport}:${departureDate}:${returnDate || 'none'}:${adults}:${children}:${infants}:${cabinClass}:${minPrice || 0}:${maxPrice || 9999999}:${airline || 'any'}:${maxStops !== undefined ? maxStops : 'any'}:${departureTimeRange || 'any'}:${sortBy || 'price'}:${sortOrder || 'asc'}`;
    
    // Check in-memory cache first (faster than distributed cache)
    const memoryCachedResult = this.flightCache.get(cacheKey);
    if (memoryCachedResult && (Date.now() - memoryCachedResult.timestamp) < this.CACHE_TTL) {
      this.logger.log(`Memory cache hit for ${cacheKey}`);
      return memoryCachedResult.data;
    }
    
    // Then check distributed cache
    const distributedCachedResult = await this.cacheManager.get<{ paginatedFlights: FormattedFlight[]; total: number }>(cacheKey);
    if (distributedCachedResult) {
      this.logger.log(`Distributed cache hit for ${cacheKey}`);
      // Update memory cache
      this.flightCache.set(cacheKey, { data: distributedCachedResult, timestamp: Date.now() });
      return distributedCachedResult;
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    // Validate holdDuration to ensure it's a number
    const rawHoldDuration = this.configService.get<number>('SEAT_HOLD_DURATION', 15 * 60 * 1000);
    const holdDuration = typeof rawHoldDuration === 'number' && !isNaN(rawHoldDuration) ? rawHoldDuration : 15 * 60 * 1000;
    if (typeof rawHoldDuration !== 'number' || isNaN(rawHoldDuration)) {
      this.logger.warn(`Invalid SEAT_HOLD_DURATION value: ${rawHoldDuration}. Falling back to default: ${holdDuration}ms`);
    }

    let rawFlights: any[] = [];

    try {
      if (tripType === TripType.OneWay) {
        rawFlights = await this.amadeusService.searchFlightOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          adults,
          children,
          infants,
          cabinClass,
          undefined,
          limit,
        );
      } else if (tripType === TripType.RoundTrip) {
        if (!returnDate) {
          throw new HttpException(
            await this.i18n.t('errors.returnDateRequired', { lang: language }),
            HttpStatus.BAD_REQUEST,
          );
        }
        const depDate = new Date(departureDate);
        const retDate = new Date(returnDate);
        if (retDate <= depDate) {
          throw new HttpException(
            await this.i18n.t('errors.departureBeforeArrival', { lang: language }),
            HttpStatus.BAD_REQUEST,
          );
        }
        rawFlights = await this.amadeusService.searchFlightOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          adults,
          children,
          infants,
          cabinClass,
          returnDate,
          limit,
        );
      } else if (tripType === TripType.MultiCity) {
        if (!multiCityLegs || multiCityLegs.length === 0) {
          throw new HttpException(
            await this.i18n.t('errors.multiCityLegsRequired', { lang: language }),
            HttpStatus.BAD_REQUEST,
          );
        }
        for (let i = 1; i < multiCityLegs.length; i++) {
          const prevDate = new Date(multiCityLegs[i - 1].departureDate);
          const currentDate = new Date(multiCityLegs[i].departureDate);
          if (currentDate <= prevDate) {
            throw new HttpException(
              await this.i18n.t('errors.multiCityLegDateOrder', { lang: language, args: { leg: i + 1 } }),
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        rawFlights = await this.amadeusService.searchMultiCityFlights(
          multiCityLegs!.map(leg => ({
            origin: leg.departureAirport,
            destination: leg.arrivalAirport,
            departureDate: leg.departureDate,
          })),
          adults,
          children,
          infants,
          cabinClass,
          limit,
        );
      }
      this.logger.log(`Fetched ${rawFlights.length} flights from Amadeus API`);
    } catch (error) {
      throw new HttpException(
        await this.i18n.t('errors.amadeusFetchFailed', { lang: language }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (rawFlights.length === 0) {
      this.logger.log('No flights found from Amadeus API for this route and date');
      return { paginatedFlights: [], total: 0 };
    }

    const formattedFlights = await this.formatFlightResponse(rawFlights, query);

    // Don't create seat holds during search - this is a performance bottleneck
    // Only assign sessionId to track the search session
    for (const flight of formattedFlights) {
      flight.sessionId = sessionId;
    }
    
    // Log performance metrics
    this.logger.log(`Processed ${formattedFlights.length} flights in search`);
    
    const totalFlights = formattedFlights.length;
    let filteredFlights = [...formattedFlights];
    const startFilterTime = Date.now();

    // Apply filters in a single pass for better performance
    filteredFlights = filteredFlights.filter(flight => {
      // Price range filter
      if (minPrice !== undefined && flight.price < minPrice) return false;
      if (maxPrice !== undefined && flight.price > maxPrice) return false;
      
      // Airline filter
      if (airline && flight.airline !== airline) return false;
      
      // Stops filter
      if (maxStops !== undefined && flight.numberOfStops > maxStops) return false;
      
      // Departure time range filter
      if (departureTimeRange) {
        const hour = flight.departureHour;
        switch (departureTimeRange) {
          case DepartureTimeRange.Morning: 
            if (!(hour >= 6 && hour < 12)) return false;
            break;
          case DepartureTimeRange.Afternoon: 
            if (!(hour >= 12 && hour < 18)) return false;
            break;
          case DepartureTimeRange.Evening: 
            if (!(hour >= 18 && hour < 21)) return false;
            break;
          case DepartureTimeRange.Night: 
            if (!(hour >= 21 || hour < 6)) return false;
            break;
        }
      }
      
      // If we made it here, the flight passed all filters
      return true;
    });
    
    this.logger.log(`Applied filters in ${Date.now() - startFilterTime}ms`);
    const effectiveSortBy = sortBy || SortBy.Price;
    const effectiveSortOrder = sortOrder || SortOrder.Asc;
    filteredFlights.sort((a, b) => {
      let comparison = 0;
      if (effectiveSortBy === SortBy.Price) {
        comparison = a.price - b.price;
      } else if (effectiveSortBy === SortBy.Duration) {
        comparison = a.durationInMinutes - b.durationInMinutes;
      } else if (effectiveSortBy === SortBy.Stops) {
        comparison = a.numberOfStops - b.numberOfStops;
      } else if (effectiveSortBy === 'totalPrice') {
        comparison = a.totalPrice - b.totalPrice;
      }
      return effectiveSortOrder === 'desc' ? -comparison : comparison;
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFlights = filteredFlights.slice(startIndex, endIndex);

    // Persist and format flights
    const persistedFlights = await Promise.all(
      paginatedFlights.map(async (flight) => {
        // Avoid updating immutable _id field
        const { _id, ...flightData } = flight;
        const dbFlight = await this.flightModel.findOneAndUpdate(
          { offerId: flight.offerId },
          { $set: flightData },
          { upsert: true, new: true, lean: true }
        );
        return this.formatFlightForResponse(dbFlight, query.language);
      })
    );

    // Prepare result object
    const result = { paginatedFlights: persistedFlights, total: filteredFlights.length };
    
    // Update both caches
    this.flightCache.set(cacheKey, { data: result, timestamp: Date.now() });
    await this.cacheManager.set(cacheKey, result, 600); // 10 minutes TTL
    
    // Send notification email asynchronously to avoid blocking the response
    setTimeout(() => {
      this.emailService.sendImportantEmail(
        this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
        this.i18n.t('email.newFlightSearchSubject', { lang: language }),
        this.i18n.t('email.newFlightSearchBody', {
          lang: language,
          args: { tripType, departureAirport, arrivalAirport, departureDate },
        })
      ).catch(err => this.logger.error(`Failed to send notification email: ${err.message}`));
    }, 0);

    return result;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredHolds() {
    try {
      const now = new Date();
      
      // Get all expired holds in one query
      const expiredHolds = await this.seatHoldModel.find({ expiresAt: { $lt: now } });
      
      if (expiredHolds.length === 0) {
        this.logger.log('No expired seat holds to clean up');
        return;
      }
      
      let successCount = 0;
      
      // Process each expired hold
      for (const hold of expiredHolds) {
        try {
          // First try finding the flight using the proper approach
          let flight;
          try {
            // First try to find it directly by ID if it's a valid ObjectId
            if (Types.ObjectId.isValid(hold.flightId)) {
              flight = await this.flightModel.findById(hold.flightId);
            }
            
            // If that didn't work, try searching by offerId
            if (!flight) {
              flight = await this.flightModel.findOne({ offerId: hold.flightId.toString() });
            }
          } catch (findError) {
            // Handle case where flightId is not a valid ObjectId
            flight = await this.flightModel.findOne({ offerId: hold.flightId.toString() });
          }
          
          // If we found the flight, update its available seats
          if (flight) {
            await this.flightModel.updateOne(
              { _id: flight._id },
              { $inc: { seatsAvailable: hold.seats, version: 1 } }
            );
            this.logger.log(`Released ${hold.seats} seats for flight ${flight.offerId}`);
            successCount++;
          }
          
          // Always remove the hold, even if flight not found
          await this.seatHoldModel.deleteOne({ _id: hold._id });
        } catch (err) {
          this.logger.error(`Failed to process expired hold ${hold._id}: ${err.message}`);
        }
      }
      
      this.logger.log(`Cleaned up ${expiredHolds.length} expired seat holds, successfully processed ${successCount}`);
    } catch (error) {
      this.logger.error(`Error cleaning up expired holds: ${error.message}`);
    }
  }
  
  /**
   * One-time cleanup for all seat holds - use with caution
   * This is useful for clearing out problematic seat holds
   */
  async cleanupAllSeatHolds() {
    try {
      const result = await this.seatHoldModel.deleteMany({});
      this.logger.log(`Cleaned up all ${result.deletedCount} seat holds`);
      return { success: true, count: result.deletedCount };
    } catch (error) {
      this.logger.error(`Failed to clean up all seat holds: ${error.message}`);
      throw new HttpException('Failed to clean up seat holds', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createSeatHold(flightId: string, seats: number, sessionId: string) {
    const startTime = Date.now();
    
    try {
      // Performance improvement: Use findOneAndUpdate in a single atomic operation
      // This combines the find, check, and update operations into one database call
      const flight = await this.flightModel.findOneAndUpdate(
        { 
          offerId: flightId, 
          seatsAvailable: { $gte: seats } // Only update if enough seats are available
        },
        { 
          $inc: { seatsAvailable: -seats, version: 1 } 
        },
        { 
          new: false // Return the document before update
        }
      );
      
      // Flight not found or not enough seats
      if (!flight) {
        // Find flight to determine the exact error
        const existingFlight = await this.flightModel.findOne({ offerId: flightId });
        
        if (!existingFlight) {
          this.logger.error(`Flight not found: ${flightId}`);
          throw new HttpException('Flight not found', HttpStatus.NOT_FOUND);
        } else {
          this.logger.error(`Not enough seats available. Requested: ${seats}, Available: ${existingFlight.seatsAvailable}`);
          throw new HttpException('Not enough seats available', HttpStatus.BAD_REQUEST);
        }
      }
      
      // Calculate expiry date (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      // Create seat hold
      const seatHold = new this.seatHoldModel({
        flightId: flight._id,
        seats,
        sessionId,
        expiresAt,
      });
      
      await seatHold.save();
      this.logger.log(`Created seat hold for flight ${flightId}, ${seats} seats, session ${sessionId} in ${Date.now() - startTime}ms`);
      
      return {
        holdId: seatHold._id,
        flightId,
        seats,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error creating seat hold: ${error.message}`);
      throw new HttpException('Failed to create seat hold', HttpStatus.INTERNAL_SERVER_ERROR);
    }
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

  private parseBaggageOptions(flight: any): { included: string; options: Array<{ weightInKg: number; price: number }> } {
    const includedBags = flight?.price?.includedCheckedBags?.quantity || 0;
    this.logger.log(`Parsing baggage for flight: includedBags=${includedBags}`);

    const baseOptions = [
      { weightInKg: 15, price: this.configService.get<number>('BAGGAGE_15KG_PRICE', 20) },
      { weightInKg: 23, price: this.configService.get<number>('BAGGAGE_23KG_PRICE', 40) },
    ];

    const options = baseOptions.map(option => {
      let price = option.price;
      const segments = flight?.itineraries?.[0]?.segments || [];
      const departureAirport = segments[0]?.departure?.iataCode;
      const arrivalAirport = segments[segments.length - 1]?.arrival?.iataCode;
      if (departureAirport === 'CAI') {
        price = price * EXCHANGE_RATES['USD_TO_EGP'];
      } else if (arrivalAirport === 'JED') {
        price = price * EXCHANGE_RATES['USD_TO_SAR'];
      }
      return { weightInKg: option.weightInKg, price: parseFloat(price.toFixed(2)) };
    });

    return {
      included: `${includedBags}`,
      options,
    };
  }

  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;
    
    const cacheKey = `exchange:${fromCurrency}:${toCurrency}`;
    const cachedRate = await this.cacheManager.get<number>(cacheKey);
    if (cachedRate) {
      this.logger.log(`Cache hit for exchange rate ${fromCurrency} to ${toCurrency}`);
      return cachedRate;
    }

    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      const rate = response.data.rates[toCurrency] || 1;
      await this.cacheManager.set(cacheKey, rate, 86400);
      return rate;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch exchange rate for ${fromCurrency} to ${toCurrency}, falling back to static rate: ${(error as Error).message}`
      );
      const fallbackRate = EXCHANGE_RATES[`${fromCurrency}_TO_${toCurrency}`] || 1;
      if (fallbackRate === 1 && fromCurrency !== toCurrency) {
        this.logger.error(
          `No exchange rate available for ${fromCurrency} to ${toCurrency}, using 1:1 rate which may be incorrect`
        );
      }
      return fallbackRate;
    }
  }
  
  /**
   * Find a flight by its ID
   */
  async findOne(id: string): Promise<Flight> {
    try {
      // Try to interpret id as MongoDB ObjectId first
      if (Types.ObjectId.isValid(id)) {
        const flight = await this.flightModel.findById(id).lean().exec();
        if (flight) return flight;
      }
      
      // If not found by _id, try by offerId
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
  
  /**
   * Update available seats for a flight using optimistic concurrency control
   */
  async updateSeats(params: { flightId: string; seatDelta: number; expectedVersion: number }): Promise<Flight> {
    const { flightId, seatDelta, expectedVersion } = params;
    
    try {
      // Find the flight first to validate it exists
      const flight = await this.findOne(flightId);
      
      // Perform optimistic concurrency control
      if (flight.version !== expectedVersion) {
        throw new HttpException(
          'Flight was modified by another operation. Please retry.',
          HttpStatus.CONFLICT
        );
      }
      
      // Calculate new seat availability
      const newSeatCount = flight.seatsAvailable + seatDelta;
      
      // Validate there are enough seats available if reducing
      if (seatDelta < 0 && newSeatCount < 0) {
        throw new HttpException(
          `Not enough seats available. Requested ${Math.abs(seatDelta)}, but only ${flight.seatsAvailable} available.`,
          HttpStatus.BAD_REQUEST
        );
      }
      
      // Update the flight with new seat count and increment version
      const updatedFlight = await this.flightModel.findOneAndUpdate(
        { _id: flight._id, version: expectedVersion },
        { 
          $inc: { version: 1, seatsAvailable: seatDelta },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      ).lean().exec();
      
      if (!updatedFlight) {
        throw new HttpException(
          'Failed to update flight. It may have been modified by another operation.',
          HttpStatus.CONFLICT
        );
      }
      
      return updatedFlight;
    } catch (error) {
      this.logger.error(`Error updating seats for flight ${flightId}: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Error updating flight seats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  async formatFlightResponse(flights: any[], query: QueryFlightDto): Promise<FormattedFlight[]> {
    const {
      adults,
      children = 0,
      infants = 0,
      departureAirport,
      arrivalAirport,
      departureDate,
      language = 'en',
    } = query;
    const totalPassengers = adults + children + infants;

    const usdToEgpRate = departureAirport === 'CAI' ? await this.getExchangeRate('USD', 'EGP') : 1;
    const usdToSarRate = arrivalAirport === 'JED' ? await this.getExchangeRate('USD', 'SAR') : 1;
    const { tripType } = query;
    const currentDate = new Date().toISOString().split('T')[0];

    const filteredFlights = flights.filter(flight => {
      const segments = flight.itineraries?.[0]?.segments || [];
      const firstSegment = segments[0] || {};
      const lastSegment = segments[segments.length - 1] || {};
      const flightDepartureDate = firstSegment.departure?.at ? new Date(firstSegment.departure.at).toISOString().split('T')[0] : '';
      const flightArrivalDate = lastSegment.arrival?.at ? new Date(lastSegment.arrival.at).toISOString().split('T')[0] : '';
      const lastTicketingDate = flight.lastTicketingDate ? new Date(flight.lastTicketingDate).toISOString().split('T')[0] : '';
      const seatsAvailable = flight.numberOfBookableSeats || 0;
      const sameDayArrival = tripType === TripType.OneWay ? flightArrivalDate === departureDate : true;
      return (
        flightDepartureDate === departureDate &&
        sameDayArrival &&
        lastTicketingDate >= currentDate &&
        seatsAvailable >= totalPassengers
      );
    });

    return Promise.all(
      filteredFlights.map(async (flight) => {
        const segments = flight.itineraries?.[0]?.segments || [];
        const firstSegment = segments[0] || {};
        const lastSegment = segments[segments.length - 1] || {};

        const departure = firstSegment.departure?.at ? new Date(firstSegment.departure.at) : new Date();
        const arrival = lastSegment.arrival?.at ? new Date(lastSegment.arrival.at) : new Date();
        const bookable = flight.lastTicketingDate ? new Date(flight.lastTicketingDate) >= new Date() : false;
        const durationMs = arrival.getTime() - departure.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const totalMinutes = hours * 60 + minutes;

        const isRecommended = parseFloat(flight.price.total) < 350 && segments.length === 1 && (flight.price.includedCheckedBags?.quantity || 0) > 0;

        const departureTimeZone = AIRPORT_TIMEZONES[firstSegment.departure?.iataCode] || 'UTC';
        const arrivalTimeZone = AIRPORT_TIMEZONES[lastSegment.arrival?.iataCode] || 'UTC';
        const departureTimeLocal = departure.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
          timeZone: departureTimeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const arrivalTimeLocal = arrival.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
          timeZone: arrivalTimeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        let price = parseFloat(flight.price.total);
        let totalPrice = price * totalPassengers;
        let currency = flight.price.currency || 'USD';
        if (departureAirport === 'CAI') {
          price = price * usdToEgpRate;
          totalPrice = price * totalPassengers;
          currency = 'EGP';
        } else if (arrivalAirport === 'JED') {
          price = price * usdToSarRate;
          totalPrice = price * totalPassengers;
          currency = 'SAR';
        }
        const formattedPrice = price.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const formattedTotalPrice = totalPrice.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        price = parseFloat(formattedPrice.replace(/,/g, '')) || 0;
        totalPrice = parseFloat(formattedTotalPrice.replace(/,/g, '')) || 0;

        const stops = segments.length > 1 ? segments.slice(0, -1).map((segment: any, index: number) => {
          const nextSegment = segments[index + 1];
          const layoverMs = nextSegment.departure?.at && segment.arrival?.at
            ? new Date(nextSegment.departure.at).getTime() - new Date(segment.arrival.at).getTime()
            : 0;
          const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
          const layoverMinutes = Math.floor((layoverMs % (1000 * 60 * 60)) / (1000 * 60));
          let layoverDuration: string | undefined;
          try {
            layoverDuration = layoverHours || layoverMinutes
              ? this.i18n.t('duration.format', {
                  lang: language,
                  args: { hours: layoverHours, minutes: layoverMinutes },
                })
              : undefined;
          } catch (error) {
            this.logger.error(`Failed to translate layover duration: ${(error as Error).message}`);
            layoverDuration = `${layoverHours}h ${layoverMinutes}m`;
          }
          const layoverDurationInMinutes = (layoverHours * 60) + layoverMinutes;

          return {
            airport: segment.arrival?.iataCode || '',
            bookable: true,
            airportName: segment.arrival?.iataCode && AIRPORT_MAP[segment.arrival.iataCode]
              ? AIRPORT_MAP[segment.arrival.iataCode][language === 'ar' ? 'ar' : 'en']
              : segment.arrival?.iataCode || '',
            arrivalTime: segment.arrival?.at ? new Date(segment.arrival.at) : new Date(),
            departureTime: nextSegment.departure?.at ? new Date(nextSegment.departure.at) : new Date(),
            flightNumber: segment.number || `${segment.carrierCode}${segment.number || ''}`,
            carrierCode: segment.carrierCode || '',
            layoverDuration,
            layoverDurationInMinutes,
          };
        }) : [];

        const statusText = await this.flightStatusService.getFlightStatus(
          firstSegment.number || `${firstSegment.carrierCode || ''}${firstSegment.number || ''}`,
          firstSegment.departure?.at ? new Date(firstSegment.departure.at) : new Date(),
        ) || 'Unknown';

        const durationText = `${hours}h ${minutes}m`;

        const airlineName = firstSegment.carrierCode && AIRLINE_MAP[firstSegment.carrierCode]
          ? AIRLINE_MAP[firstSegment.carrierCode][language === 'ar' ? 'ar' : 'en']
          : firstSegment.carrierCode || 'Unknown';

        return {
          _id: flight._id ? flight._id.toString() : new Types.ObjectId().toString(),
          offerId: flight.id || '',
          flightNumber: firstSegment.number || `${firstSegment.carrierCode || ''}${firstSegment.number || ''}`,
          airline: firstSegment.carrierCode || '',
          airlineName,
          departureAirport: firstSegment.departure?.iataCode || '',
          departureAirportName: firstSegment.departure?.iataCode && AIRPORT_MAP[firstSegment.departure.iataCode]
            ? AIRPORT_MAP[firstSegment.departure.iataCode][language === 'ar' ? 'ar' : 'en']
            : firstSegment.departure?.iataCode || '',
          departureTime: departure,
          departureTimeLocal,
          arrivalAirport: lastSegment.arrival?.iataCode || '',
          arrivalAirportName: lastSegment.arrival?.iataCode && AIRPORT_MAP[lastSegment.arrival.iataCode]
            ? AIRPORT_MAP[lastSegment.arrival.iataCode][language === 'ar' ? 'ar' : 'en']
            : lastSegment.arrival?.iataCode || '',
          arrivalTime: arrival,
          arrivalTimeLocal,
          status: statusText,
          aircraft: firstSegment.aircraft?.code || undefined,
          price,
          totalPrice,
          currency,
          seatsAvailable: flight.numberOfBookableSeats || 0,
          stops,
          lastTicketingDate: flight.lastTicketingDate || '',
          baggageOptions: this.parseBaggageOptions(flight),
          duration: durationText,
          durationInMinutes: totalMinutes,
          numberOfStops: segments.length - 1,
          isRecommended,
          departureHour: departure.getUTCHours(),
        };
      }),
    );
  }

  /**
   * Atomically finds and updates a flight document
   */
  async findOneAndUpdate(
    filter: FilterQuery<Flight>,
    update: UpdateQuery<Flight>,
    options?: QueryOptions & { lean?: boolean }
  ): Promise<Flight | null> {
    return this.flightModel.findOneAndUpdate(filter, update, {
      ...options,
      session: options?.session
    }).lean();
  }
}