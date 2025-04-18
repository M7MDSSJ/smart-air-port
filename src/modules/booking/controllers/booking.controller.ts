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
  Query,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthGuard } from '@nestjs/passport';
import { BookingDocument } from '../schemas/booking.schema';
import { Request } from 'express';
import { GetUser } from 'src/common/decorators/user.decorator';
import { isMongoId } from 'class-validator';
import { EmailService } from '../../email/email.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BookingResponseDto } from '../dto/booking-response.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { PaginatedBookingsResponseDto } from '../dto/paginated-bookings-response.dto';

@ApiTags('Bookings')
@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly bookingService: BookingService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new booking',
    description:
      'Creates a new booking for the authenticated user. Requires flight details, seat selections, payment provider, and an idempotency key to prevent duplicates. Sends an email notification upon success.',
  })
  @ApiBody({
    type: CreateBookingDto,
    examples: {
      example1: {
        summary: 'Create Booking Example',
        value: {
          flightId: '67bd1121eb2ea3cd9bb865bf',
          seats: [
            { seatNumber: 'B2', class: 'economy', price: 100 },
          ],
          paymentProvider: 'stripe',
          idempotencyKey: 'd1244128-122b-11ee-be56-024123120002',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g., missing idempotency key)',
    type: HttpException,
    example: {
      success: false,
      message: 'Idempotency key is required',
      error: 'Validation Failed',
      statusCode: 400,
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: HttpException,
    example: {
      message: 'Internal error',
      statusCode: 500,
    },
  })
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req: Request,
  ): Promise<BookingResponseDto> {
    try {
      this.logger.log('Received createBooking request');
      this.logger.debug(`Request Body: ${JSON.stringify(createBookingDto)}`);

      if (!createBookingDto.idempotencyKey) {
        throw new BadRequestException('Idempotency key is required');
      }
      const user = req.user as UserDocument;
      if (!user) {
        throw new BadRequestException('User not found in request');
      }
      this.logger.debug(`User ID: ${user._id.toString()}`);
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
        if (!/^([A-Z]\d+|\d+[A-Z])$/.test(seat.seatNumber)) {
          throw new BadRequestException(
            `Invalid seat number format: ${seat.seatNumber}. Use formats like 'A1' or '1A'`
          );
        }
      });
      if (!createBookingDto.paymentProvider) {
        throw new BadRequestException('Payment provider is required');
      }

      const booking = await this.bookingService.createBooking(
        user,
        createBookingDto,
        createBookingDto.idempotencyKey,
      );

      this.logger.log(`Booking created successfully: ${booking.id}`);

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

      return this.transformBookingToResponse(booking);
    } catch (error: unknown) {
      this.logger.error(
        `Error creating booking: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
        throw error;
      }
      throw new HttpException(
        'Internal error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get booking status',
    description: 'Retrieves the status of a booking by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Booking ID',
    example: '67be8671461b2609214e658b',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking status retrieved successfully',
    example: {
      success: true,
      status: 'pending',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: HttpException,
    example: { statusCode: 404, message: 'Booking not found' },
  })
  async getBookingStatus(
    @Param('id') id: string,
  ): Promise<{ success: boolean; status: string }> {
    const status: string = await this.bookingService.getStatus(id);
    return { success: true, status };
  }

  @Post('confirm/:bookingId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm a booking',
    description:
      'Confirms a booking for the authenticated user by its ID. Sends a confirmation email upon success.',
  })
  @ApiParam({
    name: 'bookingId',
    description: 'Booking ID to confirm',
    example: '67be8671461b2609214e658b',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking confirmed successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
    type: HttpException,
    example: { statusCode: 404, message: 'Booking not found' },
  })
  async confirmBooking(
    @Param('bookingId') bookingId: string,
    @GetUser() user: UserDocument,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingService.confirmBooking(
      bookingId,
      user._id.toString(),
    );

    const html = `
      <p>Dear ${user.firstName || 'User'},</p>
      <p>Your booking <strong>${booking.bookingRef || booking.id}</strong> has been confirmed.</p>
      <p>Thank you for choosing our service.</p>
    `;
    await this.emailService.sendImportantEmail(
      user.email,
      'Booking Confirmed - Important Notification',
      html,
    );

    return this.transformBookingToResponse(booking);
  }

  @Get()
  @ApiOperation({
    summary: 'List bookings with pagination and filtering',
    description: 'Retrieve a paginated list of bookings with optional filters',
  })
  @ApiQuery({ type: QueryBookingDto })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved successfully',
    type: PaginatedBookingsResponseDto,
  })
  async getBookings(@Query() queryDto: QueryBookingDto): Promise<PaginatedBookingsResponseDto> {
    const startTime = Date.now();
    try {
      // Add current user's ID to filter if using auth guard
      const result = await this.bookingService.findBookings(queryDto);
      
      // Transform to response DTOs
      const transformedBookings = result.data.map(booking => 
        this.transformBookingToResponse(booking)
      );
      
      this.logger.debug(`Retrieved ${result.data.length} bookings in ${Date.now() - startTime}ms`);
      
      return {
        success: true,
        message: `Retrieved ${result.data.length} bookings`,
        data: transformedBookings,
        meta: result.meta
      };
    } catch (error) {
      this.logger.error(`Failed to get bookings: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve bookings',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('my-bookings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List current user\'s bookings',
    description: 'Retrieve a paginated list of the authenticated user\'s bookings',
  })
  @ApiQuery({ type: QueryBookingDto })
  @ApiResponse({
    status: 200,
    description: 'User\'s bookings retrieved successfully',
    type: PaginatedBookingsResponseDto,
  })
  async getMyBookings(
    @GetUser() user: UserDocument,
    @Query() queryDto: QueryBookingDto
  ): Promise<PaginatedBookingsResponseDto> {
    const startTime = Date.now();
    try {
      // Add current user's ID to filter
      queryDto.userId = user._id.toString();
      const result = await this.bookingService.findBookings(queryDto);
      
      // Transform to response DTOs
      const transformedBookings = result.data.map(booking => 
        this.transformBookingToResponse(booking)
      );
      
      this.logger.debug(`Retrieved ${result.data.length} bookings for user ${user._id} in ${Date.now() - startTime}ms`);
      
      return {
        success: true,
        message: `Retrieved ${result.data.length} of your bookings`,
        data: transformedBookings,
        meta: result.meta
      };
    } catch (error) {
      this.logger.error(`Failed to get user's bookings: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve your bookings',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  private transformBookingToResponse(
    booking: BookingDocument,
  ): BookingResponseDto {
    // TODO: Add audit logging for API actions (who/when/what)

    const plainBooking = booking.toObject ? booking.toObject() : booking;
    return {
      _id: plainBooking._id.toString(),
      bookingRef: plainBooking.bookingRef,
      user: typeof plainBooking.user === 'object' ? plainBooking.user._id.toString() : plainBooking.user.toString(),
      flight: typeof plainBooking.flight === 'object' ? plainBooking.flight._id.toString() : plainBooking.flight.toString(),
      seats: plainBooking.seats.map(seat => ({
        _id: seat._id ? seat._id.toString() : '',
        seatNumber: seat.seatNumber,
        class: seat.class,
        price: seat.price,
      })),
      totalSeats: plainBooking.totalSeats,
      totalPrice: plainBooking.totalPrice,
      status: plainBooking.status,
      paymentProvider: plainBooking.paymentProvider,
      idempotencyKey: plainBooking.idempotencyKey,
      paymentIntentId: plainBooking.paymentIntentId,
      expiresAt: plainBooking.expiresAt?.toISOString ? plainBooking.expiresAt?.toISOString() : plainBooking.expiresAt,
      createdAt: plainBooking.createdAt.toISOString ? plainBooking.createdAt.toISOString() : plainBooking.createdAt,
      updatedAt: plainBooking.updatedAt.toISOString ? plainBooking.updatedAt.toISOString() : plainBooking.updatedAt,
      version: plainBooking.version,
    };
  }
}