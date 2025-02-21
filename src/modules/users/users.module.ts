import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UserRepository } from './repositories/user.repository';
import { PasswordResetService } from './services/password.service';
import { AuthenticationService } from './services/authentication.service';
import { UserManagementService } from './services/user-management.service';
import { UserSchema } from './schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EmailModule } from 'src/modules/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [
    AuthenticationService,
    UserManagementService,
    PasswordResetService,
    JwtService,
    JwtAuthGuard,
    { provide: 'IUserRepository', useClass: UserRepository }, // Provider declaration
  ],
  exports: [
    // Add this line to export the repository
    'IUserRepository',
    UserManagementService,
    PasswordResetService,
    AuthenticationService,
  ],
})
export class UsersModule {}
