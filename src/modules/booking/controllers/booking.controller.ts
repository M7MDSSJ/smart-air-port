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
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { BookingDocument } from '../schemas/booking.schema';
import { Request } from 'express';

@UseGuards(AuthGuard('jwt'))
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: Request, // Extract the authenticated user from the request
  ): Promise<any> {
    try {
      if (!createBookingDto.idempotencyKey) {
        throw new HttpException(
          'Idempotency key is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      // Use the user provided by the JWT strategy
      const user = req.user as UserDocument;
      const idempotencyKey = createBookingDto.idempotencyKey;
      return this.bookingService.createBooking(
        user,
        createBookingDto,
        idempotencyKey,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('confirm/:bookingId')
  async confirmBooking(
    @Param('bookingId') bookingId: string,
  ): Promise<BookingDocument> {
    return this.bookingService.confirmBooking(bookingId);
  }
}
