import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { Types } from 'mongoose';
import { CreateUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from '../../core/auth/email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; user: Partial<User> }> {
    // Ensure roles cannot be set manually
    if ('roles' in createUserDto) {
      throw new BadRequestException('Role assignment is not allowed');
    }

    // Count existing users
    const userCount = await this.userModel.countDocuments();

    // Determine the user's role: First user → Admin, Others → User
    const assignedRoles = userCount === 0 ? ['admin'] : ['user'];

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create a new user object
    const newUser = new this.userModel({
      ...createUserDto,
      roles: assignedRoles,
      password: hashedPassword,
      isVerified: false,
      verificationToken: this.generateToken(),
    });

    // Save user to the database
    const savedUser = await newUser.save();

    // Send verification email (failures are logged but do not block registration)
    try {
      await this.emailService.sendVerificationEmail(
        savedUser.email,
        savedUser.verificationToken as string,
      );
    } catch (error) {
      console.error(
        `Failed to send verification email to ${savedUser.email}:`,
        error,
      );
    }

    return {
      message:
        userCount === 0
          ? 'First admin user created successfully'
          : 'User registered successfully',
      user: this.excludeSensitiveFields(savedUser),
    };
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<{
    message: string;
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.userModel.findOne({ email: loginUserDto.email });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginUserDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const castedUser = user as User & { _id: Types.ObjectId };

    const { accessToken, refreshToken } = await this.generateTokens(castedUser);

    return {
      message: 'User logged in successfully',
      user: this.excludeSensitiveFields(user),
      accessToken,
      refreshToken,
    };
  }
  async generateTokens(user: User & { _id: Types.ObjectId }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user._id.toString() },
        {
          secret: this.config.get('JWT_ACCESS_SECRET'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: user._id, email: user.email },
        {
          secret: this.config.get('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    // Optionally store refreshToken in DB for future use (e.g., to handle refresh token logic)
    await this.userModel.findByIdAndUpdate(
      user._id,
      { refreshToken },
      { new: true },
    );

    return { accessToken, refreshToken };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;

    // Find the user by ID
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify that the provided old password matches the current password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update and save the new password
    user.password = hashedNewPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const resetToken = this.jwtService.sign(
      { email: user.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: '1h',
      },
    );
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    await this.emailService.sendPasswordResetEmail(user.email, user.resetToken);

    return { message: 'if this user exists an email will be sent' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string; User: User }> {
    interface JwtPayload {
      email: string;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(resetPasswordDto.token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
    const user = await this.userModel.findOne({
      email: payload.email,
      resetToken: resetPasswordDto.token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    user.password = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return {
      message: 'Password reset successfully',
      User: this.excludeSensitiveFields(user),
    };
  }

  async verifyEmail(token: string): Promise<{ message: string; User: User }> {
    const user = await this.userModel.findOne({ verificationToken: token });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return {
      message: 'account verified',
      User: this.excludeSensitiveFields(user),
    };
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<{ message: string; User: User }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.password) {
      if (!updateUserDto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }

      const isPasswordValid = await bcrypt.compare(
        updateUserDto.currentPassword,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid current password');
      }

      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    await user.save();

    return {
      message: 'Profile Updated',
      User: this.excludeSensitiveFields(user),
    };
  }
  async getUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId); // Query the database to find the user by their ID
  }
  async getProfile(email: string): Promise<{ message: string; User: User }> {
    try {
      const user = await this.userModel.findOne({ email });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        message: 'Profile Fetched',
        User: this.excludeSensitiveFields(user),
      };
    } catch (error) {
      console.error('Error fetching user profile:', error); // Log the error
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async deleteUser(email: string): Promise<{ message: string }> {
    await this.userModel.findOneAndDelete({ email });
    return { message: 'User deleted successfully' };
  }
  async logout(userId: string): Promise<{ message: string }> {
    await this.userModel.findByIdAndUpdate(
      userId,
      { refreshToken: null },
      { new: true },
    );
    return { message: 'Logged out successfully' };
  }
  // users.service.ts
  async updateRoles(
    userId: string,
    roles: string[],
  ): Promise<{ message: string; user: User }> {
    // Prevent removing admin role from first user
    const targetUser = await this.userModel.findById(userId);
    if (targetUser?.roles.includes('admin')) {
      const adminCount = await this.userModel.countDocuments({
        roles: 'admin',
      });
      if (adminCount === 1) {
        throw new BadRequestException('Cannot remove last admin');
      }
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { roles },
      { new: true },
    );

    if (!user) throw new NotFoundException('User not found');

    return {
      message: 'Roles updated successfully',
      user: this.excludeSensitiveFields(user),
    };
  }

  private generateToken(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private excludeSensitiveFields(user: User): User {
    const userObj: Partial<User> = (
      user as UserDocument
    ).toObject() as Partial<User>;
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.resetToken;
    delete userObj.verificationToken;
    return userObj as User;
  }
}
