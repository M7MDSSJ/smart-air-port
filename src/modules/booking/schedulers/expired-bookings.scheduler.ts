import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingService } from '../services/booking.service';
import { BookingDocument } from '../schemas/booking.schema';

@Injectable()
export class ExpiredBookingsScheduler {
  private readonly logger = new Logger(ExpiredBookingsScheduler.name);

  constructor(private readonly bookingService: BookingService) {}
  @Cron('0 * * * * *')
  async handleExpiredBookings(): Promise<void> {
    try {
      const expired: BookingDocument[] =
        await this.bookingService.findExpiredPendingBookings();
      for (const booking of expired) {
        // Check if booking.user exists and is an object with an id property
        if (
          !booking.user ||
          typeof booking.user !== 'object' ||
          !booking.user.toString
        ) {
          this.logger.warn(
            `Invalid booking.user value for booking ID ${booking.id}: ${booking.user?.toString()}`,
          );
          continue; // Skip this booking and continue with the next
        }

        const userId: string = booking.user.toString();
        try {
          await this.bookingService.cancelBooking(String(booking.id), userId);
          this.logger.log(
            `Cancelled booking ID ${booking.id} for user ID ${userId}`,
          );
        } catch (cancelError: unknown) {
          // Check if cancelError has a message property
          const errorMessage =
            cancelError instanceof Error
              ? cancelError.message
              : 'Unknown error';
          this.logger.error(
            `Failed to cancel booking ID ${booking.id}: ${errorMessage}`,
          );
        }
      }
    } catch (error: unknown) {
      // Check if error has a message property
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error while handling expired bookings: ${errorMessage}`,
      );
    }
  }
}
