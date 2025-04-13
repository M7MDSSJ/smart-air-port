// src/flight/flight.controller.ts
import { Controller, Get, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { FlightService } from './flight.service';
import { QueryFlightDto } from './dto/query-flight.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApiResponseDto } from './dto/api-response.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FormattedFlight } from './flight.service';

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(private readonly flightService: FlightService) { }

  @Get('search/available')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.User, Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Search available flights via Amadeus API',
    description: 'Fetches real-time flight offers with caching and pagination.',
  })
  @ApiQuery({ name: 'tripType', required: true, enum: ['oneway', 'roundtrip', 'multicity'] })
  @ApiQuery({ name: 'departureAirport', required: true, example: 'JFK' })
  @ApiQuery({ name: 'arrivalAirport', required: true, example: 'LAX' })
  @ApiQuery({ name: 'departureDate', required: true, example: '2025-04-20' })
  @ApiQuery({ name: 'returnDate', required: false, example: '2025-04-27' })
  @ApiQuery({ name: 'adults', required: true, example: 1 })
  @ApiQuery({ name: 'children', required: false, example: 0 })
  @ApiQuery({ name: 'infants', required: false, example: 0 })
  @ApiQuery({ name: 'cabinClass', required: true, enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, example: 200 })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, example: 400 })
  @ApiQuery({ name: 'airline', required: false, type: String, example: 'F9' })
  @ApiQuery({ name: 'maxStops', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'departureTimeRange', required: false, enum: ['morning', 'afternoon', 'evening', 'night'] })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['price', 'duration', 'stops', 'totalPrice'] }) // Updated
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Number of results per page (default: 10)' })
  @ApiResponse({
    status: 200,
    description: 'List of available flight offers with pagination metadata',
    type: ApiResponseDto,
  })
  async searchAvailableFlights(@Query() query: QueryFlightDto) {
    // Validate page and limit
    const page = query.page || 1;
    const limit = query.limit || 10;

    if (!Number.isInteger(page) || page < 1) {
      throw new HttpException('Page must be a positive integer', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new HttpException('Limit must be a positive integer', HttpStatus.BAD_REQUEST);
    }

    // Validate departureDate
    const departureDate = new Date(query.departureDate);
    const currentDate = new Date('2025-04-13'); // Current date as per your setup
    if (isNaN(departureDate.getTime())) {
      throw new HttpException('departureDate must be a valid date in YYYY-MM-DD format', HttpStatus.BAD_REQUEST);
    }
    if (departureDate < currentDate) {
      throw new HttpException('departureDate must be a future date', HttpStatus.BAD_REQUEST);
    }

    const { paginatedFlights, total } = await this.flightService.searchAvailableFlights(query);
    return new ApiResponseDto({
      success: true,
      message: `Found ${paginatedFlights.length} available flight offers (out of ${total} total)`,
      data: {
        flights: paginatedFlights,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }
}