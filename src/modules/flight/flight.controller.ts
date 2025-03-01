import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  UseGuards,
  Headers,
  Logger,
} from '@nestjs/common';
import { FlightService } from './flight.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { QueryFlightDto } from './dto/query-flight.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiResponseDto } from './dto/api-response.dto';
import { Flight } from './schemas/flight.schema';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Create new flight',
    description: 'Creates a new flight record. Only Admin or Moderator roles are allowed.',
  })
  @ApiBody({
    type: CreateFlightDto,
    examples: {
      example1: {
        summary: 'Create Flight Example',
        value: {
          flightNumber: 'S12Z',
          airline: 'Air Cairo',
          departureAirport: 'CAIRO',
          arrivalAirport: 'LUX',
          departureTime: '2025-02-17T12:00:00Z',
          arrivalTime: '2025-02-17T14:30:00Z',
          price: 250,
          seats: 200,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Flight created successfully', type: ApiResponseDto<Flight> })
  async create(
    @Body() createFlightDto: CreateFlightDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.flightService.findByFlightNumber(createFlightDto.flightNumber);
      if (existing) {
        return new ApiResponseDto({ success: true, message: 'Flight already exists', data: existing });
      }
    }
    const flight = await this.flightService.create(createFlightDto);
    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      'New Flight Created',
      `Flight ${flight.flightNumber} has been created.`,
    );
    return new ApiResponseDto({ success: true, message: 'Flight created successfully', data: flight });
  }

  @Get('search/available')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Search available flights',
    description: 'Search for flights with available seats using optional filters.',
  })
  @ApiQuery({ name: 'departureAirport', required: false, example: 'CAIRO' })
  @ApiQuery({ name: 'arrivalAirport', required: false, example: 'LUX' })
  @ApiQuery({ name: 'departureDate', required: false, example: '2025-02-17' })
  @ApiResponse({ status: 200, description: 'List of available flights', type: ApiResponseDto<Flight[]> })
  async searchAvailableFlights(@Query() query: QueryFlightDto) {
    const flights = await this.flightService.searchAvailableFlights(query);
    return new ApiResponseDto({
      success: true,
      message: `Found ${flights.length} available flights`,
      data: flights,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all flights', description: 'Retrieves a paginated list of flights.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, type: ApiResponseDto<Flight> })
  async findAll(
    @Query() query: QueryFlightDto,
    @Query('page', { transform: Number }) page = 1,
    @Query('limit', { transform: Number }) limit = 10,
  ) {
    const { flights, total, page: currentPage, limit: currentLimit } = await this.flightService.findAll(query, page, limit);
    return new ApiResponseDto({
      success: true,
      message: `Found ${flights.length} flights`,
      data: flights,
      meta: { total, page: currentPage, limit: currentLimit },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flight by ID', description: 'Retrieves flight details by ID.' })
  @ApiResponse({ status: 200, description: 'Flight details', type: ApiResponseDto<Flight> })
  async findOne(@Param('id') id: string) {
    const flight = await this.flightService.findOne(id);
    return new ApiResponseDto({
      success: true,
      message: 'Flight details retrieved successfully',
      data: flight,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Update flight',
    description: 'Updates an existing flight record by ID with optimistic locking.',
  })
  @ApiBody({ type: UpdateFlightDto })
  @ApiResponse({ status: 200, description: 'Updated flight details', type: ApiResponseDto<Flight> })
  async update(@Param('id') id: string, @Body() updateFlightDto: UpdateFlightDto) {
    const flight = await this.flightService.update(id, updateFlightDto);
    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      'Flight Updated',
      `Flight ${flight.flightNumber} has been updated.`,
    );
    return new ApiResponseDto({
      success: true,
      message: 'Flight updated successfully',
      data: flight,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({ summary: 'Delete flight', description: 'Deletes a flight record by ID.' })
  @ApiResponse({ status: 200, description: 'Deleted flight details', type: ApiResponseDto<Flight> })
  async remove(@Param('id') id: string) {
    const flight = await this.flightService.remove(id);
    await this.emailService.sendImportantEmail(
      this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com'),
      'Flight Deleted',
      `Flight ${flight.flightNumber} has been deleted.`,
    );
    return new ApiResponseDto({
      success: true,
      message: 'Flight deleted successfully',
      data: flight,
    });
  }
}