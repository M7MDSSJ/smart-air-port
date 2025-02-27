import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserDocument } from 'src/modules/users/schemas/user.schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserDocument;
    if (!user || !user.isVerified) {
      throw new UnauthorizedException('Verify your account please');
    }
    return true;
  }
}