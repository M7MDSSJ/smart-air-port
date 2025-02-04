import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserSchema } from './schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EmailModule } from 'src/core/auth/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtService, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
