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
}
