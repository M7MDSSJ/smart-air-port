// src/modules/booking/booking.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './services/booking.service';
import { BookingController } from './controllers/booking.controller';
import { BookingSchema } from './schemas/booking.schema';
import { FlightModule } from '../flight/flight.module';
import { PaymentService } from './services/payment.service';
import { BOOKING_REPOSITORY } from './repositories/booking.repository.interface';
import { BookingRepository } from './repositories/booking.repository';
import { ExpiredBookingsScheduler } from './schedulers/expired-bookings.scheduler';
import { EventBus } from 'src/common/event-bus.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Booking', schema: BookingSchema }]),
    FlightModule,
    AuthModule,
  ],
  controllers: [BookingController, PaymentController],
  providers: [
    BookingService,
    PaymentService,
    EventBus,
    ExpiredBookingsScheduler,
    {
      provide: BOOKING_REPOSITORY,
      useClass: BookingRepository,
    },
  ],
  exports: [BookingService],
})
export class BookingModule {}
