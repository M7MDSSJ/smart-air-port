// src/modules/users/services/user-management.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { IUserRepository } from '../repositories/user.repository.interface';
import { CreateUserDto } from '../dto/register-user.dto';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class UserManagementService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}
  async getAllUsers(): Promise<{ message: string; users: User[] }> {
    const users = await this.userRepository.findAll();
    return {
      message: 'Users retrieved successfully',
      users: users.map((user) => this.excludeSensitiveFields(user)), // Exclude sensitive fields
    };
  }
  async register(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; user: Partial<User> }> {
    // Prevent manual role assignment
    if ('roles' in createUserDto) {
      throw new BadRequestException('Role assignment is not allowed');
    }

    // Check if this is the first user to assign admin role
    const userCount = await this.userRepository.countByRole('admin');
    const assignedRoles = userCount === 0 ? ['admin'] : ['user'];

    // Hash the password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create the user
    const newUser: Partial<User> = {
      ...createUserDto,
      roles: assignedRoles,
      password: hashedPassword,
      isVerified: false,
      verificationToken: this.generateToken(),
      verificationTokenExpiry: new Date(Date.now() + 3600000),
    };

    const savedUser = await this.userRepository.create(newUser);

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
  async verifyEmail(token: string): Promise<{ message: string }> {
    // 1. Find user with valid token and expiry
    const user = await this.userRepository.findByToken(token);

    // 2. Validate all required properties exist
    if (!user?.verificationToken || !user.verificationTokenExpiry) {
      throw new BadRequestException('Invalid verification token');
    }

    // 3. Type-safe date comparison
    const expirationDate = new Date(user.verificationTokenExpiry);
    const currentDate = new Date();

    if (expirationDate < currentDate) {
      throw new BadRequestException('Verification token has expired');
    }

    // 4. Check verification status
    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    // 5. Update user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    // Find the user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user)
      return {
        message: 'If this user exists, a verification email will be sent',
      };
    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    // Generate a new verification token and expiry
    user.verificationToken = this.generateToken();
    user.verificationTokenExpiry = new Date(Date.now() + 3600000); // 1 hour validity

    // Save the updated user
    await user.save();

    // Attempt to send the verification email
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        user.verificationToken,
      );
    } catch (error) {
      console.error(
        `Failed to resend verification email to ${user.email}:`,
        error,
      );
      throw new BadRequestException('Failed to send verification email');
    }

    return { message: 'Verification email sent successfully' };
  }

  async getProfile(userId: string): Promise<{ message: string; user: User }> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        message: 'User profile retrieved successfully',
        user: this.excludeSensitiveFields(user),
      };
    } catch {
      throw new BadRequestException('Failed to retrieve user profile');
    }
  }
  async getById(userId: string): Promise<UserDocument | null> {
    return this.userRepository.findById(userId);
  }
  async logout(
    userId: string,
    providedRefreshToken: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.refreshToken !== providedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.userRepository.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
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
