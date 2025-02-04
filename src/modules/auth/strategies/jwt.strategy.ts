import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from 'src/modules/users/schemas/user.schema';
import { UnauthorizedException } from '@nestjs/common';
import { IUserRepository } from 'src/modules/users/repositories/user.repository.interface';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'defaultSecret',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
  }): Promise<UserDocument> {
    // Fetch the full user from the database using the user ID
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user; // This will return the full UserDocument, which includes all the Mongoose methods
  }
}
