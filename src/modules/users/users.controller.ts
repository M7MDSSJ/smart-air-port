import {
  Controller,
  Post,
  Body,
  Put,
  UseGuards,
  Get,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { UserManagementService } from './services/user-management.service';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password.service';
import { CreateUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserDocument } from './schemas/user.schema';
import { GetUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    return this.userManagementService.verifyEmail(token);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(
    @GetUser() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    const userId = user._id ? user._id.toString() : null;
    if (!userId) {
      throw new Error('User ID is required');
    }
    return this.passwordResetService.changePassword(userId, changePasswordDto);
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@GetUser() user: UserDocument) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.getProfile(user._id.toString());
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @GetUser() user: UserDocument,
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.userManagementService.logout(user._id.toString(), refreshToken);
  }

  @Get('admin-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }
  @Get('flight-management')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }
  @Patch('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto, // User ID and roles are now passed in the body
    @GetUser() currentUser: UserDocument, // Get the currently authenticated user (admin)
  ) {
    return this.authService.updateRoles(
      updateUserRolesDto.userId, // Use userId from the body
      updateUserRolesDto, // The roles to update
      currentUser, // The current user who is performing the update (should be admin)
    );
  }
}
