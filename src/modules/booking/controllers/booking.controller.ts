// src/modules/booking/controllers/booking.controller.ts
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
  Get,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { BookingDocument } from '../schemas/booking.schema';
import { Request } from 'express';
import { GetUser } from 'src/common/decorators/user.decorator';
import { isMongoId } from 'class-validator';
import { instanceToPlain } from 'class-transformer';
import { EmailService } from '../../email/email.service';

@UseGuards(AuthGuard('jwt'))
@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly bookingService: BookingService,
    private readonly emailService: EmailService, // Inject EmailService
  ) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: Request,
  ): Promise<BookingDocument> {
    try {
      this.logger.log('Received createBooking request');
      this.logger.log(`Request Body: ${JSON.stringify(createBookingDto)}`);

      if (!createBookingDto.idempotencyKey) {
        throw new BadRequestException('Idempotency key is required');
      }

      const user = req.user as UserDocument;
      if (!user) {
        throw new BadRequestException('User not found in request');
      }
      this.logger.log(`User ID: ${user._id.toString()}`);

      const idempotencyKey = createBookingDto.idempotencyKey;
      this.logger.log(`Idempotency Key: ${idempotencyKey}`);

      if (!createBookingDto.flightId) {
        throw new BadRequestException('Flight ID is required');
      }

      if (!isMongoId(createBookingDto.flightId)) {
        throw new BadRequestException('Invalid flight ID format');
      }

      if (!createBookingDto.seats || createBookingDto.seats.length === 0) {
        throw new BadRequestException('At least one seat is required');
      }

      createBookingDto.seats.forEach((seat) => {
        if (!/^[A-Z]\d+$/.test(seat.seatNumber)) {
          throw new BadRequestException(
            `Invalid seat number format: ${seat.seatNumber}`,
          );
        }
      });

      if (!createBookingDto.paymentProvider) {
        throw new BadRequestException('Payment provider is required');
      }

      const booking = await this.bookingService.createBooking(
        user,
        createBookingDto,
        idempotencyKey,
      );

      this.logger.log(`Booking created successfully: ${booking.id}`);

      // Send an important email notification to the user.
      const html = `
        <p>Dear ${user.firstName || 'User'},</p>
        <p>Your booking <strong>${booking.id}</strong> has been created and is pending confirmation.</p>
        <p>Thank you for choosing our service.</p>
      `;
      await this.emailService.sendImportantEmail(
        user.email,
        'Booking Created - Important Notification',
        html,
      );

      return instanceToPlain(booking.toObject()) as BookingDocument;
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
      } else if (error instanceof HttpException) {
        // Preserve original HttpException status codes (e.g., 409 Conflict)
        throw error;
      }
      throw new HttpException(
        'Internal error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/status')
  async getBookingStatus(
    @Param('id') id: string,
  ): Promise<{ success: boolean; status: string }> {
    const status: string = await this.bookingService.getStatus(id);
    return { success: true, status };
  }

  @Post('confirm/:bookingId')
  async confirmBooking(
    @Param('bookingId') bookingId: string,
    @GetUser() user: UserDocument,
  ): Promise<BookingDocument> {
    const booking = await this.bookingService.confirmBooking(
      bookingId,
      user._id.toString(),
    );

    // Notify the user about the booking confirmation.
    const html = `
      <p>Dear ${user.firstName || 'User'},</p>
      <p>Your booking <strong>${booking.id}</strong> has been confirmed.</p>
      <p>Thank you for choosing our service.</p>
    `;
    await this.emailService.sendImportantEmail(
      user.email,
      'Booking Confirmed - Important Notification',
      html,
    );

    return instanceToPlain(booking.toObject()) as BookingDocument;
  }
}
