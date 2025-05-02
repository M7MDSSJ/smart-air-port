// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { IUserRepository } from 'src/modules/users/repositories/user.repository.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Get the full user document from the database
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }

    // Return the payload which will be available in @User() decorator
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      isVerified: user.isVerified,
    };
  }
}
