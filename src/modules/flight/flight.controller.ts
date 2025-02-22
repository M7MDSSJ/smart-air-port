// src/modules/flight/flight.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
} from '@nestjs/common';
import { FlightService } from './flight.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { QueryFlightDto } from './dto/query-flight.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseDto } from './dto/api-response.dto';
import { Flight } from './schemas/flight.schema';
import { EmailService } from '../email/email.service';

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  constructor(
    private readonly flightService: FlightService,
    private readonly emailService: EmailService, // Inject EmailService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new flight' })
  @ApiResponse({
    status: 201,
    description: 'Flight created successfully',
    type: ApiResponseDto<Flight>,
  })
  async create(@Body() createFlightDto: CreateFlightDto) {
    const flight = await this.flightService.create(createFlightDto);
    // Send notification to admins about the new flight.
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
  @ApiOperation({ summary: 'Search available flights' })
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
  @ApiOperation({ summary: 'Get all flights' })
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
  @ApiOperation({ summary: 'Get flight by ID' })
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
  @ApiOperation({ summary: 'Update flight' })
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
  @ApiOperation({ summary: 'Delete flight' })
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
