import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

export interface FieldError {
  /** Path of the field, with nested fields joined by dots. */
  field: string;
  /** Names of the rules the value broke, such as `maxLength`. */
  rules: string[];
}

/** Flattens class-validator errors, including nested objects, into one list of fields. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = error.constraints
      ? [{ field, rules: Object.keys(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** Turns failed request validation into the `VALIDATION_FAILED` error. */
export function validationErrorFactory(errors: ValidationError[]): AppError {
  return new AppError(
    ErrorCode.VALIDATION_FAILED,
    HttpStatus.BAD_REQUEST,
    'The request did not pass validation.',
    { fields: flattenValidationErrors(errors) },
  );
}
