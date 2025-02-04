import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PasswordValidationPipe implements PipeTransform {
  transform(value: string) {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(value)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and contain both letters and numbers',
      );
    }
    return value;
  }
}
