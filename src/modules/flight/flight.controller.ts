// flight.controller.ts
import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { FlightService } from './flight.service';
import { QueryFlightDto } from './dto/query-flight.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApiResponseDto } from './dto/api-response.dto';
import { FlightOfferSearchResponse } from './dto/amadeus-flight-offer.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(private readonly flightService: FlightService) {}
  
  @Get('search/available')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User, Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Search available flights via Amadeus API',
    description: 'Fetches real-time flight offers with caching.',
  })
  @ApiQuery({ name: 'departureAirport', required: true, example: 'JFK' })
  @ApiQuery({ name: 'arrivalAirport', required: true, example: 'LAX' })
  @ApiQuery({ name: 'departureDate', required: true, example: '2025-03-20' })
  @ApiQuery({ name: 'adults', required: false, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'List of available flight offers',
    type: ApiResponseDto<FlightOfferSearchResponse>,
    })
  async searchAvailableFlights(@Query() query: QueryFlightDto) {
    const flights = await this.flightService.searchAvailableFlights(query);
    return new ApiResponseDto({
      success: true,
      message: `Found ${flights.length} available flight offers`,
      data: flights,
    });
  }
}