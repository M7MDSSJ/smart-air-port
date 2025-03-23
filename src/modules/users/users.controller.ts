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
import { GetUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { ErrorResponseDto } from './dto/error-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('all')
  async getAllUsers() {
    return this.userManagementService.getAllUsers();
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation errors',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: CreateUserDto })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }

  @Public()
  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification code',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: VerifyEmailDto })
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.userManagementService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code,
    );
  }

  @Public()
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
    type: ResendVerificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: ResendEmailVerificationDto })
  @Post('resend-verification')
  async resendVerificationEmail(
    @Body() resendEmailDto: ResendEmailVerificationDto,
  ) {
    return this.userManagementService.resendVerificationEmail(
      resendEmailDto.email,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: RefreshTokenDto })
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: LoginUserDto })
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: ChangePasswordDto })
  @Put('change-password')
  async changePassword(
    @GetUser() user: UserDocument,
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
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset code sent',
    type: RequestResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: RequestResetPasswordDto })
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestResetPasswordDto,
  ) {
    return this.passwordResetService.requestPasswordReset(
      requestPasswordResetDto.email,
    );
  }

  @Public()
  @ApiOperation({ summary: 'Reset password using code' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired reset code',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: ResetPasswordDto })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    if (!resetPasswordDto.code || !resetPasswordDto.newPassword) {
      throw new BadRequestException('Reset code and new password are required');
    }
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @Get('profile')
  async getProfile(@GetUser() user: UserDocument) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.getProfile(user._id.toString());
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation errors or email sending failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: UpdateProfileDto })
  @Patch('profile')
  async updateProfile(
    @GetUser() user: UserDocument,
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: RefreshTokenDto })
  @Post('logout')
  async logout(
    @GetUser() user: UserDocument,
    @Body('refreshToken') refreshToken: string,
  ) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.logout(user._id.toString(), refreshToken);
  }
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user by email' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: Object,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @Delete(':email')
  async deleteUserByEmail(@Param('email') email: string) {
    return this.userManagementService.deleteUserByEmail(email);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Admin-only content',
    type: DashboardResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @Get('admin-dashboard')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @ApiOperation({ summary: 'Manage flights' })
  @ApiResponse({
    status: 200,
    description: 'Flight management dashboard',
    type: FlightManagementResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @Get('flight-management')
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Update user roles' })
  @ApiResponse({
    status: 200,
    description: 'User roles updated successfully',
    type: UpdateRolesResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    type: ErrorResponseDto,
  })
  @ApiBody({ type: UpdateUserRolesDto })
  @Patch('roles')
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @GetUser() currentUser: UserDocument,
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
