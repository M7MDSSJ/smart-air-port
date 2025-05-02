import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { FlightService } from 'src/modules/flight/flight.service';
import { EmailService } from 'src/modules/email/email.service';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
  ) {}

  async createBooking(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingDocument> {
    // Generate unique keys if not provided
    let idempotencyKey = createBookingDto.idempotencyKey;
    if (!idempotencyKey) {
      idempotencyKey = `booking_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    let bookingRef = createBookingDto.bookingRef;
    if (!bookingRef) {
      bookingRef = `ref_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    // Create the booking with all details from DTO
    const newBooking = new this.bookingModel({
      userId, // This comes from the JWT token
      flightId: createBookingDto.flightID, // This is a string from Amadeus
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
      status: 'pending', // Default status
      idempotencyKey,
      bookingRef,
    });

    // Save and return the booking
    const savedBooking = await newBooking.save();
    
    // Could add email notification here if needed
    // await this.emailService.sendImportantEmail(user.email, 'Booking Confirmation', ...);
    
    return savedBooking;
  }

  async getUserBookings(userId: string): Promise<BookingDocument[]> {
    return this.bookingModel.find({ userId }).exec();
  }

  async getBookingById(bookingId: string): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }
    return booking;
  }
}
