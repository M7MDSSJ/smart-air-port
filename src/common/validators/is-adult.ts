import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { differenceInYears, parse } from 'date-fns';

export function IsAdult(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAdult',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return false;

          try {
            const birthDate =
              typeof value === 'string'
                ? parse(value, 'yyyy-MM-dd', new Date())
                : value;

            const age = differenceInYears(new Date(), birthDate);
            return age >= 18;
          } catch (e) {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'User must be at least 18 years old';
        },
      },
    });
  };
}
