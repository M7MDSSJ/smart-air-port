import { PipeTransform, Injectable, NotFoundException } from '@nestjs/common';
import { UserManagementService } from '../../../modules/users/services/user-management.service';
@Injectable()
export class UserExistenceValidationPipe implements PipeTransform {
  constructor(private readonly usersService: UserManagementService) {}

  async transform(value: string) {
    const user = await this.usersService.getById(value);
    if (user === null) {
      throw new NotFoundException('User not found');
    }
    return value;
  }
}
