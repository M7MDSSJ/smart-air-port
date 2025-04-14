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
import { Flight, SeatHold } from './schemas/flight.schema';
import { FlightUpdateSeatsParams } from './dto/flight-update-seats.dto';
import axios from 'axios';
import { I18nService } from 'nestjs-i18n';
import { FlightStatusService } from './flight-status.service';

// Static mapping of IATA codes to airline names with support for multiple languages
const AIRLINE_MAP: { [key: string]: { en: string; ar: string } } = {
  F9: { en: 'Frontier Airlines', ar: 'فرونتير ايرلاينز' },
  AA: { en: 'American Airlines', ar: 'الخطوط الجوية الأمريكية' },
  DL: { en: 'Delta Air Lines', ar: 'خطوط دلتا الجوية' },
  UA: { en: 'United Airlines', ar: 'الخطوط الجوية المتحدة' },
  SV: { en: 'Saudia', ar: 'السعودية' },
  NE: { en: 'Nesma Airlines', ar: 'طيران ناسما' },
  MS: { en: 'EgyptAir', ar: 'مصر للطيران' },
  XY: { en: 'Flynas', ar: 'فلاي ناس' },
};
const AIRPORT_MAP: { [key: string]: { en: string; ar: string } } = {
  CAI: { en: 'Cairo International Airport', ar: 'مطار القاهرة الدولي' },
  JED: { en: 'King Abdulaziz International Airport', ar: 'مطار الملك عبدالعزيز الدولي' },
};
const AIRPORT_TIMEZONES: { [key: string]: string } = {
  CAI: 'Africa/Cairo',
  JED: 'Asia/Riyadh',
};

const EXCHANGE_RATES: { [key: string]: number } = {
  USD_TO_EGP: 48.5,
  USD_TO_SAR: 3.75,
};

export interface FormattedFlight {
  offerId: string;
  flightNumber: string;
  airline: string;
  airlineName: string;
  departureAirport: string;
  departureAirportName: string;
  departureTime: Date;
  departureTimeLocal: string;
  arrivalAirport: string;
  arrivalAirportName: string;
  arrivalTime: Date;
  arrivalTimeLocal: string;
  status: string;
  aircraft?: string;
  price: number;
  currency: string;
  totalPrice: number;
  seatsAvailable: number;
  stops: Array<{
    airport: string;
    bookable: boolean;
    airportName: string;
    arrivalTime: Date;
    departureTime: Date;
    flightNumber: string;
    carrierCode: string;
    layoverDuration?: string;
    layoverDurationInMinutes?: number;
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
    @InjectModel(SeatHold.name) private readonly seatHoldModel: Model<SeatHold>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly flightStatusService: FlightStatusService, // Added dependency
  ) {}

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

    if (!departureAirport || !arrivalAirport || !departureDate || !tripType || !adults || !cabinClass) {
      throw new HttpException(
        await this.i18n.t('errors.departureBeforeArrival', { lang: query.language || 'en' }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.RoundTrip && !returnDate) {
      throw new HttpException(
        await this.i18n.t('errors.returnDateRequired', { lang: query.language || 'en' }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.MultiCity && (!multiCityLegs || multiCityLegs.length === 0)) {
      throw new HttpException(
        await this.i18n.t('errors.multiCityLegsRequired', { lang: query.language || 'en' }),
        HttpStatus.BAD_REQUEST,
      );
    }

    const cacheKey = `flight:${tripType}:${departureAirport}:${arrivalAirport}:${departureDate}:${returnDate || 'none'}:${adults}:${children}:${infants}:${cabinClass}`;
    await this.cacheManager.del(cacheKey);
  this.logger.log(`Cleared cache for ${cacheKey}`);
    const cachedResult = await this.cacheManager.get<{ paginatedFlights: FormattedFlight[]; total: number }>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }

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

    if (flights.length === 0) {
      let amadeusFlights: FlightOfferSearchResponse = [];
      try {
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
      } catch (error) {
        this.logger.error(`Failed to fetch flights from Amadeus: ${error.message}`);
        throw new HttpException('Failed to fetch flight offers', HttpStatus.INTERNAL_SERVER_ERROR);
      }

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

    const result = await this.formatFlightResponse(flights, query);
    await this.cacheManager.set(cacheKey, result, 3600);
    this.logger.log(`Cached flight offers for ${cacheKey}`);

    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      await this.i18n.t('email.newFlightSearchSubject', { lang: query.language || 'en' }),
      await this.i18n.t('email.newFlightSearchBody', {
        lang: query.language || 'en',
        args: { tripType, departureAirport, arrivalAirport, departureDate },
      }),
    );

    return result;
  }

  async reserveSeats(flightId: string, seats: number, language: string = 'en'): Promise<void> {
    const flight = await this.flightModel.findById(flightId).exec();
    
    if (!flight) {
      throw new HttpException(
        await this.i18n.t('errors.flightNotFound', { lang: language }),
        HttpStatus.NOT_FOUND,
      );
    }
    const cacheKey = `flight:oneway:${flight.departureAirport}:${flight.arrivalAirport}:*`;
    await this.cacheManager.del(cacheKey);
    if (flight.seatsAvailable < seats) {
      throw new HttpException(
        await this.i18n.t('errors.notEnoughSeats', { lang: language }),
        HttpStatus.CONFLICT,
      );
    }

    const params: FlightUpdateSeatsParams = {
      flightId,
      seatDelta: -seats,
      expectedVersion: flight.version,
    };

    const updatedFlight = await this.flightModel.findOneAndUpdate(
      { _id: flightId, version: flight.version },
      { $inc: { seatsAvailable: params.seatDelta, version: 1 } },
      { new: true },
    ).exec();

    if (!updatedFlight) {
      throw new HttpException(
        await this.i18n.t('errors.seatInventoryChanged', { lang: language }),
        HttpStatus.CONFLICT,
      );
    }
  }

  async initiateBooking(flightId: string, language: string = 'en'): Promise<Flight> {
    const flight = await this.flightModel.findById(flightId).exec();
    if (!flight) {
      throw new HttpException(
        await this.i18n.t('errors.flightNotFound', { lang: language }),
        HttpStatus.NOT_FOUND,
      );
    }

    if (new Date() > new Date(flight.lastTicketingDate)) {
      throw new HttpException(
        await this.i18n.t('errors.bookingWindowClosed', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }

    const amadeusPrice = await this.amadeusService.verifyPrice(flight.offerId);
    if (amadeusPrice !== flight.price) {
      throw new HttpException(
        await this.i18n.t('errors.priceChanged', { lang: language }),
        HttpStatus.CONFLICT,
      );
    }

    return flight;
  }

  async holdSeats(flightId: string, seats: number, sessionId: string, language: string = 'en'): Promise<void> {
    const flight = await this.flightModel.findById(flightId).exec();
    if (!flight) {
      throw new HttpException(
        await this.i18n.t('errors.flightNotFound', { lang: language }),
        HttpStatus.NOT_FOUND,
      );
    }
    if (flight.seatsAvailable < seats) {
      throw new HttpException(
        await this.i18n.t('errors.notEnoughSeats', { lang: language }),
        HttpStatus.CONFLICT,
      );
    }

    const holdExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await this.seatHoldModel.create({
      flightId,
      seats,
      sessionId,
      expiresAt: holdExpiry,
    });

    await this.reserveSeats(flightId, seats, language);
  }

  private parseBaggageOptions(flight: { price: { currency?: string; total?: string; includedCheckedBags?: { quantity: number }; additionalBagPrices?: Array<{ weightInKg: number; price: number }> } }): { included: string; options: Array<{ weightInKg: number; price: number }> } {
    const includedBags = flight.price.includedCheckedBags?.quantity || 0;
    this.logger.log(`Parsing baggage for flight: includedBags=${includedBags}`);
    const options = flight.price.additionalBagPrices || [
      { weightInKg: 15, price: 20 },
      { weightInKg: 23, price: 40 },
    ];
  
    return {
      included: `${includedBags}`,
      options,
    };
  }

  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      return response.data.rates[toCurrency] || 1;
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${(error as Error).message}`);
      return EXCHANGE_RATES[`${fromCurrency}_TO_${toCurrency}`] || 1;
    }
  }

  private async formatFlightResponse(flights: Flight[], query: QueryFlightDto): Promise<{ paginatedFlights: FormattedFlight[]; total: number }> {
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
      departureAirport,
      language = 'en',
    } = query;
    const totalPassengers = adults + children + infants;
  
    const usdToEgpRate = departureAirport === 'CAI' ? await this.getExchangeRate('USD', 'EGP') : 1;
    const usdToSarRate = query.arrivalAirport === 'JED' ? await this.getExchangeRate('USD', 'SAR') : 1;
  
    let formattedFlights: FormattedFlight[] = await Promise.all(
      flights.map(async (flight) => {
        const flightObj = flight.toObject ? flight.toObject() : flight;
        const departure = new Date(flight.departureTime);
        const arrival = new Date(flight.arrivalTime);
        const bookable = new Date(flight.lastTicketingDate) >= new Date();
        const durationMs = arrival.getTime() - departure.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const totalMinutes = hours * 60 + minutes;
        const isRecommended = flight.price < 350 && flight.stops.length === 0 && parseInt(flight.baggageOptions.included) > 0;
        const departureTimeZone = AIRPORT_TIMEZONES[flight.departureAirport] || 'UTC';
        const arrivalTimeZone = AIRPORT_TIMEZONES[flight.arrivalAirport] || 'UTC';
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
  
        let price = flight.price;
        let totalPrice = flight.price * totalPassengers;
        let currency = 'USD';
        if (departureAirport === 'CAI') {
          price = flight.price * usdToEgpRate;
          totalPrice = price * totalPassengers;
          currency = 'EGP';
        } else if (flight.arrivalAirport === 'JED') {
          price = flight.price * usdToSarRate;
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
  
        const stops = (flight.stops || []).map(stop => {
          const layoverMs = new Date(stop.departureTime).getTime() - new Date(stop.arrivalTime).getTime();
          const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
          const layoverMinutes = Math.floor((layoverMs % (1000 * 60 * 60)) / (1000 * 60));
          const layoverDuration = layoverHours || layoverMinutes
            ? this.i18n.t('duration.format', {
                lang: language,
                args: { hours: layoverHours, minutes: layoverMinutes },
              })
            : undefined;
          const layoverDurationInMinutes = (layoverHours * 60) + layoverMinutes;
  
          return {
            airport: stop.airport,
            airportName: AIRPORT_MAP[stop.airport]
              ? AIRPORT_MAP[stop.airport][language === 'ar' ? 'ar' : 'en']
              : stop.airport,
            arrivalTime: stop.arrivalTime,
            departureTime: stop.departureTime,
            flightNumber: stop.flightNumber,
            carrierCode: stop.carrierCode,
            layoverDuration,
            layoverDurationInMinutes,
          };
        });
  
        const includedBagsCount = parseInt(flight.baggageOptions.included, 10) || 0;
        const includedBagsText = includedBagsCount === 1 ? `${includedBagsCount} checked bag` : `${includedBagsCount} checked bags`;
  
        const statusText = (await this.flightStatusService.getFlightStatus(flight.flightNumber, flight.departureTime)) || flight.status;
  
        const durationText = `${hours}h ${minutes}m`;
  
        const airlineName = AIRLINE_MAP[flight.airline]
          ? AIRLINE_MAP[flight.airline][language === 'ar' ? 'ar' : 'en']
          : flight.airline;
  
        const { __v, createdAt, updatedAt, ...rest } = flightObj;
        return {
          ...rest,
          departureAirportName: AIRPORT_MAP[flight.departureAirport]
            ? AIRPORT_MAP[flight.departureAirport][language === 'ar' ? 'ar' : 'en']
            : flight.departureAirport,
          arrivalAirportName: AIRPORT_MAP[flight.arrivalAirport]
            ? AIRPORT_MAP[flight.arrivalAirport][language === 'ar' ? 'ar' : 'en']
            : flight.arrivalAirport,
          status: statusText,
          baggageOptions: {
            included: includedBagsText,
            options: flight.baggageOptions.options.map(opt => ({
              weightInKg: opt.weightInKg,
              price: opt.price,
            })),
          },
          duration: durationText,
          durationInMinutes: totalMinutes,
          bookable,
          stops,
          numberOfStops: flight.stops?.length || 0,
          isRecommended,
          departureHour: departure.getUTCHours(),
          departureTimeLocal,
          arrivalTimeLocal,
          price,
          totalPrice,
          currency,
          airlineName,
        };
      })
    );
  
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
  
    const effectiveSortBy = sortBy || 'price';
    const effectiveSortOrder = sortOrder || 'asc';
    formattedFlights.sort((a, b) => {
      let comparison = 0;
      if (effectiveSortBy === 'price') {
        comparison = a.price - b.price;
      } else if (effectiveSortBy === 'duration') {
        comparison = a.durationInMinutes - b.durationInMinutes;
      } else if (effectiveSortBy === 'stops') {
        comparison = a.numberOfStops - b.numberOfStops;
      } else if (effectiveSortBy === 'totalPrice') {
        comparison = a.totalPrice - b.totalPrice;
      }
      return effectiveSortOrder === 'desc' ? -comparison : comparison;
    });
  
    const total = formattedFlights.length;
    this.logger.log(`Total flights after filtering: ${total}`); // Add logging
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFlights = formattedFlights.slice(startIndex, endIndex);
  
    return { paginatedFlights, total };
  }
}

