import { Injectable, NotFoundException, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { FlightService } from 'src/modules/flight/flight.service';
import { EmailService } from 'src/modules/email/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly bookingTimeoutMinutes: number;

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.bookingTimeoutMinutes = this.configService.get<number>('BOOKING_TIMEOUT_MINUTES', 5);
    this.logger.log(`Booking timeout set to ${this.bookingTimeoutMinutes} minutes`);
  }

  async createBooking(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingDocument> {
    this.logger.log(`Creating booking for userId: ${userId}`);

    // Generate a unique bookingRef if not provided
    let bookingRef = createBookingDto.bookingRef;
    if (!bookingRef) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const prefix =
        letters.charAt(Math.floor(Math.random() * letters.length)) +
        letters.charAt(Math.floor(Math.random() * letters.length));
      const numbers = Math.floor(Math.random() * 900000) + 100000;
      bookingRef = `${prefix}${numbers}`;
    }

    // Use the provided total price as the final amount
    // The frontend/mobile app should calculate and include the application fee
    // before sending the request
    const finalTotalPrice = createBookingDto.totalPrice;

    this.logger.log(
      `Creating booking with total price: ${finalTotalPrice} ${createBookingDto.currency}`,
    );

    // Create booking object
    const newBooking = new this.bookingModel({
      userId: new Types.ObjectId(userId),
      flightId: createBookingDto.flightID,
      originAirportCode: createBookingDto.originAirportCode,
      destinationAirportCode: createBookingDto.destinationAirportCode,
      originCity: createBookingDto.originCIty,
      destinationCity: createBookingDto.destinationCIty,
      departureDate: new Date(createBookingDto.departureDate),
      arrivalDate: new Date(createBookingDto.arrivalDate),
      selectedBaggageOption: createBookingDto.selectedBaggageOption || null,
      totalPrice: finalTotalPrice, // Use the provided total price as-is
      currency: createBookingDto.currency,
      travellersInfo: createBookingDto.travellersInfo,
      contactDetails: createBookingDto.contactDetails,
      status: 'pending',
      bookingRef,
    });

    try {
      const savedBooking = await newBooking.save();
      this.logger.log(
        `Booking created successfully with ID: ${savedBooking._id.toString()}`,
      );
      return savedBooking;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to create booking: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Failed to create booking with unknown error');
      }
      throw error;
    }
  }

  async getUserBookings(userId: string): Promise<BookingDocument[]> {
    return this.bookingModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }
  async getBookingById(bookingId: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new NotFoundException(`Invalid booking ID format`);
    }

    const booking = await this.bookingModel
      .findById(new Types.ObjectId(bookingId))
      .exec();

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return booking;
  }

  /**
   * Calculate application fee based on base price
   * This is a public method that can be used by frontend/mobile to calculate the fee
   * You can customize this logic based on your business requirements
   */
  public calculateApplicationFee(basePrice: number): number {
    // Example: 2.5% application fee with minimum $5 and maximum $50
    const feePercentage = 0.025; // 2.5%
    const minFee = 5;
    const maxFee = 50;

    let fee = basePrice * feePercentage;
    fee = Math.max(fee, minFee); // Ensure minimum fee
    fee = Math.min(fee, maxFee); // Ensure maximum fee

    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate total price including application fee
   * This method can be used by frontend/mobile to get the final total
   */
  public calculateTotalWithFee(basePrice: number): {
    basePrice: number;
    applicationFee: number;
    totalPrice: number;
  } {
    const applicationFee = this.calculateApplicationFee(basePrice);
    const totalPrice = basePrice + applicationFee;

    return {
      basePrice: Math.round(basePrice * 100) / 100,
      applicationFee,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePendingBookingsTimeout() {
    const timeoutDate = new Date(Date.now() - this.bookingTimeoutMinutes * 60 * 1000);

    try {
      const result = await this.bookingModel.updateMany(
        {
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: { $lt: timeoutDate }
        },
        {
          $set: {
            status: 'cancelled',
            paymentStatus: 'failed'
          }
        }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Cancelled ${result.modifiedCount} pending bookings due to timeout`);
        
        // Get the cancelled bookings to send notifications
        const cancelledBookings = await this.bookingModel.find({
          status: 'cancelled',
          paymentStatus: 'failed',
          updatedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        });

        // Send notifications for each cancelled booking
        for (const booking of cancelledBookings) {
          try {
            const html = `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Booking Cancelled - Payment Timeout</h2>
                <p>Your booking (${booking.bookingRef}) has been cancelled due to payment timeout.</p>
                <p>Please try booking again if you still wish to proceed.</p>
                <p style="margin-top: 20px; color: #666;">
                  Best regards,<br>
                  The Airport Team
                </p>
              </div>
            `;

            await this.emailService.sendImportantEmail(
              booking.contactDetails.email,
              'Booking Cancelled - Payment Timeout',
              html
            );
          } catch (emailError) {
            this.logger.error(`Failed to send cancellation email for booking ${booking.bookingRef}:`, emailError);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error handling pending bookings timeout:', error);
    }
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<BookingDocument> {
    this.logger.log(`Attempting to cancel booking ${bookingId} for user ${userId}`);

    // 1. Find and validate booking
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 2. Verify ownership
    if (booking.userId.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to cancel this booking');
    }

    // 3. Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    // 4. Check if booking is in a cancellable state
    if (booking.status !== 'confirmed') {
      throw new BadRequestException('This booking cannot be cancelled');
    }

    // 5. Update booking status
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date()
        }
      },
      { new: true }
    );

    // 6. Send cancellation notification
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Booking Cancelled</h2>
          <p>Your booking (${booking.bookingRef}) has been cancelled.</p>
          ${reason ? `<p>Cancellation reason: ${reason}</p>` : ''}
          <p style="margin-top: 20px; color: #666;">
            Best regards,<br>
            The Airport Team
          </p>
        </div>
      `;

      await this.emailService.sendImportantEmail(
        booking.contactDetails.email,
        'Booking Cancelled',
        html
      );
    } catch (emailError) {
      this.logger.error(`Failed to send cancellation email for booking ${booking.bookingRef}:`, emailError);
    }

    this.logger.log(`Booking ${bookingId} cancelled successfully`);
    return updatedBooking;
  }
}
