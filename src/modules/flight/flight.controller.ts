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

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  constructor(
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Create new flight',
    description:
      'Creates a new flight record. Only users with Admin or Moderator roles are allowed. Provide all necessary flight details in the request body.',
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
  @ApiResponse({
    status: 201,
    description: 'Flight created successfully',
    type: ApiResponseDto<Flight>,
  })
  async create(@Body() createFlightDto: CreateFlightDto) {
    const flight = await this.flightService.create(createFlightDto);
    // Notify admin about the new flight
    await this.emailService.sendImportantEmail(
      'admin@example.com',
      'New Flight Created',
      `Flight ${flight.flightNumber} has been created.`,
    );
    return new ApiResponseDto({
      success: true,
      message: 'Flight created successfully',
      data: flight,
    });
  }

  @Get('search/available')
  @ApiOperation({
    summary: 'Search available flights',
    description:
      'Search for flights with available seats. Optional filters include departure airport, arrival airport, and departure date.',
  })
  @ApiQuery({
    name: 'departureAirport',
    required: false,
    description: 'Departure airport code or name',
    example: 'CAIRO',
  })
  @ApiQuery({
    name: 'arrivalAirport',
    required: false,
    description: 'Arrival airport code or name',
    example: 'LUX',
  })
  @ApiQuery({
    name: 'departureDate',
    required: false,
    description: 'Departure date in YYYY-MM-DD format',
    example: '2025-02-17',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available flights',
    type: ApiResponseDto<Flight[]>,
  })
  async searchAvailableFlights(@Query() query: QueryFlightDto) {
    const flights = await this.flightService.searchAvailableFlights(query);
    return new ApiResponseDto({
      success: true,
      message: `Found ${flights.length} available flights`,
      data: flights,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get all flights',
    description:
      'Retrieves a list of all flights. Query parameters can be used to filter the results.',
  })
  @ApiResponse({
    status: 200,
    description: 'Flight details',
    type: ApiResponseDto<Flight>,
  })
  async findAll(@Query() query: QueryFlightDto) {
    const flights = await this.flightService.findAll(query);
    return new ApiResponseDto({
      success: true,
      message: `Found ${flights.length} flights`,
      data: flights,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get flight by ID',
    description: 'Retrieves flight details for the given flight ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Flight details',
    type: ApiResponseDto<Flight>,
  })
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
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Update flight',
    description:
      'Updates an existing flight record by its ID. Only Admin and Moderator roles are allowed. The request must include the current version number for optimistic locking.',
  })
  @ApiBody({
    type: UpdateFlightDto,
    examples: {
      example1: {
        summary: 'Update Flight Example',
        value: {
          flightNumber: 'S12Z', // Optionally update flight number
          airline: 'Air Cairo Updated',
          departureAirport: 'CAIRO',
          arrivalAirport: 'LUX',
          departureTime: '2025-02-17T12:00:00Z',
          arrivalTime: '2025-02-17T14:30:00Z',
          price: 275,
          seats: 200,
          version: 1, // Required for optimistic locking
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated flight details',
    type: ApiResponseDto<Flight>,
  })
  async update(
    @Param('id') id: string,
    @Body() updateFlightDto: UpdateFlightDto,
  ) {
    const flight = await this.flightService.update(id, updateFlightDto);
    // Notify admin about the update.
    await this.emailService.sendImportantEmail(
      'admin@example.com',
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
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({
    summary: 'Delete flight',
    description:
      'Deletes an existing flight record by its ID. Only Admin and Moderator roles are allowed to perform this operation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deleted flight details',
    type: ApiResponseDto<Flight>,
  })
  async remove(@Param('id') id: string) {
    const flight = await this.flightService.remove(id);
    // Notify admin about the deletion.
    await this.emailService.sendImportantEmail(
      'admin@example.com',
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
