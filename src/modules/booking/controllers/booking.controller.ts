import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto, TravellerInfoDto } from '../dto/create-booking.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { VerifiedUserGuard } from 'src/common/guards/verifiedUser.guard';
import { FastifyRequest } from 'fastify';
import { User } from 'src/common/decorators/user.decorator';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('book-flight')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.CREATED)
  async bookFlight(
    @User() user: any,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    // Extract userId from the JWT payload
    const userId = user.userId;

    // Store booking with all details
    const booking = await this.bookingService.createBooking(userId, createBookingDto);

    return {
      success: true,
      message: 'Flight booked successfully',
      bookingId: booking._id,
      status: booking.status,
    };
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  async getMyBookings(@User() user: any) {
    const userId = user.userId;
    const bookings = await this.bookingService.getUserBookings(userId);

    return {
      success: true,
      bookings,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBookingDetails(@Param('id') id: string, @User() user: any) {
    const booking = await this.bookingService.getBookingById(id);

    // Security check: ensure user can only access their own bookings
    if (booking.userId.toString() !== user.userId) {
      return {
        success: false,
        message: 'You are not authorized to view this booking',
      };
    }

    return {
      success: true,
      booking,
    };
  }
}
