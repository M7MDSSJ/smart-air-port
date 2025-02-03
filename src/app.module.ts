import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomLogger } from './core/logger/logger.service';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Explicit env file path
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://localhost:27017/test1'), // Fallback value
        retryAttempts: 2, // Basic connection retry
        serverSelectionTimeoutMS: 5000, // Fail fast if no DB
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: CustomLogger,
      useValue: new CustomLogger('AppModule'), // Ensure logger is instantiated
    },
  ],
})
export class AppModule {}
