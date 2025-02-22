import {
  Controller,
  Post,
  Body,
  Put,
  UseGuards,
  Get,
  Param,
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
import { VerifyEmailDto } from './dto/verify-email.dto'; // Import the DTO
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }

  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.userManagementService.verifyEmail(
      verifyEmailDto.verificationToken,
    );
  }

  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
  })
  @Post('resend-verification')
  async resendVerificationEmail(@Body('email') email: string) {
    return this.userManagementService.resendVerificationEmail(email);
  }

  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @Post('refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiBearerAuth()
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

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@GetUser() user: UserDocument) {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.getProfile(user._id.toString());
  }

  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @GetUser() user: UserDocument,
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.userManagementService.logout(user._id.toString(), refreshToken);
  }

  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiResponse({ status: 200, description: 'Admin-only content' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('admin-dashboard')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }

  @ApiOperation({ summary: 'Manage flights' })
  @ApiResponse({ status: 200, description: 'Flight management dashboard' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('flight-management')
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }

  @ApiOperation({ summary: 'Update user roles' })
  @ApiResponse({ status: 200, description: 'User roles updated successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch('roles')
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @GetUser() currentUser: UserDocument,
  ) {
    return this.authService.updateRoles(
      updateUserRolesDto.userId,
      updateUserRolesDto,
      currentUser,
    );
  }

  @ApiOperation({ summary: 'Update user roles by user ID' })
  @ApiResponse({ status: 200, description: 'User roles updated successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':userId/roles')
  async updateRolesByParam(
    @Param('userId') userId: string,
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @GetUser() currentUser: UserDocument,
  ) {
    return this.authService.updateRoles(
      userId,
      updateUserRolesDto,
      currentUser,
    );
  }
}
