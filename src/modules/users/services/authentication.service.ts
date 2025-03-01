import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginUserDto } from '../dto/login-user.dto';
import { Types } from 'mongoose';
import { Role } from 'src/common/enums/role.enum';
import { UpdateUserRolesDto } from '../dto/update-user-roles.dto';
import { Logger } from '@nestjs/common';
import { RefreshTokenResponseDto } from '../dto/refreshToken-response.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UpdateRolesResponseDto } from '../dto/updateRoles-response.dto';
import { UserResponseDto } from '../dto/register-response.dto';
@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async validateUser(loginDto: LoginUserDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findByEmailWithPassword(loginDto.email);
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }
  
    const accessToken = this.jwtService.sign({
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles, // Ensure roles are included
    }, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m',
    });
  
    const refreshToken = this.jwtService.sign({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles, // Include roles here too
    }, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
  
    await this.userRepository.updateRefreshToken(user._id.toString(), refreshToken);
  
    return {
      success: true,
      data: {
        message: 'User logged in successfully',
        accessToken,
        refreshToken,
      },
    };
  }

  async generateTokens(
    user: User & { _id: Types.ObjectId },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user._id.toString(), email: user.email, roles: user.roles },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user._id.toString() },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
    await this.userRepository.updateRefreshToken(
      user._id.toString(),
      refreshToken,
    );
    return { accessToken, refreshToken };
  }
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      // Adjust payload type to match your token structure
      const payload = this.jwtService.verify<{ userId: string; email: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
  
      const user = await this.userRepository.findById(payload.userId); // Use userId instead of sub
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
  
      await this.userRepository.updateRefreshToken(payload.userId, null);
  
      const { accessToken, refreshToken: newToken } = await this.generateTokens(user);
      return {
        success: true,
        accessToken,
        refreshToken: newToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async updateRoles(
    targetUserId: string,
    updateUserRolesDto: UpdateUserRolesDto,
    currentUser: UserDocument,
  ): Promise<UpdateRolesResponseDto> {
    if (updateUserRolesDto.roles.length === 0) {
      throw new BadRequestException('User must have at least one role');
    }
    if (
      updateUserRolesDto.roles.some(
        (role) => !Object.values(Role).includes(role),
      )
    ) {
      throw new BadRequestException('Invalid role provided');
    }
    if (!currentUser.roles.includes(Role.Admin)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (currentUser._id.toString() === targetUserId) {
      throw new BadRequestException('Admins cannot modify their own roles');
    }

    this.logger.log(
      `Admin ${currentUser.email} updating roles for user ${targetUserId}`,
    );

    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.roles = updateUserRolesDto.roles;
    await user.save();
    this.logger.log(
      `Roles updated for ${user.email}: ${user.roles.join(', ')}`,
    );

    return {
      success: true,
      message: 'User roles updated successfully',
      user: this.excludeSensitiveFields(user),
    };
  }
  private excludeSensitiveFields(user: UserDocument): UserResponseDto {
    const plainUser = user.toObject();
    const { 
      password, 
      verificationToken, 
      verificationTokenExpiry, 
      refreshToken, 
      resetToken, 
      resetTokenExpiry, 
      __v, 
      ...safeUser 
    } = plainUser;
    return safeUser as UserResponseDto;
  }
}
