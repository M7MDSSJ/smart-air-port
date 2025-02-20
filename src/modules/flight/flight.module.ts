import { Module } from '@nestjs/common';
import { FlightService } from './flight.service';
import { FlightController } from './flight.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightRepository } from './repositories/flight.repository';
import { FlightSchema } from './schemas/flight.schema';
import { FLIGHT_REPOSITORY } from './repositories/flight.repository.interface';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import Redlock from 'redlock';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Flight', schema: FlightSchema }]),
    ConfigModule, // Import ConfigModule to access environment variables
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    {
      provide: FLIGHT_REPOSITORY,
      useClass: FlightRepository,
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService): Redis => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password =
          configService.get<string>('REDIS_PASSWORD') || undefined; // Ensure it's either a string or undefined

        // Create Redis client options
        const redisOptions: RedisOptions = {
          host,
          port,
          ...(password ? { password } : {}), // Only include password if it's defined
        };

        return new Redis(redisOptions);
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDLOCK',
      useFactory: (redisClient: Redis): Redlock => {
        return new Redlock([redisClient], {
          driftFactor: 0.01,
          retryCount: 10,
          retryDelay: 200,
          retryJitter: 200,
        });
      },
      inject: ['REDIS_CLIENT'],
    },
  ],
  exports: [FlightService],
})
export class FlightModule {}
