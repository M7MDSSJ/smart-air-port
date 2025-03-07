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
import {
  UserResponseDto,
  RegisterResponseDto,
} from '../dto/register-response.dto';
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
    return this.userRepository.withTransaction(async (session) => {
      const existingUser = await this.userRepository.findByEmail(
        createUserDto.email,
        { session },
      );
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
      const userCount = await this.userRepository.countByRole('admin', {
        session,
      });
      const assignedRoles = userCount === 0 ? ['admin'] : ['user'];
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const newUser: Partial<User> = {
        ...createUserDto,
        roles: assignedRoles,
        password: hashedPassword,
        isVerified: false,
        verificationToken: this.generateCode(),
        verificationTokenExpiry: new Date(Date.now() + 3600000),
        birthdate: createUserDto.birthdate
          ? new Date(createUserDto.birthdate)
          : undefined,
      };
      const savedUser = await this.userRepository.create(newUser, { session });
      try {
        await this.emailService.sendVerificationEmail(
          savedUser.email,
          savedUser.verificationToken as string,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${savedUser.email}`,
          error.stack,
        );
      }
      const userResponse = this.excludeSensitiveFields(savedUser);
      return {
        success: true,
        data: {
          message:
            userCount === 0
              ? 'First admin user created successfully'
              : 'User registered successfully',
          user: userResponse,
        },
      };
    });
  }

  async verifyEmail(
    email: string,
    code: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByEmail(email, { session }); 
      if (!user) {
        throw new NotFoundException('Email not found');
      }
      if (!user.verificationToken || !user.verificationTokenExpiry) {
        throw new BadRequestException(
          'No verification code found for this email',
        );
      }
      if (user.verificationToken !== code) {
        // Check code matches
        throw new BadRequestException('Invalid verification code');
      }
      const expirationDate = new Date(user.verificationTokenExpiry);
      const currentDate = new Date();
      if (expirationDate < currentDate) {
        throw new BadRequestException('Verification code has expired');
      }
      if (user.isVerified) {
        throw new BadRequestException('User is already verified');
      }
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        {
          $set: { isVerified: true },
          $unset: { verificationToken: '', verificationTokenExpiry: '' },
        },
        { session },
      );
      if (!updatedUser) {
        throw new NotFoundException('Failed to update user verification');
      }
      return {
        success: true,
        data: { message: 'Email verified successfully' },
      };
    });
  }

  async resendVerificationEmail(
    email: string,
  ): Promise<ResendVerificationResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByEmail(email, { session });
      if (!user) {
        throw new NotFoundException('Email not found');
      }
      if (user.isVerified) {
        throw new BadRequestException('User is already verified');
      }
      const verificationCode = this.generateCode();
      const verificationTokenExpiry = new Date(Date.now() + 3600000);
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        { verificationToken: verificationCode, verificationTokenExpiry },
        { session },
      );
      if (!updatedUser) {
        throw new NotFoundException('Failed to update user');
      }
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationCode,
      );
      return {
        success: true,
        data: { message: 'Verification email sent successfully' },
      };
    });
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
      success: true,
      data: {
        message: 'User profile retrieved successfully',
        user: this.excludeSensitiveFields(user),
      },
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, { session });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (!user.isVerified) {
        throw new UnauthorizedException('Verify your account please');
      }

      const updateData: Partial<User> = {};
      if (updateProfileDto.firstName)
        updateData.firstName = updateProfileDto.firstName;
      if (updateProfileDto.lastName)
        updateData.lastName = updateProfileDto.lastName;
      if (updateProfileDto.phoneNumber) {
        if (updateProfileDto.phoneNumber !== user.phoneNumber) {
          const phoneExists = await this.userRepository.findByPhoneNumber(
            updateProfileDto.phoneNumber,
            { session },
          );
          if (phoneExists && phoneExists._id.toString() !== userId) {
            throw new ConflictException('Phone number already in use');
          }
        }
        updateData.phoneNumber = updateProfileDto.phoneNumber;
      }
      if (updateProfileDto.email && updateProfileDto.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(
          updateProfileDto.email,
          { session },
        );
        if (existingUser) {
          throw new ConflictException(
            'Email is already in use by another account',
          );
        }
        updateData.email = updateProfileDto.email;
        updateData.isVerified = false;
        updateData.verificationToken = this.generateCode();
        updateData.verificationTokenExpiry = new Date(Date.now() + 3600000);
      }

      const updatedUser = await this.userRepository.update(userId, updateData, {
        session,
      });
      if (!updatedUser) {
        throw new NotFoundException('Failed to update user profile');
      }

      if (updateProfileDto.email && updateProfileDto.email !== user.email) {
        await this.emailService.sendVerificationEmail(
          updateData.email!,
          updateData.verificationToken!,
        );
      }

      return {
        success: true,
        data: {
          message:
            'Profile updated successfully' +
            (updateProfileDto.email && updateProfileDto.email !== user.email
              ? ' - Please verify your new email'
              : ''),
          user: this.excludeSensitiveFields(updatedUser),
        },
      };
    });
  }

  async getById(userId: string): Promise<UserDocument | null> {
    return this.userRepository.findById(userId);
  }

  async logout(
    userId: string,
    providedRefreshToken: string,
  ): Promise<LogoutResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, { session });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.refreshToken !== providedRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      await this.userRepository.updateRefreshToken(userId, null, { session });
      return {
        success: true,
        data: { message: 'User logged out successfully' },
      };
    });
  }

  private excludeSensitiveFields(user: User): UserResponseDto {
    const plainUser = (user as UserDocument).toObject();
    const {
      _id,
      firstName,
      lastName,
      email,
      country,
      phoneNumber,
      isVerified,
      birthdate,
    } = plainUser;
    return {
      id: _id.toString(),
      firstName,
      lastName,
      email,
      country,
      phoneNumber,
      isVerified,
      birthdate: birthdate ? birthdate.toISOString().split('T')[0] : undefined,
    };
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }
}
