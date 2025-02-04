import { PipeTransform, Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from 'src/modules/users/users.service';
@Injectable()
export class UserExistenceValidationPipe implements PipeTransform {
  constructor(private readonly usersService: UsersService) {}

  async transform(value: string) {
    const user = await this.usersService.getUserById(value);
    if (user === null) {
      throw new NotFoundException('User not found');
    }
    return value;
  }
}
