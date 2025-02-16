import { Module } from '@nestjs/common';
import { FlightService } from './flight.service';
import { FlightController } from './flight.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightRepository } from './repositories/flight.repository';
import { FlightSchema } from './schemas/flight.schema';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Flight', schema: FlightSchema }]),
  ],
  controllers: [FlightController],
  providers: [FlightService, FlightRepository],
  exports: [FlightService],
})
export class FlightModule {}
