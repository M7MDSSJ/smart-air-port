<<<<<<< HEAD
import { Controller, Post, Body, Put, UseGuards, Get, Patch, UnauthorizedException, Param, Delete, BadRequestException } from '@nestjs/common';
=======
import { Controller, Post, Body, Put, UseGuards, Get, Patch, Param, Delete } from '@nestjs/common';
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
import { AuthGuard } from '@nestjs/passport';
import { UserManagementService } from './services/user-management.service';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password.service';
import { CreateUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { RequestResetPasswordDto } from './dto/request-reset-password.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { User } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('all')
  async getAllUsers() {
    return this.userManagementService.getAllUsers();
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.userManagementService.verifyEmail( verifyEmailDto.email, verifyEmailDto.code );
  }

  @Post('resend-verification')
  async resendVerificationEmail( @Body() resendEmailDto: ResendEmailVerificationDto ) {
    return this.userManagementService.resendVerificationEmail(resendEmailDto.email);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @UseGuards(AuthGuard('jwt'))
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @UseGuards(AuthGuard('jwt'))
  @Put('change-password')
  async changePassword(
    @User() user: JwtUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.passwordResetService.changePassword(user.id, changePasswordDto);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestResetPasswordDto,
  ) {
    return this.passwordResetService.requestPasswordReset(requestPasswordResetDto.email);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@User() user: JwtUser) {
    return this.userManagementService.getProfile(user.id);
  }

<<<<<<< HEAD
=======


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile( @User() user: JwtUser, @Body() updateProfileDto: UpdateProfileDto ): Promise<ProfileResponseDto> {
    return this.userManagementService.updateProfile( user.id.toString(), updateProfileDto );
  }

<<<<<<< HEAD
  //////// continu from here //////////
  //////// continu from here //////////
  //////// continu from here //////////

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(
    @User() user: JwtUser,
    @Body('refreshToken') refreshToken: string,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.logout(user.id, refreshToken);
  }

=======


  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout( @User() user: JwtUser, @Body('refreshToken') refreshToken: string ) {
    return this.userManagementService.logout(user.id, refreshToken);
  }


>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
  @Delete(':email')
  async deleteUserByEmail(@Param('email') email: string) {
    return this.userManagementService.deleteUserByEmail(email);
  }

<<<<<<< HEAD
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('admin-dashboard')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }
=======


  //////// not used //////////
  //////// not used //////////
  //////// not used //////////
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('admin-dashboard')
  getAdminDashboard() { return { message: 'Admin-only content' }; }
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('flight-management')
<<<<<<< HEAD
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }
=======
  manageFlights() { return { message: 'Flight management dashboard' }; }
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Patch('roles')
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @User() currentUser: JwtUser,
  ) {
<<<<<<< HEAD
    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException('Unauthorized');
    }
=======
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53
    return this.authService.updateRoles(
      updateUserRolesDto.email,
      updateUserRolesDto,
      currentUser,
    );
  }
}
