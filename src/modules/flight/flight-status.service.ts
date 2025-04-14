import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flight } from './schemas/flight.schema';
import { AmadeusService } from './amadeus.service';

@Injectable()
export class FlightStatusService {
  private readonly logger = new Logger(FlightStatusService.name);

  constructor(
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    private readonly amadeusService: AmadeusService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES) // Every 10 minutes
  async updateFlightStatuses(): Promise<void> {
    this.logger.log('Starting flight status update job');
    const flights = await this.flightModel
      .find({ departureTime: { $gt: new Date() } })
      .exec();

    for (const flight of flights) {
      try {
        const status = await this.amadeusService.getFlightStatus(flight.flightNumber);
        await this.flightModel.updateOne(
          { _id: flight._id },
          { $set: { status, updatedAt: new Date() } },
        ).exec();
        this.logger.log(`Updated status for flight ${flight.flightNumber} to ${status}`);
      } catch (error) {
        this.logger.error(`Failed to update status for flight ${flight.flightNumber}: ${(error as Error).message}`);
      }
    }
    this.logger.log('Completed flight status update job');
  }

  async getFlightStatus(flightNumber: string, departureTime: Date): Promise<string> {
    try {
      const status = await this.amadeusService.getFlightStatus(flightNumber);
      await this.flightModel.updateOne(
        { flightNumber, departureTime },
        { $set: { status, updatedAt: new Date() } },
      ).exec();
      return status;
    } catch (error) {
      this.logger.error(`Failed to get status for flight ${flightNumber}: ${(error as Error).message}`);
      return '';
    }
  }
}