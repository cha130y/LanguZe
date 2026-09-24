import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isPlaceholderAddress } from './placeholder-address.js';

/**
 * Refuses the placeholder addresses LanguZe gives accounts without an email (D1).
 *
 * Without this, someone could sign up with the address a LINE identity resolves to
 * and hold the account that learner's first LINE sign-in would otherwise create.
 * The addresses are guessable by design — they are built from the provider's user ID.
 */
export function IsDeliverableAddress(options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isDeliverableAddress',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && !isPlaceholderAddress(value),
        defaultMessage: () =>
          `${propertyName} must be an address that can receive mail`,
      },
    });
  };
}
