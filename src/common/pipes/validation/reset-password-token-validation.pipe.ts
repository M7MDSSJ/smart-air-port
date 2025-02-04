import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResetPasswordTokenValidationPipe implements PipeTransform {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  transform(value: string) {
    try {
      // Check if the token is valid
      this.jwtService.verify(value, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
    return value;
  }
}
