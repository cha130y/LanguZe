import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';

/**
 * An error the API reports on purpose, with its stable code (API design, section 2.4).
 * `message` is English for developers and logs; learners see Thai text chosen by `code`.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
