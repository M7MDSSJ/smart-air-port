import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { FlightService } from 'src/modules/flight/flight.service';
import { EmailService } from 'src/modules/email/email.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
  ) {}

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
      totalPrice: createBookingDto.totalPrice,
      applicationFee: createBookingDto.applicationFee,
      currency: createBookingDto.currency,
      travellersInfo: createBookingDto.travellersInfo,
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
}
