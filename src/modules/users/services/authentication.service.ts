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

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async validateUser(
    loginDto: LoginUserDto,
  ): Promise<{ accessToken: string; refreshToken: string; message: string }> {
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Generate Tokens
    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email, roles: user.roles },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user._id, email: user.email },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );
    await this.userRepository.updateRefreshToken(
      user._id.toString(),
      refreshToken,
    );
    return {
      message: 'User logged in successfully',
      accessToken,
      refreshToken,
    };
  }

  async generateTokens(
    user: User & { _id: Types.ObjectId },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user._id.toString() },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user._id.toString(), email: user.email },
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

  async updateRoles(
    targetUserId: string,
    updateUserRolesDto: UpdateUserRolesDto,
    currentUser: UserDocument,
  ): Promise<{ message: string; user: UserDocument }> {
    // Ensure only admins can update roles
    if (!currentUser.roles.includes(Role.Admin)) {
      throw new ForbiddenException('Only admins can update roles');
    }

    // Prevent admins from modifying their own roles
    if (currentUser._id.toString() === targetUserId) {
      throw new BadRequestException('Admins cannot modify their own roles');
    }

    // Fetch user to update
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update roles
    user.roles = updateUserRolesDto.roles;
    await user.save();

    return {
      message: 'User roles updated successfully',
      user,
    };
  }
}
