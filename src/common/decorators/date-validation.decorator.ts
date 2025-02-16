import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

type DateComparable = string | Date | number;

function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function IsBefore(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'IsBefore',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: DateComparable, args: ValidationArguments): boolean {
          // Explicitly type constraints as a tuple with one string element
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ] as DateComparable;

          // If the related property is not set, skip validation (or choose to return false)
          if (!relatedValue) return true;

          const date = new Date(value);
          const relatedDate = new Date(relatedValue);

          if (!isValidDate(date) || !isValidDate(relatedDate)) {
            return false;
          }

          return date.getTime() < relatedDate.getTime();
        },
        defaultMessage(args: ValidationArguments): string {
          // Again, ensure the constraint is treated as a string.
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must be before ${relatedPropertyName}`;
        },
      },
    });
  };
}

export function IsAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'IsAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: DateComparable, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ] as DateComparable;

          if (!relatedValue) return true;

          const date = new Date(value);
          const relatedDate = new Date(relatedValue);

          if (!isValidDate(date) || !isValidDate(relatedDate)) {
            return false;
          }

          return date.getTime() > relatedDate.getTime();
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must be after ${relatedPropertyName}`;
        },
      },
    });
  };
}
