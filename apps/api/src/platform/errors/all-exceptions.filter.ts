import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { currentRequestId } from '../request-context/request-context.js';
import { AppError } from './app-error.js';
import { codeForStatus, ErrorCode } from './error-codes.js';
import type { ErrorResponseDto } from './error-response.dto.js';

/** Errors thrown by Express's body parser carry a status and a type instead of being HttpExceptions. */
interface BodyParserError {
  status: number;
  type: string;
}

function isBodyParserError(exception: unknown): exception is BodyParserError {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    typeof (exception as { status?: unknown }).status === 'number' &&
    typeof (exception as { type?: unknown }).type === 'string'
  );
}

/**
 * Whether a "payload too large" came from the photo upload rather than from the JSON
 * body: Nest turns multer's file-size error into a `PayloadTooLargeException` carrying
 * multer's own wording. The end-to-end test for an oversized photo pins this.
 */
const isPhotoUpload = (exception: HttpException): boolean =>
  exception.message === 'File too large';

/** `getStatus()` answers a plain number, so the status to compare it with is one too. */
const PAYLOAD_TOO_LARGE: number = HttpStatus.PAYLOAD_TOO_LARGE;

/**
 * Nest puts a string or a list of validation messages in `message`. Query strings are
 * removed, because Nest's "Cannot GET /path?query" messages would echo personal data
 * such as an email address from a search.
 */
function messageOf(exception: HttpException): string {
  return rawMessageOf(exception).replace(/\?\S*/g, '');
}

function rawMessageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const { message } = response;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return exception.message;
}

/**
 * Turns every error into the API's error format (API design, section 2.4):
 * `{ "error": { "code", "message", "details" } }`. Unexpected errors are logged with their
 * stack and answered with `INTERNAL_ERROR` and the request ID, never with internal details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorResponse(exception);
    response.status(status).json(body);
  }

  toErrorResponse(exception: unknown): {
    status: number;
    body: ErrorResponseDto;
  } {
    if (exception instanceof AppError) {
      return this.build(
        exception.getStatus(),
        exception.code,
        exception.message,
        exception.details,
      );
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      /*
       * The upload interceptor stops a file over the limit before any LanguZe code
       * runs, so its generic "payload too large" is translated here into the code
       * the API promises for a photo (FR-011, API design, section 3.3).
       */
      if (status === PAYLOAD_TOO_LARGE && isPhotoUpload(exception)) {
        return this.build(
          status,
          ErrorCode.PHOTO_TOO_LARGE,
          'This photo is larger than 10 MB.',
        );
      }
      if (status >= 500) return this.unexpected(exception, status);
      return this.build(status, codeForStatus(status), messageOf(exception));
    }

    if (isBodyParserError(exception) && exception.status < 500) {
      const message =
        exception.type === 'entity.too.large'
          ? 'The request body is too large.'
          : 'The request body could not be read.';
      return this.build(
        exception.status,
        codeForStatus(exception.status),
        message,
      );
    }

    return this.unexpected(exception, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private unexpected(exception: unknown, status: number) {
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error('Unexpected error', stack);
    const code = codeForStatus(status);
    const message =
      code === ErrorCode.SERVICE_UNAVAILABLE
        ? 'A required service is unavailable.'
        : 'An unexpected error occurred.';
    return this.build(status, code, message, { requestId: currentRequestId() });
  }

  private build(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): { status: number; body: ErrorResponseDto } {
    return {
      status,
      body: { error: details ? { code, message, details } : { code, message } },
    };
  }
}
