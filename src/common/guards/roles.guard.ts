import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserDocument } from 'src/modules/users/schemas/user.schema';
import { Request } from 'express';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles) return true; // No roles required → access granted

    const request: Request = context.switchToHttp().getRequest<Request>();
    const user: UserDocument =
      (request as Request & { user: UserDocument }).user ??
      ({} as UserDocument);
    if (!user) throw new ForbiddenException('User not authenticated');

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
