// src/modules/users/services/user-management.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserRepository } from '../repositories/user.repository.interface';
import { CreateUserDto } from '../dto/register-user.dto';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class UserManagementService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

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
    };

    const savedUser = await this.userRepository.create(newUser);

    // Send verification email (errors can be handled or logged)
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
    const user = await this.userRepository.findByToken(token);

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }
  async getProfile(email: string): Promise<{ message: string; user: User }> {
    try {
      const user = await this.userRepository.findByEmail(email);

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
  async logout(userId: string): Promise<{ message: string }> {
    await this.userRepository.findByIdAndUpdate(userId);
    return { message: 'Logged out successfully' };
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
