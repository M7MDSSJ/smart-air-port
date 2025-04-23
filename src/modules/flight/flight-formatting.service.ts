import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { QueryFlightDto } from './dto/query-flight.dto';
import {
  FormattedFlight,
  AIRLINE_MAP,
  AIRPORT_MAP,
  AIRPORT_TIMEZONES,
} from './interfaces/flight-data.interface';
import { FlightStatusService } from './flight-status.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight } from './schemas/flight.schema';
import { PricingService } from './pricing.service';
import { FareTypeDto } from './dto/fare-type.dto';
import {
  AIRLINE_BAGGAGE_POLICIES,
  DEFAULT_BAGGAGE_POLICY,
  getRouteKey,
  BaggagePolicy,
} from './config/airline-baggage-policies';

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

  async formatFlightResponse(
    flights: any[],
    query: QueryFlightDto,
  ): Promise<FormattedFlight[]> {
    const {
      adults,
      children = 0,
      infants = 0,
      departureAirport,
      arrivalAirport,
      language = 'en',
    } = query;
    const totalPassengers = adults + children + infants;

    // Fetch exchange rates if necessary
    const usdToEgpRate =
      departureAirport === 'CAI'
        ? await this.exchangeRateService.getExchangeRate('USD', 'EGP')
        : 1;
    const usdToSarRate =
      arrivalAirport === 'JED'
        ? await this.exchangeRateService.getExchangeRate('USD', 'SAR')
        : 1;

    // Filter flights based on date and available seats
    const filteredFlights = flights.filter((flight) => {
      const segments = flight.itineraries?.[0]?.segments || [];
      const firstSegment = segments[0] || {};
      const lastSegment = segments[segments.length - 1] || {};
      const flightDepartureDate = firstSegment.departure?.at
        ? new Date(firstSegment.departure.at).toISOString().split('T')[0]
        : '';
      const seatsAvailable = flight.numberOfBookableSeats || 0;
      return (
        flightDepartureDate === query.departureDate &&
        seatsAvailable >= totalPassengers
      );
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
          { adults, children, infants },
        );

        // Process stops information
        const stops =
          segments.length > 1
            ? segments.slice(0, -1).map((segment: any, index: number) => {
                const nextSegment = segments[index + 1];
                const layoverMs =
                  nextSegment.departure?.at && segment.arrival?.at
                    ? new Date(nextSegment.departure.at).getTime() -
                      new Date(segment.arrival.at).getTime()
                    : 0;
                const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
                const layoverMinutes = Math.floor(
                  (layoverMs % (1000 * 60 * 60)) / (1000 * 60),
                );

                let layoverDuration: string | undefined;
                try {
                  layoverDuration =
                    layoverHours || layoverMinutes
                      ? this.i18n.t('duration.format', {
                          lang: language,
                          args: {
                            hours: layoverHours,
                            minutes: layoverMinutes,
                          },
                        })
                      : undefined;
                } catch (error) {
                  this.logger.error(
                    `Failed to translate layover duration: ${(error as Error).message}`,
                  );
                  layoverDuration = `${layoverHours}h ${layoverMinutes}m`;
                }

                return {
                  airport: segment.arrival?.iataCode || '',
                  arrivalTime: segment.arrival?.at
                    ? new Date(segment.arrival.at)
                    : new Date(),
                  departureTime: nextSegment.departure?.at
                    ? new Date(nextSegment.departure.at)
                    : new Date(),
                  flightNumber:
                    segment.number ||
                    `${segment.carrierCode}${segment.number || ''}`,
                  carrierCode: segment.carrierCode || '',
                  layoverDuration,
                };
              })
            : [];

        // Extract baggage information properly from Amadeus response
        const baggageOptions = this.extractBaggageOptions(flight, {
          departureAirport,
          arrivalAirport,
          usdToEgpRate,
          usdToSarRate,
          currency,
        });

        // Process fare types
        const fareTypes = this.processFareTypes(flight, {
          price,
          currency,
          baggageOptions, // Pass baggage options to ensure consistency
        });

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
              fareTypes,
            },
          },
          { upsert: true, new: true, lean: true },
        );

        // Format the flight response
        return this.formatFlight(
          {
            ...dbFlight,
            pricingDetail: dbFlight.pricingDetail || pricingDetail, // Fallback to calculated if not in DB
            fareTypes: dbFlight.fareTypes || fareTypes, // Include fare types in the formatted response
          },
          language,
        );
      }),
    );
  }

  private formatFlight(flight: any, language: string): FormattedFlight {
    // Calculate totalPrice safely
    const totalPrice =
      flight.pricingDetail?.summary?.totalPrice ||
      flight.price *
        (flight.pricingDetail?.breakdown?.passengers?.reduce(
          (sum, p) => sum + p.count,
          0,
        ) || 1);

    return {
      _id: flight._id,
      offerId: flight.offerId,
      airline: flight.airline,
      airlineName:
        AIRLINE_MAP[flight.airline]?.[language === 'ar' ? 'ar' : 'en'] ||
        flight.airline,
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      departureAirportName:
        AIRPORT_MAP[flight.departureAirport]?.[
          language === 'ar' ? 'ar' : 'en'
        ] || flight.departureAirport,
      departureTime: flight.departureTime,
      departureTimeLocal: new Date(flight.departureTime).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        { timeZone: AIRPORT_TIMEZONES[flight.departureAirport] || 'UTC' },
      ),
      arrivalAirport: flight.arrivalAirport,
      arrivalAirportName:
        AIRPORT_MAP[flight.arrivalAirport]?.[language === 'ar' ? 'ar' : 'en'] ||
        flight.arrivalAirport,
      arrivalTime: flight.arrivalTime,
      arrivalTimeLocal: new Date(flight.arrivalTime).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        {
          timeZone: AIRPORT_TIMEZONES[flight.arrivalAirport] || 'UTC',
        },
      ),
      status: flight.status || 'Scheduled',
      price: flight.price,
      totalPrice,
      currency: flight.currency,
      seatsAvailable: flight.seatsAvailable,
      stops: flight.stops || [],
      lastTicketingDate: flight.lastTicketingDate,
      baggageOptions: flight.baggageOptions || {
        included: '30kg total checked baggage\n1 piece',
        cabin: '7 kg cabin baggage\n1 piece',
        options: [],
      },
      pricingDetail: flight.pricingDetail || {
        summary: {
          totalPrice,
          currency: flight.currency,
          priceGuaranteedUntil: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
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
      fareTypes: flight.fareTypes || [],
      duration: this.calculateDuration(
        flight.departureTime,
        flight.arrivalTime,
      ),
      durationInMinutes: this.calculateDurationMinutes(
        flight.departureTime,
        flight.arrivalTime,
      ),
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
    return Math.round(
      (new Date(arrival).getTime() - new Date(departure).getTime()) /
        (1000 * 60),
    );
  }

  /**
   * Process available fare types for a flight
   * @param amadeusOffer The original Amadeus flight offer
   * @param flight The formatted flight data
   * @returns Array of fare types
   */
  processFareTypes(amadeusOffer: any, flight: any): FareTypeDto[] {
    try {
      // Check for route-specific restrictions on fare types
      const departureAirport =
        amadeusOffer.itineraries?.[0]?.segments?.[0]?.departure?.iataCode ||
        flight.departureAirport;

      const arrivalAirport =
        amadeusOffer.itineraries?.[0]?.segments?.[
          amadeusOffer.itineraries?.[0]?.segments?.length - 1
        ]?.arrival?.iataCode || flight.arrivalAirport;

      const airlineCode =
        amadeusOffer.validatingAirlineCodes?.[0] ||
        amadeusOffer.itineraries?.[0]?.segments?.[0]?.carrierCode ||
        flight.airline;

      // Create route key and check if fare types are allowed for this route
      const routeKey = getRouteKey(departureAirport, arrivalAirport);
      const policy =
        AIRLINE_BAGGAGE_POLICIES[airlineCode] || DEFAULT_BAGGAGE_POLICY;
      const routePolicy = policy.routeSpecificPolicies?.[routeKey];

      // If route policy explicitly disables fare types, return an empty array
      if (routePolicy && routePolicy.allowFareTypes === false) {
        this.logger.log(`Fare types disabled for route ${routeKey}`);
        return [];
      }

      // Continue with original implementation if fare types are allowed
      const fareTypes: FareTypeDto[] = [];
      const currency =
        flight.currency || amadeusOffer?.price?.currency || 'USD';
      let basePrice =
        parseFloat(flight.price) || parseFloat(amadeusOffer?.price?.total || 0);

      if (isNaN(basePrice)) {
        this.logger.warn(
          'Invalid base price for fare types, using default 100',
        );
        basePrice = 100; // Default if price is invalid
      }

      // Get baggage information
      const baggageOptions = flight.baggageOptions || {
        included: 'No checked bags',
        options: [],
      };

      // Parse included baggage information
      const includedBagText = baggageOptions.included;
      const hasCheckedBag = !includedBagText.startsWith('No checked');
      let carryOnAllowance = baggageOptions.cabin || '7 kg cabin baggage';

      // Base fare - LIGHT
      const baseFare: FareTypeDto = {
        code: 'LIGHT',
        name: 'Light',
        description: 'Basic fare with no checked baggage',
        price: basePrice,
        currency,
        baggageAllowance: {
          carryOn: carryOnAllowance,
          checked: hasCheckedBag ? includedBagText : 'No checked bags',
        },
        features: [
          { name: 'Seat Selection', included: false },
          { name: 'Refundable', included: false },
          { name: 'Change Fee', included: false },
          { name: 'Priority Boarding', included: false },
        ],
      };
      fareTypes.push(baseFare);

      // Try to extract branded fares if present in the API response
      try {
        const brandedFares = this.extractBrandedFares(amadeusOffer);
        if (brandedFares.length > 0) {
          fareTypes.push(...brandedFares);
        } else {
          // Generate synthetic fare types based on the base fare and baggage options

          // If the base fare already includes checked baggage, adapt the fare types
          if (hasCheckedBag) {
            // Create a Light (no baggage) fare type with lower price
            const lightFare = { ...baseFare };
            lightFare.code = 'LIGHT';
            lightFare.name = 'Light';
            lightFare.price = basePrice * 0.85; // 15% cheaper than base fare
            lightFare.baggageAllowance.checked = 'No checked bags';
            lightFare.description = 'Basic fare with no checked baggage';

            // Base fare becomes "Value" type
            baseFare.code = 'VALUE';
            baseFare.name = 'Value';
            baseFare.description =
              'Standard economy with checked baggage included';

            // Replace the base fare with light and value fares
            fareTypes[0] = lightFare;
            fareTypes.push(baseFare);

            // Add Premium fares
            fareTypes.push(this.createSyntheticPlusFare(baseFare));
            fareTypes.push(this.createSyntheticPremiumEconomyFare(baseFare));
          } else {
            // Standard progression if base fare doesn't include baggage
            fareTypes.push(this.createSyntheticLightFlexFare(baseFare));

            // Create value fare with first baggage option
            const valueFare = this.createSyntheticValueFare(baseFare);
            if (baggageOptions.options.length > 0) {
              const firstBagOption = baggageOptions.options[0];
              valueFare.baggageAllowance.checked = `1 checked bag (${firstBagOption.weightInKg}kg)`;
            }
            fareTypes.push(valueFare);

            // Create plus fare with more baggage
            const plusFare = this.createSyntheticPlusFare(baseFare);
            if (baggageOptions.options.length > 0) {
              const bagWeight = baggageOptions.options[0].weightInKg;
              plusFare.baggageAllowance.checked = `2 checked bags (${bagWeight}kg each)`;
            }
            fareTypes.push(plusFare);

            fareTypes.push(this.createSyntheticPremiumEconomyFare(baseFare));
          }
        }
      } catch (error) {
        this.logger.error(`Error processing branded fares: ${error.message}`);
        // Still generate synthetic fares even if extraction fails
        fareTypes.push(this.createSyntheticLightFlexFare(baseFare));
        fareTypes.push(this.createSyntheticValueFare(baseFare));
        fareTypes.push(this.createSyntheticPlusFare(baseFare));
        fareTypes.push(this.createSyntheticPremiumEconomyFare(baseFare));
      }

      return fareTypes;
    } catch (error) {
      this.logger.error(`Error in processFareTypes: ${error.message}`);
      // Return empty array if there was an error
      return [];
    }
  }

  private extractBrandedFares(amadeusOffer: any): FareTypeDto[] {
    const fareTypes: FareTypeDto[] = [];
    const currency = amadeusOffer.price.currency || 'USD';
    const basePrice = parseFloat(amadeusOffer.price.total);

    // Try to extract branded fares from different possible locations in the Amadeus response
    // This depends on the exact structure returned by Amadeus API
    const brandedFares =
      amadeusOffer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]
        ?.brandedFare ||
      amadeusOffer.travelerPricings?.[0]?.fareOption ||
      amadeusOffer.fareOptions ||
      [];

    if (Array.isArray(brandedFares) && brandedFares.length > 0) {
      this.logger.log(
        `Found ${brandedFares.length} branded fares in Amadeus response`,
      );
      // Process each branded fare
      // This is simplified and would need to be adjusted based on actual API response format
    }

    return fareTypes;
  }

  private createSyntheticLightFlexFare(baseFare: FareTypeDto): FareTypeDto {
    return {
      code: 'LIGHT_FLEX',
      name: 'Light Flex',
      description: 'Economy Light with flexibility to change your flight',
      price: baseFare.price * 1.15, // 15% more expensive
      currency: baseFare.currency,
      baggageAllowance: {
        carryOn: baseFare.baggageAllowance.carryOn,
        checked: baseFare.baggageAllowance.checked,
      },
      features: [
        { name: 'Seat Selection', included: false },
        { name: 'Refundable', included: false },
        {
          name: 'Change Fee',
          included: true,
          description: 'Free flight changes permitted',
        },
        { name: 'Priority Boarding', included: false },
      ],
    };
  }

  private createSyntheticValueFare(baseFare: FareTypeDto): FareTypeDto {
    return {
      code: 'VALUE',
      name: 'Value',
      description: 'Standard economy with 1 checked bag included',
      price: baseFare.price * 1.25, // 25% more expensive
      currency: baseFare.currency,
      baggageAllowance: {
        carryOn: baseFare.baggageAllowance.carryOn,
        checked: '1 checked bag (23kg)',
      },
      features: [
        { name: 'Seat Selection', included: true },
        { name: 'Refundable', included: false },
        { name: 'Change Fee', included: false },
        { name: 'Priority Boarding', included: false },
      ],
    };
  }

  private createSyntheticPlusFare(baseFare: FareTypeDto): FareTypeDto {
    return {
      code: 'PLUS',
      name: 'Plus',
      description: 'Enhanced economy with flexibility and 2 checked bags',
      price: baseFare.price * 1.45, // 45% more expensive
      currency: baseFare.currency,
      baggageAllowance: {
        carryOn: baseFare.baggageAllowance.carryOn,
        checked: '2 checked bags (23kg each)',
      },
      features: [
        { name: 'Seat Selection', included: true },
        { name: 'Refundable', included: false },
        {
          name: 'Change Fee',
          included: true,
          description: 'Fee applies for changes',
        },
        { name: 'Priority Boarding', included: true },
      ],
    };
  }

  private createSyntheticPremiumEconomyFare(
    baseFare: FareTypeDto,
  ): FareTypeDto {
    return {
      code: 'PREMIUM_ECONOMY',
      name: 'Premium Economy',
      description: 'Enhanced comfort with extra legroom and premium services',
      price: baseFare.price * 1.8, // 80% more expensive
      currency: baseFare.currency,
      baggageAllowance: {
        carryOn: '1 carry-on bag + 1 personal item',
        checked: '2 checked bags (23kg each)',
      },
      features: [
        {
          name: 'Seat Selection',
          included: true,
          description: 'Premium seats with extra legroom',
        },
        {
          name: 'Refundable',
          included: true,
          description: 'Partially refundable',
        },
        {
          name: 'Change Fee',
          included: true,
          description: 'Reduced change fees',
        },
        { name: 'Priority Boarding', included: true },
        { name: 'Premium Meal', included: true },
      ],
    };
  }

  private extractBaggageOptions(
    flight: any,
    {
      departureAirport,
      arrivalAirport,
      usdToEgpRate,
      usdToSarRate,
      currency,
    }: {
      departureAirport: string;
      arrivalAirport: string;
      usdToEgpRate: number;
      usdToSarRate: number;
      currency: string;
    },
  ): {
    included: string;
    cabin: string;
    options: {
      type: string;
      weightInKg: number;
      price: number;
      quantity: number;
    }[];
    source: 'amadeus' | 'fallback';
  } {
    try {
      // Get the airline code
      const airlineCode =
        flight.airline ||
        flight.validatingAirlineCodes?.[0] ||
        flight.itineraries?.[0]?.segments?.[0]?.carrierCode ||
        'UNKNOWN';

      // Create route key for route-specific policies
      const routeKey = getRouteKey(departureAirport, arrivalAirport);

      // Get the base policy for this airline
      const basePolicy =
        AIRLINE_BAGGAGE_POLICIES[airlineCode] || DEFAULT_BAGGAGE_POLICY;

      // Check if there's a route-specific override
      const routePolicy = basePolicy.routeSpecificPolicies?.[routeKey];

      // Determine the final policy to use (route-specific values override base policy)
      const policy: BaggagePolicy = {
        ...basePolicy,
        includedBaggage:
          routePolicy?.includedBaggage || basePolicy.includedBaggage,
        cabinBaggage: routePolicy?.cabinBaggage || basePolicy.cabinBaggage,
      };

      // Step 1: Extract included checked bags information
      const travelerPricing = flight.travelerPricings?.[0];
      const fareDetail = travelerPricing?.fareDetailsBySegment?.[0];
      const includedBags = fareDetail?.includedCheckedBags;

      let includedBagsQuantity = includedBags?.quantity;
      let includedBagsWeight = includedBags?.weight;
      let includedBagsWeightUnit = includedBags?.weightUnit;

      // If Amadeus doesn't provide baggage info, fall back to our airline policy
      if (includedBagsQuantity === undefined) {
        includedBagsQuantity = policy.includedBaggage.quantity;
        includedBagsWeight = policy.includedBaggage.weightPerBag;
        includedBagsWeightUnit = policy.includedBaggage.weightUnit;
      }

      // Format the included baggage text
      let includedText = 'No checked bags';
      if (includedBagsQuantity > 0) {
        const piecesText =
          includedBagsQuantity > 1
            ? `${includedBagsQuantity} pieces`
            : '1 piece';
        includedText = `${includedBagsWeight}${includedBagsWeightUnit.toLowerCase()} total checked baggage\n${piecesText}`;
      }

      // Format cabin baggage text
      const cabinText =
        policy.cabinBaggage.description ||
        `${policy.cabinBaggage.weightInKg} kg cabin baggage\n${policy.cabinBaggage.quantity} piece`;

      // Step 2: Extract purchasable baggage options
      let baggageOptions = [];

      // Try to get additional services if available
      const additionalServices = flight.additionalServices || {};
      const chargeableBags = additionalServices.chargeableCheckedBags || [];

      if (Array.isArray(chargeableBags) && chargeableBags.length > 0) {
        // Map Amadeus chargeable bags to our format
        baggageOptions = chargeableBags.map((bag) => ({
          type: 'CHECKED',
          weightInKg: bag.weight || 23,
          price: this.convertPrice(
            parseFloat(bag.price?.amount || 30),
            bag.price?.currency || 'USD',
            currency,
            { usdToEgpRate, usdToSarRate },
          ),
          quantity: bag.quantity || 1,
        }));
      } else {
        // Fallback: use airline-specific policy for included/cabin baggage and purchasable options
        const policy = AIRLINE_BAGGAGE_POLICIES[airlineCode] || DEFAULT_BAGGAGE_POLICY;
        // Check for route-specific override
        const routeKey = getRouteKey(departureAirport, arrivalAirport);
        const routePolicy = policy.routeSpecificPolicies?.[routeKey];
        // Included checked baggage
        const includedBaggage = routePolicy?.includedBaggage || policy.includedBaggage;
        const includedText = includedBaggage
          ? `${includedBaggage.weightPerBag}kg checked baggage${includedBaggage.quantity > 1 ? `\n${includedBaggage.quantity} pieces` : ''}`
          : 'No checked baggage';
        // Cabin baggage
        const cabinBaggage = routePolicy?.cabinBaggage || policy.cabinBaggage;
        const cabinText = cabinBaggage?.description || (cabinBaggage ? `${cabinBaggage.weightInKg} kg cabin baggage` : '');
        // Purchasable options
        baggageOptions = policy.additionalBaggage.map((bag) => ({
          type: bag.type,
          weightInKg: bag.weightInKg,
          price: this.convertPrice(bag.priceUSD, 'USD', currency, {
            usdToEgpRate,
            usdToSarRate,
          }),
          quantity: bag.quantity,
        }));
        return {
          included: includedText,
          cabin: cabinText,
          options: baggageOptions,
          source: 'fallback',
        };
      }

      return {
        included: includedText,
        cabin: cabinText,
        options: baggageOptions,
        source: Array.isArray(chargeableBags) && chargeableBags.length > 0 ? 'amadeus' : 'fallback',
      };
    } catch (error) {
      this.logger.error(`Error extracting baggage options: ${error.message}`);

      // Fallback to basic default options
      const basePrice =
        30 *
        (currency === 'EGP'
          ? usdToEgpRate
          : currency === 'SAR'
            ? usdToSarRate
            : 1);

      return {
        included: '30kg total checked baggage\n1 piece',
        cabin: '7 kg cabin baggage\n1 piece',
        options: [
          {
            type: 'CHECKED',
            weightInKg: 23,
            price: basePrice,
            quantity: 1,
          },
          {
            type: 'CHECKED',
            weightInKg: 32,
            price: basePrice * 1.5,
            quantity: 1,
          },
        ],
        source: 'fallback',
      };
    }
  }

  /**
   * Convert price between currencies
   */
  private convertPrice(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    {
      usdToEgpRate,
      usdToSarRate,
    }: { usdToEgpRate: number; usdToSarRate: number },
  ): number {
    if (fromCurrency === toCurrency) return amount;

    // Convert to USD first as a common denominator
    let amountInUsd = amount;
    if (fromCurrency === 'EGP') amountInUsd = amount / usdToEgpRate;
    else if (fromCurrency === 'SAR') amountInUsd = amount / usdToSarRate;

    // Convert from USD to target currency
    if (toCurrency === 'EGP') return amountInUsd * usdToEgpRate;
    if (toCurrency === 'SAR') return amountInUsd * usdToSarRate;

    return amountInUsd; // Default to USD
  }

  /**
   * Get default baggage options for a specific airline
   */
  private getDefaultBaggageOptions(
    airlineCode: string,
    currency: string,
    {
      usdToEgpRate,
      usdToSarRate,
    }: { usdToEgpRate: number; usdToSarRate: number },
  ): Array<{
    type: string;
    weightInKg: number;
    price: number;
    quantity: number;
  }> {
    try {
      // Get the airline policy or use default
      const policy =
        AIRLINE_BAGGAGE_POLICIES[airlineCode] || DEFAULT_BAGGAGE_POLICY;

      // Map the policy to our baggage options format
      return policy.additionalBaggage.map((bag) => ({
        type: bag.type,
        weightInKg: bag.weightInKg,
        price: this.convertPrice(bag.priceUSD, 'USD', currency, {
          usdToEgpRate,
          usdToSarRate,
        }),
        quantity: bag.quantity,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting default baggage options: ${error.message}`,
      );

      // Fallback to hardcoded defaults
      const basePrice =
        30 *
        (currency === 'EGP'
          ? usdToEgpRate
          : currency === 'SAR'
            ? usdToSarRate
            : 1);

      return [
        { type: 'CHECKED', weightInKg: 23, price: basePrice, quantity: 1 },
        {
          type: 'CHECKED',
          weightInKg: 32,
          price: basePrice * 1.5,
          quantity: 1,
        },
      ];
    }
  }
}
