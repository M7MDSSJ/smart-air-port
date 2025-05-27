import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  Logger,
  Query,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { VerifiedUserGuard } from 'src/common/guards/verifiedUser.guard';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @Post('book-flight')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.CREATED)
  async bookFlight(
    @User() user: JwtUser,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    this.logger.log(`Creating booking for user: ${user.id}`);

    // Store booking with all details
    const booking = await this.bookingService.createBooking(
      user.id,
      createBookingDto,
    );

    return {
      success: true,
      message: 'Flight booked successfully',
      data: {
        success: true,
        message: 'Flight booked successfully',
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        status: booking.status,
      },
      error: null,
      meta: null,
    };
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  async getMyBookings(@User() user: JwtUser) {
    const bookings = await this.bookingService.getUserBookings(user.id);

    return {
      success: true,
      message: 'response.success',
      data: {
        success: true,
        bookings,
      },
      error: null,
      meta: null,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBookingDetails(@Param('id') id: string, @User() user: JwtUser) {
    const booking = await this.bookingService.getBookingById(id);
    if (booking.userId.toString() !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to view this booking',
      );
    }

    return {
      success: true,
      message: 'response.success',
      data: {
        success: true,
        booking,
      },
      error: null,
      meta: null,
    };
  }

  @Get('calculate-fee')
  async calculateApplicationFee(@Query('basePrice') basePrice: string) {
    const price = parseFloat(basePrice);

    if (isNaN(price) || price <= 0) {
      return {
        success: false,
        message: 'Invalid base price provided',
        error: 'Bad Request',
        statusCode: 400,
      };
    }

    const calculation = this.bookingService.calculateTotalWithFee(price);

    return {
      success: true,
      message: 'Application fee calculated successfully',
      data: {
        success: true,
        calculation,
      },
      error: null,
      meta: null,
    };
  }
}
