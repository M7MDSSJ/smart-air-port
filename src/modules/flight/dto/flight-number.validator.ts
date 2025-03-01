import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'flightNumber', async: false })
@Injectable()
export class FlightNumberValidator implements ValidatorConstraintInterface {
  validate(flightNumber: string): boolean {
    // Format: 2 uppercase letters followed by numbers (e.g., AA123)
    const regex = /^[A-Z]{2}\d+$/;
    return regex.test(flightNumber);
  }

  defaultMessage(): string {
    return 'Flight number must start with 2 letters followed by numbers (e.g., AA123)';
  }
}