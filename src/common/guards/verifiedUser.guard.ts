import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtUser } from '../interfaces/jwtUser.interface';
import { FastifyRequest } from 'fastify/types/request';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request: FastifyRequest = context.switchToHttp().getRequest();
    const user = request.user as JwtUser;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Here you'd check if the user is verified (you might have this info in the JWT)
    // For now, just assume all users with valid tokens are verified
    return true;
  }
}
