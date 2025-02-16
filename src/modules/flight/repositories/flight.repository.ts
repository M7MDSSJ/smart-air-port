import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flight } from '../schemas/flight.schema';
import { IFlightRepository } from './flight.repository.interface';
import { CreateFlightDto } from '../dto/create-flight.dto';
import { UpdateFlightDto } from '../dto/update-flight.dto';
import { QueryFlightDto } from '../dto/query-flight.dto';

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
    return this.flightModel.find().exec();
  }

  async searchFlights(query: QueryFlightDto): Promise<Flight[]> {
    // Manually pick allowed fields
    const { departureAirport, arrivalAirport, departureDate } = query;
    const sanitizedQuery: Partial<QueryFlightDto> = {
      departureAirport,
      arrivalAirport,
      departureDate,
    };
    return this.flightModel.find(sanitizedQuery).exec();
  }

  async searchAvailableFlights(query: QueryFlightDto): Promise<Flight[]> {
    const criteria = {
      ...query,
      seats: { $gt: 0 },
    };
    return this.flightModel.find(criteria).exec();
  }

  async findById(id: string): Promise<Flight | null> {
    return this.flightModel.findById(id).exec();
  }

  async findByFlightNumber(flightNumber: string): Promise<Flight | null> {
    return this.flightModel.findOne({ flightNumber }).exec();
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

  async delete(id: string): Promise<Flight> {
    const flight = await this.flightModel.findByIdAndDelete(id).exec();
    if (!flight) {
      throw new NotFoundException(`Flight with id ${id} not found`);
    }
    return flight;
  }
}
