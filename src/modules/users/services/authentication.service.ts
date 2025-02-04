import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginUserDto } from '../dto/login-user.dto';
import { Types } from 'mongoose';

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

    // Generate Tokens
    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email, roles: user.roles },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user._id },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
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
    // Optionally update the user record with the refresh token.
    await this.userRepository.update(user._id.toString(), { refreshToken });
    return { accessToken, refreshToken };
  }

  async updateRoles(
    userId: string,
    roles: string[],
  ): Promise<UserDocument | null> {
    return this.userRepository.updateRoles(userId, roles);
  }
}
