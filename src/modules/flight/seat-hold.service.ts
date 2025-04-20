import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Flight, SeatHold } from './schemas/flight.schema';

@Injectable()
export class SeatHoldService {
  private readonly logger = new Logger(SeatHoldService.name);

  constructor(
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
    @InjectModel('SeatHold') private readonly seatHoldModel: Model<SeatHold>,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
  ) {}

  async createSeatHold(flightId: string, seats: number, sessionId: string) {
    if (!Types.ObjectId.isValid(flightId)) {
      this.logger.error(`Invalid flight ID format: ${flightId}`);
      throw new HttpException('Invalid flight ID format', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Attempting to create seat hold for flight ${flightId}, seats: ${seats}, sessionId: ${sessionId}`);

    // Prevent duplicate seat holds for the same session
    const existingHold = await this.seatHoldModel.findOne({ sessionId, expiresAt: { $gt: new Date() } });
    if (existingHold) {
      this.logger.error(`Active seat hold already exists for session ${sessionId}: holdId ${existingHold._id}`);
      throw new HttpException('Active seat hold already exists for this session', HttpStatus.BAD_REQUEST);
    }

    const flight = await this.flightModel.findOneAndUpdate(
      { _id: flightId, seatsAvailable: { $gte: seats } },
      { $inc: { seatsAvailable: -seats, version: 1 } },
      { new: false },
    );

    if (!flight) {
      const existingFlight = await this.flightModel.findById(flightId);
      if (!existingFlight) {
        this.logger.error(`Flight not found: ${flightId}`);
        throw new HttpException('Flight not found', HttpStatus.NOT_FOUND);
      }
      this.logger.error(`Not enough seats available for flight ${flightId}. Requested: ${seats}, Available: ${existingFlight.seatsAvailable}`);
      throw new HttpException('Not enough seats available', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Updated flight ${flightId}: seatsAvailable=${flight.seatsAvailable - seats}, version=${flight.version + 1}`);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const seatHold = new this.seatHoldModel({ flightId: flight._id, seats, sessionId, expiresAt });
    await seatHold.save();

    this.logger.debug(`Created seat hold ${seatHold._id} for flight ${flightId}`);

    // Invalidate flight-related cache
    const cacheKey = `flights:*`;
    try {
      await this.cacheService.del(cacheKey);
      this.logger.debug(`Invalidated cache for key pattern ${cacheKey}`);
    } catch (err) {
      this.logger.error(`Failed to invalidate cache for ${cacheKey}: ${err.message}`);
    }

    // Verify update
    const updatedFlight = await this.flightModel.findById(flightId).select('seatsAvailable version');
    this.logger.debug(`Post-update: seatsAvailable=${updatedFlight.seatsAvailable}, version=${updatedFlight.version}`);

    return { holdId: seatHold._id, flightId, seats, expiresAt };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredHolds() {
    const now = new Date();
    const expiredHolds = await this.seatHoldModel.find({ expiresAt: { $lt: now } });

    if (expiredHolds.length === 0) {
      this.logger.log('No expired seat holds to clean up');
      return;
    }

    let successCount = 0;
    for (const hold of expiredHolds) {
      try {
        let flight;
        if (Types.ObjectId.isValid(hold.flightId)) {
          flight = await this.flightModel.findById(hold.flightId);
        }
        if (!flight) {
          this.logger.warn(`Flight not found for seat hold ${hold._id} with flightId ${hold.flightId}`);
          await this.seatHoldModel.deleteOne({ _id: hold._id });
          continue;
        }

        await this.flightModel.updateOne(
          { _id: flight._id },
          { $inc: { seatsAvailable: hold.seats, version: 1 } },
        );
        await this.seatHoldModel.deleteOne({ _id: hold._id });
        this.logger.log(`Released ${hold.seats} seats for flight ${flight.offerId}`);
        successCount++;

        // Invalidate cache after releasing seats
        const cacheKey = `flights:*`;
        try {
          await this.cacheService.del(cacheKey);
          this.logger.debug(`Invalidated cache for key pattern ${cacheKey}`);
        } catch (err) {
          this.logger.error(`Failed to invalidate cache for ${cacheKey}: ${err.message}`);
        }
      } catch (err) {
        this.logger.error(`Failed to process expired hold ${hold._id}: ${err.message}`);
      }
    }
    this.logger.log(`Cleaned up ${expiredHolds.length} expired seat holds, successfully processed ${successCount}`);
  }

  async cleanupAllSeatHolds() {
    const result = await this.seatHoldModel.deleteMany({});
    this.logger.log(`Cleaned up all ${result.deletedCount} seat holds`);

    // Invalidate cache after cleanup
    const cacheKey = `flights:*`;
    try {
      await this.cacheService.del(cacheKey);
      this.logger.debug(`Invalidated cache for key pattern ${cacheKey}`);
    } catch (err) {
      this.logger.error(`Failed to invalidate cache for ${cacheKey}: ${err.message}`);
    }

    return { success: true, count: result.deletedCount };
  }

  async fixSeatHoldFlightIds() {
    const seatHolds = await this.seatHoldModel.find({}).lean();
    for (const hold of seatHolds) {
      if (!Types.ObjectId.isValid(hold.flightId)) {
        const flight = await this.flightModel.findOne({ offerId: hold.flightId }).lean();
        if (flight) {
          await this.seatHoldModel.updateOne(
            { _id: hold._id },
            { $set: { flightId: flight._id } },
          );
          this.logger.log(`Fixed flightId for seat hold ${hold._id}: ${hold.flightId} -> ${flight._id}`);
        } else {
          this.logger.warn(`No matching flight found for seat hold ${hold._id} with flightId ${hold.flightId}`);
        }
      }
    }
    this.logger.log('Finished fixing seat hold flightIds');
  }
}