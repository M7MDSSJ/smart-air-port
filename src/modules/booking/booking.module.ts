import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingModule],
})
export class BookingModule {}
