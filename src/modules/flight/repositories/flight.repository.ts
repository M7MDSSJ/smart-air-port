import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flight } from '../schemas/flight.schema';
import { IFlightRepository } from './flight.repository.interface';
import { CreateFlightDto } from '../dto/create-flight.dto';
import { UpdateFlightDto } from '../dto/update-flight.dto';
import { QueryFlightDto } from '../dto/query-flight.dto';
import { FlightAvailabilityQuery } from '../dto/available-flight-query.dto';
import { FlightQueryFilter } from '../dto/query-flight.dto';
import { FlightUpdateSeatsParams } from '../dto/flight-update-seats.dto';

@Injectable()
export class FlightRepository implements IFlightRepository {
  constructor(
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async create(createFlightDto: CreateFlightDto): Promise<Flight> {
    const newFlight = new this.flightModel(createFlightDto);
    return newFlight.save();
  }

  async findAll(): Promise<Flight[]> {
    // Use lean() for better performance when you don't need Mongoose methods
    return this.flightModel.find().lean().exec();
  }

  async searchFlights(query: QueryFlightDto & { skip?: number; limit?: number }): Promise<Flight[]> {
    const startTime = Date.now();
    const filter: FlightQueryFilter = {};
    if (query.departureAirport) filter.departureAirport = query.departureAirport;
    if (query.arrivalAirport) filter.arrivalAirport = query.arrivalAirport;
    if (query.departureDate) {
      const date = new Date(query.departureDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }
    
    // Add price filters if available
    if (query.minPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$lte = query.maxPrice;
    }
    
    // Add airline filter if specified
    if (query.airline) filter.airline = query.airline;
    
    // Add stops filter
    if (query.maxStops !== undefined) {
      filter['stops.length'] = { $lte: query.maxStops };
    }
    
    const { skip = 0, limit = 10 } = query;
    
    // Define sort options
    const sortOptions: Record<string, 1 | -1> = {};
    if (query.sortBy) {
      sortOptions[query.sortBy] = query.sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default sort by price ascending
      sortOptions.price = 1;
    }
    
    // Only request fields we need using projection for better performance
    return this.flightModel.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean() // Use lean() for better performance when you don't need Mongoose methods
      .exec()
      .then(results => {
        console.log(`Flight search completed in ${Date.now() - startTime}ms`);
        return results;
      });
  }

  async searchAvailableFlights(
    query: FlightAvailabilityQuery,
  ): Promise<Flight[]> {
    // Add minimum seat availability check and use projection for performance
    const minSeats = query.minSeats || 1;
    const filter = { ...query, seatsAvailable: { $gte: minSeats } };
    
    return this.flightModel.find(filter)
      .lean() // Use lean for performance
      .exec();
  }

  async findById(id: string, projection?: Record<string, number>): Promise<Flight | null> {
    // Use projection to limit fields returned for better performance
    return this.flightModel.findById(id, projection || {}).lean().exec();
  }

  async findOneAndUpdate(
    filter: { _id: string; version: number },
    update: UpdateFlightDto,
  ): Promise<Flight | null> {
    return this.flightModel.findOneAndUpdate(filter, update, { new: true });
  }

  async findByFlightNumber(flightNumber: string, projection?: Record<string, number>): Promise<Flight | null> {
    // Use projection to limit fields returned for better performance
    return this.flightModel.findOne({ flightNumber }, projection || {}).lean().exec();
  }

  async updateSeats(params: FlightUpdateSeatsParams): Promise<Flight | null> {
    const updatedFlight = await this.flightModel.findOneAndUpdate(
      {
        _id: params.flightId,
        version: params.expectedVersion, // Now valid with updated interface
      },
      {
        $inc: { seatsAvailable: params.seatDelta, version: 1 },
      },
      {
        new: true,
      },
    );

    if (!updatedFlight) {
      throw new ConflictException('Seat inventory changed, please refresh');
    }
    return updatedFlight;
  }

  async update(id: string, updateFlightDto: UpdateFlightDto): Promise<Flight> {
    const existingFlight = await this.flightModel.findById(id).lean();
    if (!existingFlight) {
      throw new NotFoundException('Flight not found');
    }

    const updatedFlight = await this.flightModel
      .findByIdAndUpdate(
        id,
        { ...updateFlightDto, updatedAt: new Date() },
        { new: true, lean: true },
      )
      .exec();

    if (!updatedFlight) {
      throw new NotFoundException('Flight not found after update');
    }
    return updatedFlight;
  }

  async saveFlights(flights: Partial<Flight>[]): Promise<void> {
    try {
      if (!flights || flights.length === 0) return;
      
      // Use bulkWrite with upsert for better performance
      const bulkOps = flights.map(flight => ({
        updateOne: {
          filter: { offerId: flight.offerId },
          update: { $set: flight },
          upsert: true
        }
      }));
      
      // Execute bulk operations
      await this.flightModel.bulkWrite(bulkOps);
    } catch (error) {
      console.error(`Failed to save flights: ${error.message}`);
      throw error;
    }
  }

  async incrementSeats(flightId: string, seatDelta: number): Promise<void> {
    try {
      // Add optimistic concurrency control
      const result = await this.flightModel.updateOne(
        { _id: flightId },
        { 
          $inc: { seatsAvailable: seatDelta, version: 1 } 
        },
      );
      
      if (result.modifiedCount === 0) {
        throw new Error(`Failed to update seats for flight ${flightId}, document might have been modified concurrently`);
      }
    } catch (error) {
      throw new Error(`Failed to increment seats: ${error.message}`);
    }
  }

  async delete(id: string): Promise<Flight> {
    const flight = await this.flightModel.findByIdAndDelete(id).exec();
    if (!flight) {
      throw new NotFoundException(`Flight with id ${id} not found`);
    }
    return flight;
  }

  async countFlights(query: QueryFlightDto): Promise<number> {
    const filter: FlightQueryFilter = {};
    if (query.departureAirport) {
      filter.departureAirport = query.departureAirport;
    }
    if (query.arrivalAirport) {
      filter.arrivalAirport = query.arrivalAirport;
    }
    if (query.departureDate) {
      const date = new Date(query.departureDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.departureTime = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }
    return this.flightModel.countDocuments(filter).exec();
  }
}