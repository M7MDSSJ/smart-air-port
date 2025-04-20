import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { AmadeusService } from './amadeus.service';
import { FlightStatusService } from './flight-status.service';
import { FlightSearchService } from './flight-search.service';
import { FlightFormattingService } from './flight-formatting.service';
import { SeatHoldService } from './seat-hold.service';
import { BaggageService } from './baggage.service';
import { CacheService } from './cache.service';
import { ExchangeRateService } from './exchange-rate.service';
import { EmailModule } from '../email/email.module';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSchema, SeatHoldSchema } from './schemas/flight.schema';
import { FlightRepository } from './repositories/flight.repository';
import { FLIGHT_REPOSITORY } from './repositories/flight.repository.interface';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';
import { PricingService } from './pricing.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EmailModule,
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
        ttl: configService.get('CACHE_TTL') || 3600,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: 'Flight', schema: FlightSchema },
      { name: 'SeatHold', schema: SeatHoldSchema },
    ]),
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    AmadeusService,
    FlightStatusService,
    FlightSearchService,
    FlightFormattingService,
    SeatHoldService,
    BaggageService,
    CacheService,
    ExchangeRateService,
    PricingService,
    FlightRepository,
    { provide: FLIGHT_REPOSITORY, useClass: FlightRepository },
  ],
  exports: [FlightService, AmadeusService, FlightStatusService,SeatHoldService],
})
export class FlightModule {}