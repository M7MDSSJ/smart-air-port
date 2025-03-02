import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { IUserRepository } from '../repositories/user.repository.interface';
import { CreateUserDto } from '../dto/register-user.dto';
import { UpdateProfileDto } from '../dto/updateProfile.dto';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserResponseDto, RegisterResponseDto } from '../dto/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/verifyEmail-response.dto';
import { ResendVerificationResponseDto } from '../dto/resendVerificationResponse.dto';
import { LogoutResponseDto } from '../dto/logout-response.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async getAllUsers(): Promise<{ message: string; users: UserResponseDto[] }> {
    const users = await this.userRepository.findAll();
    return {
      message: 'Users retrieved successfully',
      users: users.map((user) => this.excludeSensitiveFields(user)),
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
      // TypeScript knows birthdate is optional in User, so this should work now
      birthdate: createUserDto.birthdate ? new Date(createUserDto.birthdate) : undefined,
    };
    const savedUser = await this.userRepository.create(newUser);
    try {
      await this.emailService.sendVerificationEmail(savedUser.email, savedUser.verificationToken as string);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${savedUser.email}`, error.stack);
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

  async verifyEmail(token: string): Promise<VerifyEmailResponseDto> {
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
    const updatedUser = await this.userRepository.update(user._id.toString(), {
      $set: { isVerified: true },
      $unset: { verificationToken: "", verificationTokenExpiry: "" },
    });
    if (!updatedUser) {
      throw new NotFoundException('Failed to update user verification');
    }
    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  async resendVerificationEmail(email: string): Promise<ResendVerificationResponseDto> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Email not found');
    }
    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }
    const verificationToken = this.generateToken();
    const verificationTokenExpiry = new Date(Date.now() + 3600000);
    const updatedUser = await this.userRepository.update(user._id.toString(), {
      verificationToken,
      verificationTokenExpiry,
    });
    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      this.logger.error(`Failed to resend verification email to ${user.email}`, error.stack);
      throw new BadRequestException('Failed to send verification email');
    }
    return {
      success: true,
      message: 'Verification email sent successfully',
    };
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Verify your account please');
    }
    return {
      message: 'User profile retrieved successfully',
      user: this.excludeSensitiveFields(user),
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Verify your account please');
    }

    const updateData: Partial<User> = {};
    if (updateProfileDto.firstName) updateData.firstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName) updateData.lastName = updateProfileDto.lastName;
    if (updateProfileDto.phoneNumber) updateData.phoneNumber = updateProfileDto.phoneNumber;

    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updateProfileDto.email);
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ConflictException('Email already exists');
      }
      updateData.email = updateProfileDto.email;
      updateData.isVerified = false;
      updateData.verificationToken = this.generateToken();
      updateData.verificationTokenExpiry = new Date(Date.now() + 3600000);
      try {
        await this.emailService.sendVerificationEmail(updateData.email, updateData.verificationToken);
      } catch (error) {
        this.logger.error(`Failed to send verification email to ${updateData.email}`, error.stack);
        throw new BadRequestException('Failed to send verification email');
      }
    }

    const updatedUser = await this.userRepository.update(userId, updateData);
    if (!updatedUser) {
      throw new NotFoundException('Failed to update user profile');
    }

    return {
      message: 'Profile updated successfully' + (updateProfileDto.email ? ' - Please verify your new email' : ''),
      user: this.excludeSensitiveFields(updatedUser),
    };
  }

  async getById(userId: string): Promise<UserDocument | null> {
    return this.userRepository.findById(userId);
  }

  async logout(userId: string, providedRefreshToken: string): Promise<LogoutResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.refreshToken !== providedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.userRepository.updateRefreshToken(userId, null);
    return {
      success: true,
      message: 'User logged out successfully',
    };
  }

  private excludeSensitiveFields(user: User): UserResponseDto {
    const plainUser = (user as UserDocument).toObject();
    const { _id, firstName, lastName, email, country, phoneNumber, isVerified, birthdate } = plainUser;
    return { 
      id: _id.toString(), 
      firstName, 
      lastName, 
      email, 
      country, 
      phoneNumber, 
      isVerified,
      birthdate: birthdate ? birthdate.toISOString().split('T')[0] : undefined // Optional
    };
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }
}