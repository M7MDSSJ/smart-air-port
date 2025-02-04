import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class RolesValidationPipe implements PipeTransform {
  transform(value: ValueWithRoles) {
    const allowedRoles = ['admin', 'user', 'airline_staff'];
    for (const role of value.roles) {
      if (!allowedRoles.includes(role)) {
        throw new BadRequestException(`Invalid role: ${role}`);
      }
    }
    return value;
  }
}
interface ValueWithRoles {
  roles: string[];
}
