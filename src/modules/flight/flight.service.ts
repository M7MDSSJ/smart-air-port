import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { DepartureTimeRange, QueryFlightDto, SortBy, SortOrder, TripType } from './dto/query-flight.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { FlightStatusService } from './flight-status.service';
import axios from 'axios';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { SeatHold } from './schemas/flight.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

// Static mappings (unchanged)
const AIRLINE_MAP: { [key: string]: { en: string; ar: string } } = {
  F9: { en: 'Frontier Airlines', ar: 'فرونتير ايرلاينز' },
  AA: { en: 'American Airlines', ar: 'الخطوط الجوية الأمريكية' },
  DL: { en: 'Delta Air Lines', ar: 'خطوط دلتا الجوية' },
  UA: { en: 'United Airlines', ar: 'الخطوط الجوية المتحدة' },
  SV: { en: 'Saudia', ar: 'السعودية' },
  NE: { en: 'Nesma Airlines', ar: 'طيران ناسما' },
  MS: { en: 'EgyptAir', ar: 'مصر للطيران' },
  XY: { en: 'Flynas', ar: 'فلاي ناس' },
  TK: { en: 'Turkish Airlines', ar: 'الخطوط الجوية التركية' },
  ET: { en: 'Ethiopian Airlines', ar: 'الخطوط الجوية الإثيوبية' },
};

const AIRPORT_MAP: { [key: string]: { en: string; ar: string } } = {
  CAI: { en: 'Cairo International Airport', ar: 'مطار القاهرة الدولي' },
  JED: { en: 'King Abdulaziz International Airport', ar: 'مطار الملك عبدالعزيز الدولي' },
  IST: { en: 'Istanbul Airport', ar: 'مطار إسطنبول' },
  ADD: { en: 'Addis Ababa Bole International Airport', ar: 'مطار أديس أبابا بولي الدولي' },
  DMM: { en: 'King Fahd International Airport', ar: 'مطار الملك فهد الدولي' },
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
  duration: string;
  durationInMinutes: number;
  numberOfStops: number;
  isRecommended: boolean;
  departureHour: number;
  sessionId?: string;
}

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly flightStatusService: FlightStatusService,
    @InjectModel('SeatHold') private readonly seatHoldModel: Model<SeatHold>,
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

    const cacheKey = `flight:${tripType}:${departureAirport}:${arrivalAirport}:${departureDate}:${returnDate || 'none'}:${adults}:${children}:${infants}:${cabinClass}:${language}`;
    const cachedResult = await this.cacheManager.get<{ paginatedFlights: FormattedFlight[]; total: number }>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
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

    for (const flight of formattedFlights) {
      if (flight.seatsAvailable >= totalPassengers) {
        const expiresAt = new Date(Date.now() + holdDuration);
        if (isNaN(expiresAt.getTime())) {
          this.logger.error(`Failed to create expiresAt date: holdDuration=${holdDuration}`);
          throw new HttpException('Internal server error: Invalid expiration time for seat hold', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const seatHold = new this.seatHoldModel({
          flightId: flight.offerId,
          seats: totalPassengers,
          sessionId,
          expiresAt,
        });
        await seatHold.save();
        this.logger.log(`Created seat hold for flight ${flight.offerId}, session ${sessionId}, expires at ${expiresAt}`);
      }
    }

    let filteredFlights = formattedFlights;

    if (minPrice !== undefined) {
      filteredFlights = filteredFlights.filter(flight => flight.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      filteredFlights = filteredFlights.filter(flight => flight.price <= maxPrice);
    }
    if (airline) {
      filteredFlights = filteredFlights.filter(flight => flight.airline === airline);
    }
    if (maxStops !== undefined) {
      filteredFlights = filteredFlights.filter(flight => flight.numberOfStops <= maxStops);
    }
    if (departureTimeRange) {
      filteredFlights = filteredFlights.filter(flight => {
        const hour = flight.departureHour;
        if (departureTimeRange === DepartureTimeRange.Morning) return hour >= 0 && hour < 12;
        if (departureTimeRange === DepartureTimeRange.Afternoon) return hour >= 12 && hour < 18;
        if (departureTimeRange === DepartureTimeRange.Evening) return hour >= 18 && hour < 21;
        if (departureTimeRange === DepartureTimeRange.Night) return hour >= 21 || hour < 0;
        return true;
      });
    }

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

    const total = filteredFlights.length;
    this.logger.log(`Total flights after filtering: ${total}`);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFlights = filteredFlights.slice(startIndex, endIndex);

    const result = { paginatedFlights, total };
    result.paginatedFlights = result.paginatedFlights.map(flight => ({
      ...flight,
      sessionId,
    }));

    await this.cacheManager.set(cacheKey, result, 3600);
    this.logger.log(`Cached flight offers for ${cacheKey}`);

    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      await this.i18n.t('email.newFlightSearchSubject', { lang: language }),
      await this.i18n.t('email.newFlightSearchBody', {
        lang: language,
        args: { tripType, departureAirport, arrivalAirport, departureDate },
      }),
    );

    return result;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredSeatHolds() {
    try {
      const now = new Date();
      const deleted = await this.seatHoldModel.deleteMany({ expiresAt: { $lte: now } });
      this.logger.log(`Cleaned up ${deleted.deletedCount} expired seat holds`);
    } catch (error) {
      this.logger.error(`Failed to clean up expired seat holds: ${(error as Error).message}`);
    }
  }

  async initiateBooking(flightOfferId: string, language: string = 'en'): Promise<any> {
    try {
      const flightOffer = await this.amadeusService.getFlightOffer(flightOfferId);
      if (!flightOffer) {
        throw new HttpException(
          await this.i18n.t('errors.flightNotFound', { lang: language }),
          HttpStatus.NOT_FOUND,
        );
      }

      const lastTicketingDate = new Date(flightOffer.lastTicketingDate);
      if (new Date() > lastTicketingDate) {
        throw new HttpException(
          await this.i18n.t('errors.bookingWindowClosed', { lang: language }),
          HttpStatus.BAD_REQUEST,
        );
      }

      return flightOffer;
    } catch (error) {
      this.logger.error(`Failed to fetch flight offer ${flightOfferId}: ${(error as Error).message}`);
      throw new HttpException(
        await this.i18n.t('errors.flightNotFound', { lang: language }),
        HttpStatus.NOT_FOUND,
      );
    }
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

  private async formatFlightResponse(flights: any[], query: QueryFlightDto): Promise<FormattedFlight[]> {
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
}