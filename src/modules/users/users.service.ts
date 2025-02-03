import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
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

import { EmailService } from '../../core/auth/email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<User> {
    // Check for existing user
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: createUserDto.email },
        { phoneNumber: createUserDto.phoneNumber },
      ],
    });

    if (existingUser) {
      throw new ConflictException('Email or phone number already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const newUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      isVerified: false,
      verificationToken: this.generateToken(),
    });

    // Save user
    const savedUser = await newUser.save();

    // Send verification email
    await this.emailService.sendVerificationEmail(
      savedUser.email,
      savedUser.verificationToken as string,
    );

    // Return user without sensitive data
    return this.excludeSensitiveFields(savedUser);
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<User> {
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

    return this.excludeSensitiveFields(user);
  }
  async generateTokens(user: User & { _id: Types.ObjectId }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user._id, email: user.email },
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

    await this.userModel.findByIdAndUpdate(
      user._id,
      { refreshToken },
      { new: true },
    );

    return { accessToken, refreshToken };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.resetToken = this.generateToken();
    user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    await this.emailService.sendPasswordResetEmail(user.email, user.resetToken);
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<User> {
    const user = await this.userModel.findOne({
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

    return this.excludeSensitiveFields(user);
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await this.userModel.findOne({ verificationToken: token });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return this.excludeSensitiveFields(user);
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
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

    return this.excludeSensitiveFields(user);
  }
  async getProfile(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.excludeSensitiveFields(user);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.userModel.findByIdAndDelete(userId);
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
