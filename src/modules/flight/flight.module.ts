import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { AmadeusService } from './amadeus.service';
import { FlightStatusService } from './flight-status.service';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { FlightSchema, Flight, SeatHoldSchema, SeatHold } from './schemas/flight.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD') || undefined,
        ttl: 3600,
      }),
      inject: [ConfigService],
    }),
    EmailModule,
    AuthModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Flight.name, schema: FlightSchema },
      { name: SeatHold.name, schema: SeatHoldSchema },
    ]),
  ],
  controllers: [FlightController],
  providers: [FlightService, AmadeusService,FlightStatusService,EmailService],
  exports: [FlightService],
})
export class FlightModule {}