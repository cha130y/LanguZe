import { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  validationErrorFactory,
} from './validation-error.factory.js';

function fieldError(
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  return Object.assign(new ValidationError(), {
    property,
    constraints,
    children,
  });
}

describe('validation errors', () => {
  it('lists each field with the names of the rules it broke', () => {
    expect(
      flattenValidationErrors([
        fieldError('name', {
          isNotEmpty: 'name should not be empty',
          maxLength: 'too long',
        }),
        fieldError('photo', { isDefined: 'photo is required' }),
      ]),
    ).toEqual([
      { field: 'name', rules: ['isNotEmpty', 'maxLength'] },
      { field: 'photo', rules: ['isDefined'] },
    ]);
  });

  it('joins nested fields with dots', () => {
    expect(
      flattenValidationErrors([
        fieldError('box', undefined, [
          fieldError('width', { min: 'width must not be less than 0' }),
        ]),
      ]),
    ).toEqual([{ field: 'box.width', rules: ['min'] }]);
  });

  it('becomes a 400 VALIDATION_FAILED error with the fields as details', () => {
    const error = validationErrorFactory([
      fieldError('name', { maxLength: 'too long' }),
    ]);

    expect(error.getStatus()).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details).toEqual({
      fields: [{ field: 'name', rules: ['maxLength'] }],
    });
  });
});
