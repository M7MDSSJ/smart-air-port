import {
  Controller,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
  Get,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserDocument } from './schemas/user.schema';
import { GetUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { BadRequestException } from '@nestjs/common';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.register(createUserDto);
  }
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    return this.usersService.verifyEmail(token);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.validateUser(loginUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(
    @GetUser() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // Ensure `user` is defined before accessing _id
    if (!user) {
      throw new Error('User not found');
    }

    // Type assertion to ensure _id is treated as Types.ObjectId
    const userId = user._id ? user._id.toString() : null;
    // Pass the string userId to the service
    if (!userId) {
      throw new Error('User ID is required');
    }
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return this.usersService.requestPasswordReset(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.usersService.resetPassword(resetPasswordDto);
  }
  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async getProfile(@Body() body: { email: string }) {
    return await this.usersService.getProfile(body.email);
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@GetUser() user: UserDocument) {
    return this.usersService.logout(user._id.toString());
  }
  @UseGuards(JwtAuthGuard)
  @Put('delete-user/:email')
  async deleteUser(@Param('email') email: string) {
    return this.usersService.deleteUser(email);
  }
  @Get('admin-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }
  @Get('flight-management')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'airline_staff')
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }
  @Patch(':id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateRoles(
    @Param('id') userId: string,
    @Body() updateRolesDto: { roles: string[] },
  ) {
    // Prevent self-role modification if needed
    const currentUser = await this.usersService.getUserById(userId);
    if (currentUser?.roles.includes('admin')) {
      throw new BadRequestException('Admins cannot modify their own roles');
    }
    return this.usersService.updateRoles(userId, updateRolesDto.roles);
  }
}
