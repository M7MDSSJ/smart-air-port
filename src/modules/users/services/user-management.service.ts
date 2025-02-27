import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { IUserRepository } from '../repositories/user.repository.interface';
import { CreateUserDto } from '../dto/register-user.dto';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserResponseDto, RegisterResponseDto } from '../dto/register-response.dto'; // Updated import

@Injectable()
export class UserManagementService {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async getAllUsers(): Promise<{ message: string; users: UserResponseDto[] }> {
    const users = await this.userRepository.findAll();
    return {
      message: 'Users retrieved successfully',
      users: users.map((user) => this.excludeSensitiveFields(user)), // Now correctly typed
    };
  }

  async register(createUserDto: CreateUserDto): Promise<RegisterResponseDto> {
    if ('roles' in createUserDto) {
      throw new BadRequestException('Role assignment is not allowed');
    }
  
    const existingUser = await this.userRepository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
  
    const userCount = await this.userRepository.countByRole('admin');
    const assignedRoles = userCount === 0 ? ['admin'] : ['user'];
  
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
  
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
      console.error(`Failed to send verification email to ${savedUser.email}:`, error);
    }
  
    const userResponse: UserResponseDto = this.excludeSensitiveFields(savedUser);
    return {
      success: true,
      data: {
        message: userCount === 0 ? 'First admin user created successfully' : 'User registered successfully',
        user: userResponse,
      },
    };
  }
  
  private excludeSensitiveFields(user: User): UserResponseDto {
    const plainUser = (user as UserDocument).toObject();
    const { password, verificationToken, verificationTokenExpiry, refreshToken, resetToken, ...safeUser } = plainUser;
    return safeUser as UserResponseDto;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByToken(token);

    if (!user?.verificationToken || !user.verificationTokenExpiry) {
      throw new BadRequestException('Invalid verification token');
    }

    const expirationDate = new Date(user.verificationTokenExpiry);
    const currentDate = new Date();

    if (expirationDate < currentDate) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return {
        message: 'If this user exists, a verification email will be sent',
      };
    }
    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    user.verificationToken = this.generateToken();
    user.verificationTokenExpiry = new Date(Date.now() + 3600000);

    await user.save();

    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        user.verificationToken,
      );
    } catch (error) {
      console.error(`Failed to resend verification email to ${user.email}:`, error);
      throw new BadRequestException('Failed to send verification email');
    }

    return { message: 'Verification email sent successfully' };
  }

  async getProfile(userId: string): Promise<{ message: string; user: UserResponseDto }> {
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

  async logout(userId: string, providedRefreshToken: string): Promise<{ message: string }> {
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

 

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }
}