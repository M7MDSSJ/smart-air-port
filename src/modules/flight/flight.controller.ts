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

@ApiTags('Flights')
@Controller('flights')
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Post()
  @ApiOperation({ summary: 'Create new flight' })
  @ApiResponse({ status: 201, description: 'Flight created successfully' })
  create(@Body() createFlightDto: CreateFlightDto) {
    return this.flightService.create(createFlightDto);
  }

  @Get('search/available')
  @ApiOperation({ summary: 'Search available flights' })
  searchAvailableFlights(@Query() query: QueryFlightDto) {
    return this.flightService.searchAvailableFlights(query);
  }

  @Get()
  @ApiOperation({ summary: 'Get all flights' })
  findAll(@Query() query: QueryFlightDto) {
    return this.flightService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flight by ID' })
  findOne(@Param('id') id: string) {
    return this.flightService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update flight' })
  update(@Param('id') id: string, @Body() updateFlightDto: UpdateFlightDto) {
    return this.flightService.update(id, updateFlightDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete flight' })
  remove(@Param('id') id: string) {
    return this.flightService.remove(id);
  }
}
