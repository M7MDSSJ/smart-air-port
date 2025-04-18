// src/modules/flight/flight.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { AmadeusService } from './amadeus.service';
import { EmailModule } from '../email/email.module';
import { FlightStatusService } from './flight-status.service';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSchema, SeatHoldSchema } from './schemas/flight.schema';
import { FlightRepository } from './repositories/flight.repository';
import { FLIGHT_REPOSITORY } from './repositories/flight.repository.interface';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule,
    MongooseModule.forFeature([
      { name: 'Flight', schema: FlightSchema },
      { name: 'SeatHold', schema: SeatHoldSchema }
    ]),
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    AmadeusService,
    FlightStatusService,
    FlightRepository,
    {
      provide: FLIGHT_REPOSITORY,
      useClass: FlightRepository
    }
  ],
  exports: [FlightService, AmadeusService, FlightStatusService],
})
export class FlightModule {}