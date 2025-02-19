import { Module } from '@nestjs/common';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingSchema } from './schemas/booking.schema';
import { FlightModule } from '../flight/flight.module';
import { PaymentService } from './services/payment.service';
import { BOOKING_REPOSITORY } from './repositories/booking.repository.interface';
import { BookingRepository } from './repositories/booking.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Booking', schema: BookingSchema }]),
    FlightModule,
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    PaymentService,
    {
      provide: BOOKING_REPOSITORY,
      useClass: BookingRepository,
    },
  ],
  exports: [BookingService],
})
export class BookingModule {}
