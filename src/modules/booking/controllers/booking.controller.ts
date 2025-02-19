// src/modules/booking/controllers/booking.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { BookingDocument } from '../schemas/booking.schema';

@UseGuards(AuthGuard('jwt'))
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<any> {
    try {
      // Replace with your actual user extraction logic.
      const dummyUser = { _id: 'USER_OBJECT_ID' } as UserDocument;
      const idempotencyKey = createBookingDto.idempotencyKey ?? 'default-key';
      return this.bookingService.createBooking(
        dummyUser,
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
