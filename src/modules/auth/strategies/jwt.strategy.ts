import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

interface JwtPayload {
  sub?: string;
  userId?: string;
  email: string;
  name?: string;
  roles?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): Promise<JwtUser> {
    // Map the JWT payload to match your JwtUser interface
    return {
      id: payload.sub || payload.userId || '',
      email: payload.email,
      name: payload.name || '',
    };
  }
}
