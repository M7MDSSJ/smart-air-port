import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';

@ValidatorConstraint({ name: 'isAdult', async: false })
export class IsAdultConstraint implements ValidatorConstraintInterface {
  validate(birthdate: string, args: ValidationArguments) {
    const date = new Date(birthdate);
    const today = new Date();
    const minAge = 18;

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return false;
    }

    // Check if the date is in the future
    if (date > today) {
      return false;
    }

    // Check if the user is at least 18 years old
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const dayDiff = today.getDate() - date.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      return age - 1 >= minAge;
    }
    return age >= minAge;
  }

  defaultMessage(args: ValidationArguments) {
    return 'User must be at least 18 years old';
  }
}

export function IsAdult(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAdult',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAdultConstraint,
    });
  };
}