import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { QueryFlightDto } from './dto/query-flight.dto';
import { FormattedFlight, AIRLINE_MAP, AIRPORT_MAP, AIRPORT_TIMEZONES } from './interfaces/flight-data.interface';
import { FlightStatusService } from './flight-status.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight } from './schemas/flight.schema';
import { PricingService } from './pricing.service';

@Injectable()
export class FlightFormattingService {
  private readonly logger = new Logger(FlightFormattingService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly flightStatusService: FlightStatusService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly pricingService: PricingService,
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async formatFlightResponse(flights: any[], query: QueryFlightDto): Promise<FormattedFlight[]> {
    const { adults, children = 0, infants = 0, departureAirport, arrivalAirport, language = 'en' } = query;
    const totalPassengers = adults + children + infants;

    // Fetch exchange rates if necessary
    const usdToEgpRate = departureAirport === 'CAI' ? await this.exchangeRateService.getExchangeRate('USD', 'EGP') : 1;
    const usdToSarRate = arrivalAirport === 'JED' ? await this.exchangeRateService.getExchangeRate('USD', 'SAR') : 1;

    // Filter flights based on date and available seats
    const filteredFlights = flights.filter((flight) => {
      const segments = flight.itineraries?.[0]?.segments || [];
      const firstSegment = segments[0] || {};
      const lastSegment = segments[segments.length - 1] || {};
      const flightDepartureDate = firstSegment.departure?.at
        ? new Date(firstSegment.departure.at).toISOString().split('T')[0]
        : '';
      const seatsAvailable = flight.numberOfBookableSeats || 0;
      return flightDepartureDate === query.departureDate && seatsAvailable >= totalPassengers;
    });

    // Process each filtered flight
    return Promise.all(
      filteredFlights.map(async (flight) => {
        const segments = flight.itineraries?.[0]?.segments || [];
        const firstSegment = segments[0] || {};
        const lastSegment = segments[segments.length - 1] || {};

        // Extract departure and arrival times
        const departure = new Date(firstSegment.departure?.at || new Date());
        const arrival = new Date(lastSegment.arrival?.at || new Date());

        // Adjust price and currency based on departure/arrival airport
        let price = parseFloat(flight.price.total);
        let currency = flight.price.currency || 'USD';
        if (departureAirport === 'CAI') {
          price *= usdToEgpRate;
          currency = 'EGP';
        } else if (arrivalAirport === 'JED') {
          price *= usdToSarRate;
          currency = 'SAR';
        }

        // Calculate pricing detail
        const pricingDetail = this.pricingService.calculateTotalPrice(
          {
            ...flight,
            price,
            currency,
            carrierCode: firstSegment.carrierCode || flight.airline || '',
          },
          { adults, children, infants }
        );

        // Process stops information
        const stops =
          segments.length > 1
            ? segments.slice(0, -1).map((segment: any, index: number) => {
                const nextSegment = segments[index + 1];
                const layoverMs =
                  nextSegment.departure?.at && segment.arrival?.at
                    ? new Date(nextSegment.departure.at).getTime() - new Date(segment.arrival.at).getTime()
                    : 0;
                const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
                const layoverMinutes = Math.floor((layoverMs % (1000 * 60 * 60)) / (1000 * 60));

                let layoverDuration: string | undefined;
                try {
                  layoverDuration =
                    layoverHours || layoverMinutes
                      ? this.i18n.t('duration.format', {
                          lang: language,
                          args: { hours: layoverHours, minutes: layoverMinutes },
                        })
                      : undefined;
                } catch (error) {
                  this.logger.error(`Failed to translate layover duration: ${(error as Error).message}`);
                  layoverDuration = `${layoverHours}h ${layoverMinutes}m`;
                }

                return {
                  airport: segment.arrival?.iataCode || '',
                  arrivalTime: segment.arrival?.at ? new Date(segment.arrival.at) : new Date(),
                  departureTime: nextSegment.departure?.at ? new Date(nextSegment.departure.at) : new Date(),
                  flightNumber: segment.number || `${segment.carrierCode}${segment.number || ''}`,
                  carrierCode: segment.carrierCode || '',
                  layoverDuration,
                };
              })
            : [];

        // Baggage options
        const baggageOptions = {
          included:
            flight.price.includedCheckedBags?.quantity > 0
              ? `${flight.price.includedCheckedBags.quantity} checked bags`
              : 'No checked bags',
          options: flight.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity
            ? [
                {
                  type: 'CHECKED',
                  weightInKg: 23,
                  price: 30 * (currency === 'EGP' ? usdToEgpRate : currency === 'SAR' ? usdToSarRate : 1),
                  quantity: flight.travelerPricings[0].fareDetailsBySegment[0].includedCheckedBags.quantity,
                },
              ]
            : [
                {
                  type: 'CHECKED',
                  weightInKg: 23,
                  price: 30 * (currency === 'EGP' ? usdToEgpRate : currency === 'SAR' ? usdToSarRate : 1),
                  quantity: 2,
                },
              ],
        };

        // Update or create the flight in the database
        const dbFlight = await this.flightModel.findOneAndUpdate(
          { offerId: flight.id },
          {
            $set: {
              offerId: flight.id,
              flightNumber: firstSegment.number || '',
              airline: firstSegment.carrierCode || '',
              departureAirport: firstSegment.departure?.iataCode || '',
              arrivalAirport: lastSegment.arrival?.iataCode || '',
              departureTime: departure,
              arrivalTime: arrival,
              status: 'Scheduled',
              price,
              currency,
              seatsAvailable: flight.numberOfBookableSeats || 9,
              stops,
              lastTicketingDate: flight.lastTicketingDate,
              baggageOptions,
              pricingDetail,
            },
          },
          { upsert: true, new: true, lean: true }
        );

        // Format the flight response
        return this.formatFlight(
          {
            ...dbFlight,
            pricingDetail: dbFlight.pricingDetail || pricingDetail, // Fallback to calculated if not in DB
          },
          language
        );
      })
    );
  }

  private formatFlight(flight: any, language: string): FormattedFlight {
    // Calculate totalPrice safely
    const totalPrice =
      flight.pricingDetail?.summary?.totalPrice ||
      (flight.price * (flight.pricingDetail?.breakdown?.passengers?.reduce((sum, p) => sum + p.count, 0) || 1));

    return {
      _id: flight._id,
      offerId: flight.offerId,
      airline: flight.airline,
      airlineName: AIRLINE_MAP[flight.airline]?.[language === 'ar' ? 'ar' : 'en'] || flight.airline,
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      departureAirportName:
        AIRPORT_MAP[flight.departureAirport]?.[language === 'ar' ? 'ar' : 'en'] || flight.departureAirport,
      departureTime: flight.departureTime,
      departureTimeLocal: new Date(flight.departureTime).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        { timeZone: AIRPORT_TIMEZONES[flight.departureAirport] || 'UTC' }
      ),
      arrivalAirport: flight.arrivalAirport,
      arrivalAirportName:
        AIRPORT_MAP[flight.arrivalAirport]?.[language === 'ar' ? 'ar' : 'en'] || flight.arrivalAirport,
      arrivalTime: flight.arrivalTime,
      arrivalTimeLocal: new Date(flight.arrivalTime).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
        timeZone: AIRPORT_TIMEZONES[flight.arrivalAirport] || 'UTC',
      }),
      status: flight.status || 'Scheduled',
      price: flight.price,
      totalPrice,
      currency: flight.currency,
      seatsAvailable: flight.seatsAvailable,
      stops: flight.stops || [],
      lastTicketingDate: flight.lastTicketingDate,
      baggageOptions: flight.baggageOptions || { included: 'No checked bags', options: [] },
      pricingDetail: flight.pricingDetail || {
        summary: {
          totalPrice,
          currency: flight.currency,
          priceGuaranteedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        breakdown: {
          passengers: [
            {
              type: 'ADT',
              count: 1,
              priceEach: flight.price,
              subtotal: flight.price,
              description: 'Adult',
            },
          ],
          fees: [],
        },
      },
      duration: this.calculateDuration(flight.departureTime, flight.arrivalTime),
      durationInMinutes: this.calculateDurationMinutes(flight.departureTime, flight.arrivalTime),
      numberOfStops: flight.stops?.length || 0,
      isRecommended: flight.price < 350 && (flight.stops?.length || 0) === 0,
      departureHour: new Date(flight.departureTime).getHours(),
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };
  }

  private calculateDuration(departure: Date, arrival: Date): string {
    const diff = new Date(arrival).getTime() - new Date(departure).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private calculateDurationMinutes(departure: Date, arrival: Date): number {
    return Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / (1000 * 60));
  }
}