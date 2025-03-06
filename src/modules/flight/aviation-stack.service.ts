import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Flight } from './schemas/flight.schema';
import { QueryFlightDto } from './dto/query-flight.dto';
import { firstValueFrom } from 'rxjs'; // Modern RxJS utility

@Injectable()
export class AviationStackService {
  private readonly apiUrl = 'http://api.aviationstack.com/v1';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const apiKey = this.configService.get<string>('AVIATIONSTACK_API_KEY');
    if (!apiKey) {
      throw new Error(
        'AviationStack API key not configured in environment variables',
      );
    }
    this.apiKey = apiKey; // TypeScript now knows apiKey is string
  }

  async searchFlights(query: QueryFlightDto): Promise<Flight[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/flights`, {
          params: {
            access_key: this.apiKey,
            dep_iata: query.departureAirport,
            arr_iata: query.arrivalAirport,
            flight_date: query.departureDate,
          },
        }),
      );

      const apiFlights = response.data.data || [];
      return apiFlights.map((flight) => ({
        flightNumber: flight.flight?.iata || flight.flight?.number || 'Unknown',
        airline: flight.airline?.name || 'Unknown',
        departureAirport:
          flight.departure?.iata || flight.departure?.airport || 'Unknown',
        arrivalAirport:
          flight.arrival?.iata || flight.arrival?.airport || 'Unknown',
        departureTime: new Date(flight.departure?.scheduled || Date.now()),
        arrivalTime: new Date(flight.arrival?.scheduled || Date.now()),
        status: this.mapStatus(flight.flight_status),
        aircraft: flight.aircraft?.type || undefined,
        price: null, // AviationStack doesn’t provide this
        seats: null,
        seatsAvailable: null,
        stops:
          flight.stops?.map((stop) => ({
            airport: stop.airport || 'Unknown',
            arrivalTime: new Date(stop.arrival || Date.now()),
            departureTime: new Date(stop.departure || Date.now()),
          })) || [],
        version: 0, // Default for API-sourced data
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        throw new HttpException(
          this.i18n.t('errors.apiRateLimit'),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        this.i18n.t('errors.apiError'),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapStatus(apiStatus: string | undefined): Flight['status'] {
    const statusMap: Record<string, Flight['status']> = {
      scheduled: 'Scheduled',
      delayed: 'Delayed',
      cancelled: 'Cancelled',
      active: 'Departed',
      landed: 'Arrived',
    };
    return statusMap[apiStatus?.toLowerCase() || 'scheduled'] || 'Scheduled';
  }
}
