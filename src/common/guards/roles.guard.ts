import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';
import { UserDocument } from 'src/modules/users/schemas/user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required → access granted
    }

    const request: Request = context.switchToHttp().getRequest();
    const user: UserDocument | null = request.user as UserDocument;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!user.roles || user.roles.length === 0) {
      throw new ForbiddenException(
        'Access denied. User has no assigned roles.',
      );
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles`);
    }

    return true;
  }
}
