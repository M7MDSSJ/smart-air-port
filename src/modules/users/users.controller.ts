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
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { RequestResetPasswordDto } from './dto/request-reset-password.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { UserDocument } from './schemas/user.schema';
import { GetUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';

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
  @ApiBody({
    type: CreateUserDto,
    examples: {
      example1: {
        value: {
          email: 'user@example.com',
          password: 'Password123',
          name: 'John Doe',
        },
      },
    },
  })
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }

  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiBody({
    type: VerifyEmailDto,
    examples: {
      example1: { value: { verificationToken: 'verification-token' } },
    },
  })
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
  @ApiBody({
    type: ResendEmailVerificationDto,
    examples: { example1: { value: { email: 'user@example.com' } } },
  })
  @Post('resend-verification')
  async resendVerificationEmail(
    @Body() resendEmailDto: ResendEmailVerificationDto,
  ) {
    return this.userManagementService.resendVerificationEmail(
      resendEmailDto.email,
    );
  }

  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiBody({
    type: RefreshTokenDto,
    examples: { example1: { value: { refreshToken: 'refresh-token' } } },
  })
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiBody({
    type: LoginUserDto,
    examples: {
      example1: {
        value: { email: 'user@example.com', password: 'Password123' },
      },
    },
  })
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    type: ChangePasswordDto,
    examples: {
      example1: {
        value: { oldPassword: 'OldPassword123', newPassword: 'NewPassword123' },
      },
    },
  })
  @Put('change-password')
  async changePassword(
    @GetUser() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.passwordResetService.changePassword(
      user._id.toString(),
      changePasswordDto,
    );
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiBody({
    type: RequestResetPasswordDto,
    examples: { example1: { value: { email: 'user@example.com' } } },
  })
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestResetPasswordDto,
  ) {
    return this.passwordResetService.requestPasswordReset(
      requestPasswordResetDto.email,
    );
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      example1: {
        value: { token: 'reset-token', newPassword: 'NewPassword123' },
      },
    },
  })
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
  @ApiBody({ type: String, examples: { example1: { value: 'refresh-token' } } })
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
  @ApiBody({
    type: UpdateUserRolesDto,
    examples: { example1: { value: { userId: 'user-id', roles: ['admin'] } } },
  })
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

  // @ApiOperation({ summary: 'Update user roles by user ID' })
  // @ApiResponse({ status: 200, description: 'User roles updated successfully' })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.Admin)
  // @ApiBody({
  //   type: UpdateUserRolesDto,
  //   examples: { example1: { value: { roles: ['admin'] } } },
  // })
  // @Patch(':userId/roles')
  // async updateRolesByParam(
  //   @Param('userId') userId: string,
  //   @Body() updateUserRolesDto: UpdateUserRolesDto,
  //   @GetUser() currentUser: UserDocument,
  // ) {
  //   if (!userId) {
  //     throw new BadRequestException('User ID is required');
  //   }
  //   return this.authService.updateRoles(
  //     userId,
  //     updateUserRolesDto,
  //     currentUser,
  //   );
  // }
}
