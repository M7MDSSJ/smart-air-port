import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { BookingDocument } from '../schemas/booking.schema';
import { Request } from 'express';
import { GetUser } from 'src/common/decorators/user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: Request,
  ) {
    try {
      this.logger.log('Received createBooking request');

      // Log the request body for debugging
      this.logger.log(`Request Body: ${JSON.stringify(createBookingDto)}`);

      if (!createBookingDto.idempotencyKey) {
        throw new BadRequestException('Idempotency key is required');
      }

      // Use the user provided by the JWT strategy
      const user = req.user as UserDocument;
      if (!user) {
        throw new BadRequestException('User not found in request');
      }

      this.logger.log(`User ID: ${user._id.toString()}`);

      const idempotencyKey = createBookingDto.idempotencyKey;
      this.logger.log(`Idempotency Key: ${idempotencyKey}`);

      // Validate flightId
      if (!createBookingDto.flightId) {
        throw new BadRequestException('Flight ID is required');
      }

      // Validate seats
      if (!createBookingDto.seats || createBookingDto.seats.length === 0) {
        throw new BadRequestException('At least one seat is required');
      }

      // Validate paymentProvider
      if (!createBookingDto.paymentProvider) {
        throw new BadRequestException('Payment provider is required');
      }

      const booking = await this.bookingService.createBooking(
        user,
        createBookingDto,
        idempotencyKey,
      );

      this.logger.log(`Booking created successfully: ${booking.id}`);
      return booking;
    } catch (error: unknown) {
      this.logger.error(
        `Error creating booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (error instanceof BadRequestException) {
        throw new HttpException(
          {
            success: false,
            message: error.message,
            error: 'Validation Failed',
            statusCode: 400,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Internal error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('confirm/:bookingId')
  async confirmBooking(
    @Param('bookingId') bookingId: string,
    @GetUser() user: UserDocument,
  ): Promise<BookingDocument> {
    return await this.bookingService.confirmBooking(
      bookingId,
      user._id.toString(),
    );
  }
}
