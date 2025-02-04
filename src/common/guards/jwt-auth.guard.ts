import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IUserRepository } from 'src/modules/users/repositories/user.repository.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No Bearer token provided');
    }

    try {
      const token = authHeader.split(' ')[1]; // Extract token from header
      const decoded = this.jwtService.verify<{ sub: string }>(token, {
        // Verify the token
        secret: process.env.JWT_SECRET, // Secret key for verification
      });

      // Fetch the full user document from the database
      const user = await this.userRepository.findById(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach the complete user document to the request
      request.user = user;
      return !!request.user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
