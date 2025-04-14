import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlightOfferSearchResponse } from './dto/amadeus-flight-offer.dto';

@Injectable()
export class AmadeusService {
  private readonly logger = new Logger(AmadeusService.name);
  private readonly baseUrl = 'https://test.api.amadeus.com';

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('AMADEUS_API_KEY');
    const clientSecret = this.configService.get<string>('AMADEUS_API_SECRET');
    const body = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

    try {
      const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      this.logger.log('Fetched Amadeus access token');
      return data.access_token;
    } catch (error) {
      this.logger.error(`Token fetch error: ${(error as Error).message}`);
      throw new HttpException('Failed to fetch access token', 500);
    }
  }

  async searchFlightOffers(
    origin: string,
    destination: string,
    departureDate: string,
    adults: number,
    children: number = 0,
    infants: number = 0,
    cabinClass: string,
  ): Promise<FlightOfferSearchResponse> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults}&children=${children}&infants=${infants}&travelClass=${cabinClass}&currencyCode=USD&max=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Flight search error: ${JSON.stringify(data)}`);
      throw new HttpException(
        {
          status: response.status,
          message: data.errors?.[0]?.detail || 'Failed to fetch flight offers',
          details: data,
        },
        response.status,
      );
    }
    this.logger.log(`Fetched ${data.data.length} flight offers from Amadeus`);
    return data.data;
  }

  async searchRoundTripOffers(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate: string,
    adults: number,
    children: number = 0,
    infants: number = 0,
    cabinClass: string,
  ): Promise<FlightOfferSearchResponse> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&returnDate=${returnDate}&adults=${adults}&children=${children}&infants=${infants}&travelClass=${cabinClass}&currencyCode=USD&max=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Round-trip search error: ${JSON.stringify(data)}`);
      throw new HttpException(
        {
          status: response.status,
          message: data.errors?.[0]?.detail || 'Failed to fetch round-trip offers',
          details: data,
        },
        response.status,
      );
    }
    return data.data;
  }

  async searchMultiCityOffers(
    legs: { from: string; to: string; departureDate: string }[],
    adults: number,
    children: number = 0,
    infants: number = 0,
    cabinClass: string,
  ): Promise<FlightOfferSearchResponse> {
    const token = await this.getAccessToken();
    const originDestinations = legs
      .map((leg, index) => ({
        id: `${index + 1}`,
        originLocationCode: leg.from,
        destinationLocationCode: leg.to,
        departureDateTimeRange: { date: leg.departureDate },
      }))
      .map((param) => ({
        ...param,
        departureDateTimeRange: param.departureDateTimeRange.date,
      }))
      .map((param) => new URLSearchParams(param).toString())
      .join('&');
    const url = `${this.baseUrl}/v2/shopping/flight-offers?${originDestinations}&adults=${adults}&children=${children}&infants=${infants}&travelClass=${cabinClass}&currencyCode=USD&max=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Multi-city search error: ${JSON.stringify(data)}`);
      throw new HttpException(
        {
          status: response.status,
          message: data.errors?.[0]?.detail || 'Failed to fetch multi-city offers',
          details: data,
        },
        response.status,
      );
    }
    return data.data;
  }

  // New method to verify price with Amadeus
  async verifyPrice(offerId: string): Promise<number> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/shopping/flight-offers?offerId=${offerId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Price verification error: ${JSON.stringify(data)}`);
      throw new HttpException(
        {
          status: response.status,
          message: data.errors?.[0]?.detail || 'Failed to verify price',
          details: data,
        },
        response.status,
      );
    }
    return parseFloat(data.data[0].price.total);
  }

  // New method to fetch flight status (mock implementation for now)
  async getFlightStatus(flightNumber: string): Promise<string> {
    // Note: Amadeus does not provide a direct flight status API in the test environment.
    // This is a placeholder for a real implementation using an appropriate endpoint.
    // For now, we'll return a mock status.
    this.logger.log(`Fetching status for flight ${flightNumber}`);
    return 'Scheduled'; // Replace with actual API call
  }
}