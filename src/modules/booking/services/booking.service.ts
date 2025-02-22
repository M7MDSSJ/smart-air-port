// src/modules/booking/services/booking.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  OnModuleInit,
  BadRequestException,
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
import { EventBus } from 'src/common/event-bus.service';
import { Types, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

function isDuplicateKeyError(error: unknown): error is { code: number } {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as { code?: unknown };
  return typeof err.code === 'number';
}

@Injectable()
export class BookingService implements OnModuleInit {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: IBookingRepository,
    private readonly flightService: FlightService,
    private readonly paymentService: PaymentService,
    private readonly eventBus: EventBus,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'payment.succeeded',
      (data: { paymentIntentId: string }) => {
        void (async () => {
          try {
            await this.confirmBookingByPayment(data.paymentIntentId);
          } catch (error) {
            this.logger.error(
              `Failed to confirm booking: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        })();
      },
    );

    this.eventBus.subscribe(
      'payment.failed',
      (data: { paymentIntentId: string; reason: string }) => {
        void (async () => {
          try {
            await this.failBooking(data.paymentIntentId, data.reason);
          } catch (error) {
            this.logger.error(
              `Failed to mark booking as failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        })();
      },
    );
  }

  async createBooking(
    user: UserDocument,
    createBookingDto: CreateBookingDto,
    idempotencyKey: string,
  ): Promise<BookingDocument> {
    const session = await this.connection.startSession();
    session.startTransaction();
    const flight = await this.flightService.findOne(createBookingDto.flightId);
    const currentVersion = flight.version; // Current flight version

    try {
      // Check for an existing booking with the same idempotency key.
      const preExisting = await this.bookingRepository.findOne({
        idempotencyKey,
      });
      if (preExisting) {
        // If the flight IDs differ, reject the request.
        if (preExisting.flight.toString() !== createBookingDto.flightId) {
          throw new ConflictException(
            'Idempotency key has already been used for a different booking.',
          );
        }
        await session.commitTransaction();
        return preExisting;
      }

      // Re-fetch the flight for consistency.
      const flightAfterCheck = await this.flightService.findOne(
        createBookingDto.flightId,
      );

      // Strict price validation
      for (const seat of createBookingDto.seats) {
        if (seat.price !== flightAfterCheck.price) {
          throw new BadRequestException(
            `Seat ${seat.seatNumber} price must match flight price of ${flightAfterCheck.price}`,
          );
        }
      }

      // Optionally update each seat's price to match the flight's price if needed.
      for (const seat of createBookingDto.seats) {
        if (seat.price !== flightAfterCheck.price) {
          this.logger.warn(
            `Seat price ${seat.price} does not match flight price ${flightAfterCheck.price}. Updating seat price to match flight price.`,
          );
          seat.price = flightAfterCheck.price;
        }
      }

      const availableSeats =
        flightAfterCheck.seatsAvailable - createBookingDto.seats.length;
      if (availableSeats < 0) {
        throw new ConflictException('Not enough available seats');
      }

      const currentVersionAfterCheck = flightAfterCheck.version;
      await this.flightService.updateSeats({
        flightId: createBookingDto.flightId,
        seatDelta: -createBookingDto.seats.length,
        expectedVersion: currentVersionAfterCheck,
      });

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

      const bookingData: CreateBookingInput = {
        ...createBookingDto,
        user: user._id,
        flight: new Types.ObjectId(createBookingDto.flightId),
        status: 'pending',
        totalPrice: paymentIntent.amount,
        totalSeats: createBookingDto.seats.length,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        paymentIntentId: paymentIntent.id,
        idempotencyKey,
      };

      let booking: BookingDocument;
      try {
        booking = await this.bookingRepository.create(bookingData);
      } catch (error: unknown) {
        if (isDuplicateKeyError(error) && error.code === 11000) {
          const existing = await this.bookingRepository.findOne({
            idempotencyKey,
          });
          if (existing) {
            await session.commitTransaction();
            return existing;
          }
        }
        throw error;
      }

      this.logger.log({
        event: 'booking_created',
        bookingId: String(booking.id),
        userId: user._id.toString(),
        seats: booking.totalSeats,
      });

      await session.commitTransaction();
      return booking;
    } catch (error: unknown) {
      await session.abortTransaction();
      if (createBookingDto?.seats) {
        await this.flightService
          .updateSeats({
            flightId: createBookingDto.flightId,
            seatDelta: createBookingDto.seats.length,
            expectedVersion: currentVersion,
          })
          .catch((rollbackError) => {
            this.logger.error('Seat rollback failed', rollbackError);
          });
      }
      if (error instanceof Error) throw error;
      throw new HttpException(
        'Booking creation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      void session.endSession();
    }
  }

  public async confirmBooking(
    bookingId: string,
    userId: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking || booking.user.toString() !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.paymentIntentId) {
      throw new NotFoundException('Payment intent not found for booking');
    }
    await this.paymentService.confirmPayment(
      booking.paymentIntentId,
      booking.totalPrice,
    );
    return this.bookingRepository.update(
      { _id: bookingId },
      { status: 'confirmed' },
    );
  }

  public async confirmBookingByPayment(
    paymentIntentId: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findOne({ paymentIntentId });
    if (!booking) {
      throw new NotFoundException(
        `Booking not found for payment intent: ${paymentIntentId}`,
      );
    }

    // Only update if the booking is pending
    if (booking.status !== 'pending') {
      this.logger.warn(
        `Booking ${booking.id} is not pending (current status: ${booking.status}). Skipping confirmation.`,
      );
      return booking;
    }

    const updatedBooking = await this.bookingRepository.update(
      { _id: booking.id },
      { status: 'confirmed' },
    );
    this.logger.log(`Booking confirmed via payment: ${updatedBooking.id}`);
    return updatedBooking;
  }

  async getStatus(bookingId: string): Promise<string> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking.status;
  }

  async failBooking(
    paymentIntentId: string,
    reason: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findOne({ paymentIntentId });
    if (!booking) {
      throw new NotFoundException(
        `Booking not found for payment intent: ${paymentIntentId}`,
      );
    }
    const updatedBooking = await this.bookingRepository.update(
      { _id: booking.id },
      { status: 'failed', failureReason: reason },
    );
    this.logger.warn(
      `Booking marked as failed via payment: ${updatedBooking.id}, Reason: ${reason}`,
    );
    return updatedBooking;
  }

  // NEW: Find all expired pending bookings
  async findExpiredPendingBookings(): Promise<BookingDocument[]> {
    return this.bookingRepository.find({
      status: 'pending',
      expiresAt: { $lte: new Date() },
    });
  }

  async retryPayment(bookingId: string): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Allow retry only if booking status is "failed"
    if (booking.status !== 'failed') {
      throw new ConflictException(
        'Payment retry is allowed only for failed bookings',
      );
    }

    const flight = await this.flightService.findOne(booking.flight.toString());
    if (!flight) {
      throw new NotFoundException('Associated flight not found');
    }

    const newPaymentIntent = await this.paymentService.createPaymentIntent({
      amount: booking.totalPrice,
      currency: 'USD',
      paymentMethod: booking.paymentProvider,
      metadata: {
        userId: booking.user.toString(),
        flightId: String(flight._id),
      },
    });

    const updatedBooking = await this.bookingRepository.update(
      { _id: booking.id },
      { paymentIntentId: newPaymentIntent.id, status: 'pending' },
    );

    this.logger.log(
      `Payment retried for booking ${booking.id}. New Payment Intent: ${newPaymentIntent.id}`,
    );
    return updatedBooking;
  }

  // NEW: Cancel a booking (for expired or user-requested cancellation)
  async cancelBooking(
    bookingId: string,
    userId: string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking || booking.user.toString() !== userId) {
      throw new NotFoundException('Booking not found');
    }
    // Allow cancellation if confirmed or if pending and expired
    if (
      booking.status === 'confirmed' ||
      (booking.status === 'pending' &&
        booking.expiresAt &&
        booking.expiresAt <= new Date())
    ) {
      if (booking.paymentIntentId) {
        try {
          await this.paymentService.processRefund(booking.paymentIntentId);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Refund attempt failed: ${errorMessage}`);
        }
      }
      // Release seats
      const flight = await this.flightService.findOne(
        booking.flight.toString(),
      );
      await this.flightService.updateSeats({
        flightId: booking.flight.toString(),
        seatDelta: booking.totalSeats,
        expectedVersion: flight.version,
      });
      return this.bookingRepository.update(
        { _id: bookingId },
        {
          status: 'cancelled',
          cancellationReason:
            booking.status === 'pending' ? 'Expired' : 'User requested',
        },
      );
    }
    throw new ConflictException('Booking cannot be cancelled');
  }
}
