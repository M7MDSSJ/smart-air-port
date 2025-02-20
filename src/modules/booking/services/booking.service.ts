// src/modules/booking/services/booking.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  IBookingRepository,
  BOOKING_REPOSITORY,
} from '../repositories/booking.repository.interface';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CreateBookingInput } from '../dto/create-booking.input';
import { FlightService } from '../../flight/flight.service';
import { PaymentService } from './payment.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { BookingDocument } from '../schemas/booking.schema';
import { PaymentIntent } from '../types/booking.types';
import { Types } from 'mongoose';

function isDuplicateKeyError(error: unknown): error is { code: number } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as { code?: unknown };
  return typeof err.code === 'number';
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly flightService: FlightService,
    private readonly paymentService: PaymentService,
  ) {}

  async createBooking(
    user: UserDocument,
    createBookingDto: CreateBookingDto,
    idempotencyKey: string,
  ): Promise<BookingDocument> {
    // (Optional) Pre-check: if a booking with the given idempotency key already exists, return it.
    // Note: This check is not atomic, so we still need to handle duplicate key errors below.
    const preExisting = await this.bookingRepository.findOne({
      idempotencyKey,
    });
    if (preExisting) return preExisting;

    // 1. Fetch the flight and check seat availability.
    const flight = await this.flightService.findOne(createBookingDto.flightId);
    const availableSeats =
      flight.seatsAvailable - createBookingDto.seats.length;
    if (availableSeats < 0) {
      throw new ConflictException('Not enough available seats');
    }

    // Save the current flight version for optimistic locking.
    const currentVersion = flight.version;

    try {
      // 2. Update seats on the flight using optimistic locking.
      await this.flightService.updateSeats({
        flightId: createBookingDto.flightId,
        seatDelta: -createBookingDto.seats.length,
        expectedVersion: currentVersion,
      });

      // 3. Create a payment intent.
      const paymentIntent: PaymentIntent =
        await this.paymentService.createPaymentIntent({
          amount: createBookingDto.seats.reduce(
            (sum, seat) => sum + seat.price,
            0,
          ),
          currency: 'USD',
          paymentMethod: createBookingDto.paymentProvider,
          metadata: {
            userId: user._id.toString(),
            flightId: createBookingDto.flightId,
          },
        });

      // 4. Prepare the complete booking data.
      const bookingData: CreateBookingInput = {
        ...createBookingDto,
        user: user._id,
        flight: new Types.ObjectId(createBookingDto.flightId),
        status: 'pending', // or use a BookingStatus enum if defined
        totalPrice: paymentIntent.amount,
        totalSeats: createBookingDto.seats.length,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Expires in 30 minutes
        paymentIntentId: paymentIntent.id,
        idempotencyKey, // included in the booking data
      };

      let booking: BookingDocument;

      // Wrap the booking creation in a try/catch block to handle duplicate key errors.
      try {
        booking = await this.bookingRepository.create(bookingData);
      } catch (error: unknown) {
        // Use our type guard to safely access error.code.
        if (isDuplicateKeyError(error) && error.code === 11000) {
          // Fetch the existing booking created by the concurrent request.
          const existing = await this.bookingRepository.findOne({
            idempotencyKey,
          });
          if (existing) return existing;
        }
        // Rethrow if it's not a duplicate key error.
        throw error;
      }

      // Log key metrics.
      this.logger.log(`Booking created: ${booking.id}`);
      return booking;
    } catch (error: unknown) {
      // In case of any error, revert the seat update.
      const flightToRevert = await this.flightService.findOne(
        createBookingDto.flightId,
      );
      await this.flightService.updateSeats({
        flightId: createBookingDto.flightId,
        seatDelta: createBookingDto.seats.length, // revert by adding back the seats
        expectedVersion: flightToRevert.version,
      });

      if (error instanceof Error) {
        throw error;
      } else {
        throw new HttpException(
          'Booking creation failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
  async findExpiredPendingBookings(): Promise<BookingDocument[]> {
    return await this.bookingRepository.find({
      status: 'pending',
      expiresAt: { $lte: new Date() },
    });
  }

  async confirmBooking(bookingId: string): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    // Update the booking status to 'confirmed'
    const updatedBooking = await this.bookingRepository.update(
      { _id: bookingId },
      { status: 'confirmed' },
    );
    return updatedBooking;
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking || booking.user.toString() !== userId) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'confirmed') {
      throw new ConflictException('Only confirmed bookings can be cancelled');
    }

    // Process refund if applicable.
    if (booking.paymentIntentId) {
      await this.paymentService.processRefund(booking.paymentIntentId);
    }

    // Release seats: re-fetch the flight to get its current version.
    const flight = await this.flightService.findOne(booking.flight.toString());
    await this.flightService.updateSeats({
      flightId: booking.flight.toString(),
      seatDelta: booking.totalSeats, // add back the seats
      expectedVersion: flight.version,
    });

    const updatedBooking = await this.bookingRepository.update(
      { _id: bookingId },
      { status: 'cancelled', cancellationReason: 'User requested' },
    );

    if (!updatedBooking) {
      throw new NotFoundException('Booking update failed');
    }

    return updatedBooking;
  }
}
