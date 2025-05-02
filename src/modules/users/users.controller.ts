import {
  Controller,
  Post,
  Body,
  Put,
  UseGuards,
  Get,
  Patch,
  UnauthorizedException,
  Query,
  Param,
  Delete,
  BadRequestException,
} from '@nestjs/common';
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
import {
  RegisterResponseDto,
  UserResponseDto,
} from './dto/register-response.dto';
import { VerifyEmailResponseDto } from './dto/verifyEmail-response.dto';
import { ResendVerificationResponseDto } from './dto/resendVerificationResponse.dto';
import { RefreshTokenResponseDto } from './dto/refreshToken-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ChangePasswordResponseDto } from './dto/changePassword-response.dto';
import { RequestResetPasswordResponseDto } from './dto/requestResetPassword-response.dto';
import { ResetPasswordResponseDto } from './dto/resetPassword-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { FlightManagementResponseDto } from './dto/flightManagement-response.dto';
import { UpdateRolesResponseDto } from './dto/updateRoles-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { UserDocument } from './schemas/user.schema';
import { User } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { ErrorResponseDto } from './dto/error-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

 
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('all')
  async getAllUsers() {
    return this.userManagementService.getAllUsers();
  }

  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }


  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.userManagementService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code,
    );
  }

  @Public()
  @Post('resend-verification')
  async resendVerificationEmail(
    @Body() resendEmailDto: ResendEmailVerificationDto,
  ) {
    return this.userManagementService.resendVerificationEmail(
      resendEmailDto.email,
    );
  }

  @UseGuards(AuthGuard('jwt')) 
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('change-password')
  async changePassword(
    @User() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    if (!user || !user._id) {
      throw new UnauthorizedException('User not found');
    }
    return this.passwordResetService.changePassword(
      user._id.toString(),
      changePasswordDto,
    );
  }

  @Public()
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestResetPasswordDto,
  ) {
    return this.passwordResetService.requestPasswordReset(
      requestPasswordResetDto.email,
    );
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    if (!resetPasswordDto.code || !resetPasswordDto.newPassword) {
      throw new BadRequestException('Reset code and new password are required');
    }
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@User() user: UserDocument) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.getProfile(user._id.toString());
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @User() user: UserDocument,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.updateProfile(
      user._id.toString(),
      updateProfileDto,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(
    @User() user: UserDocument,
    @Body('refreshToken') refreshToken: string,
  ) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.logout(user._id.toString(), refreshToken);
  }


  @Delete(':email')
  async deleteUserByEmail(@Param('email') email: string) {
    return this.userManagementService.deleteUserByEmail(email);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('admin-dashboard')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('flight-management')
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Patch('roles')
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @User() currentUser: UserDocument,
  ) {
    if (!currentUser || !currentUser._id) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.authService.updateRoles(
      updateUserRolesDto.userId,
      updateUserRolesDto,
      currentUser,
    );
  }
}
