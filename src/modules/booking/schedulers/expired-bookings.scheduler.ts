import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingService } from '../services/booking.service';
import { BookingDocument } from '../schemas/booking.schema';
import { Types } from 'mongoose';

@Injectable()
export class ExpiredBookingsScheduler {
  private readonly logger = new Logger(ExpiredBookingsScheduler.name);

  constructor(private readonly bookingService: BookingService) {}

  @Cron('*/5 * * * *', { name: 'handleExpiredBookings' })
  async handleExpiredBookings(): Promise<void> {
    try {
      const expired: BookingDocument[] =
        await this.bookingService.findExpiredPendingBookings();

      for (const booking of expired) {
        if (!booking.id || !(booking.id instanceof Types.ObjectId)) {
          this.logger.warn(`Invalid booking ID: ${booking.id}`);
          continue;
        }

        if (!booking.user || !(booking.user instanceof Types.ObjectId)) {
          this.logger.warn(
            `Invalid user ID for booking ${booking.id.toString()}: ${booking.user}`,
          );
          continue;
        }

        const bookingId: string = booking.id.toHexString();
        const userId: string = booking.user.toHexString();

        try {
          await this.bookingService.cancelBooking(bookingId, userId);
          this.logger.log(`Cancelled booking ${bookingId} for user ${userId}`);
        } catch (cancelError: unknown) {
          const errorMessage =
            cancelError instanceof Error
              ? cancelError.message
              : 'Unknown error';
          this.logger.error(
            `Failed to cancel booking ${bookingId}: ${errorMessage}`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error handling expired bookings: ${errorMessage}`);
    }
  }
}